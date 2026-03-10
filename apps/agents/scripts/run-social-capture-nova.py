#!/usr/bin/env python3
"""
run-social-capture-nova.py

Dual-mode Nova Act social capture runner for AI Hire AI.

Priority:
1) Workflow mode if NOVA_ACT_WORKFLOW_ARN or NOVA_ACT_WORKFLOW_NAME exists
2) Else API-key mode if NOVA_ACT_API exists
3) Else fail with clear setup error

Purpose:
- starts Nova Act in workflow mode when available
- polls until completion (or timeout)
- fetches the final workflow result using multiple possible read APIs
- extracts structured output from common response shapes
- normalizes capture output for the social-screen pipeline
- falls back to API-key mode for local/dev usage

Notes:
- Workflow mode is preferred because it uses your configured workflow definition.
- API-key mode here is still a safe stub unless you later wire a real HTTP endpoint.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import uuid
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

try:
    import boto3
except Exception:
    boto3 = None

try:
    from nova_act import NovaAct
except Exception:
    NovaAct = None


# ---------------------------
# Data models
# ---------------------------

@dataclass
class LinkedInCapture:
    url: str
    found: bool
    headline: Optional[str] = None
    currentCompany: Optional[str] = None
    school: Optional[str] = None
    skills: Optional[List[str]] = None
    experiences: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None


@dataclass
class GitHubCapture:
    url: str
    found: bool
    username: Optional[str] = None
    displayName: Optional[str] = None
    bio: Optional[str] = None
    followers: Optional[int] = None
    following: Optional[int] = None
    contributionsLastYear: Optional[int] = None
    pinnedRepos: Optional[List[Dict[str, Any]]] = None
    topLanguages: Optional[List[str]] = None
    notes: Optional[str] = None


@dataclass
class WebCaptureResult:
    title: str
    snippet: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None


@dataclass
class WebCapture:
    queries: List[str]
    results: List[WebCaptureResult]
    notes: Optional[str] = None


@dataclass
class SocialCaptureOutput:
    ok: bool
    mode: str
    candidateName: str
    workflowRunId: Optional[str]
    timedOut: bool = False
    workflowDefinitionName: Optional[str] = None
    modelId: Optional[str] = None
    linkedin: Optional[LinkedInCapture] = None
    github: Optional[GitHubCapture] = None
    web: Optional[WebCapture] = None
    warnings: List[str] = None
    raw: Optional[Dict[str, Any]] = None


# ------------------------------------------
# Local browser mode helpers
# ------------------------------------------

class TimestampedStdout:
    def write(self, message: str) -> None:
        if message.strip():
            t = datetime.now().strftime("%H:%M:%S")
            sys.__stdout__.write(f"[{t}] {message}")
        else:
            sys.__stdout__.write(message)

    def flush(self) -> None:
        sys.__stdout__.flush()


def local_debug_enabled() -> bool:
    return os.getenv("NOVA_ACT_DEBUG_LOGS", "").strip().lower() in {"1", "true", "yes", "on"}


def prefer_chrome_enabled() -> bool:
    return os.getenv("NOVA_ACT_PREFER_CHROME", "").strip().lower() in {"1", "true", "yes", "on"}

def configure_local_browser_env_for_chrome() -> None:
    """
    Best-effort Chrome preference for local visible Nova Act runs.

    Important:
    - NovaAct's current local Playwright path uses a normal browser launch,
      not a persistent Chrome profile launch.
    - Because of that, we must NOT pass `--user-data-dir` here.
    - We only provide executable-path hints and safe non-profile browser args.
    - This keeps the run in Chrome/Chromium when possible, but it does NOT
      guarantee reuse of an already signed-in Chrome profile.
    """
    chrome_candidates = [
        clean_text(os.getenv("NOVA_ACT_CHROME_PATH")),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ]

    chrome_path = None
    for candidate in chrome_candidates:
        if candidate and os.path.exists(candidate):
            chrome_path = candidate
            break

    # Common hints used by browser launchers / Playwright-style tooling.
    os.environ["BROWSER"] = "chrome"
    os.environ["PLAYWRIGHT_BROWSER"] = "chromium"
    os.environ["PW_TEST_BROWSER"] = "chromium"

    if chrome_path:
        os.environ["GOOGLE_CHROME_BIN"] = chrome_path
        os.environ["CHROME_PATH"] = chrome_path
        os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] = chrome_path

    # IMPORTANT:
    # Do not pass --user-data-dir. NovaAct's current local Playwright launcher
    # calls BrowserType.launch(...), and Playwright rejects that flag there.
    # Also avoid explicit incognito/private flags.
    chrome_args: List[str] = [
        "--remote-debugging-port=9222",
        "--no-first-run",
        "--no-default-browser-check",
    ]

    os.environ["NOVA_ACT_BROWSER_ARGS"] = " ".join(chrome_args)

# ---------------------------
# Helpers
# ---------------------------

def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    return v or None


def get_region() -> str:
    return os.getenv("AWS_REGION", "us-east-1").strip() or "us-east-1"


def get_workflow_name() -> Optional[str]:
    name = clean_text(os.getenv("NOVA_ACT_WORKFLOW_NAME"))
    if name:
        return name

    arn = clean_text(os.getenv("NOVA_ACT_WORKFLOW_ARN"))
    if arn and "/" in arn:
        return arn.rsplit("/", 1)[-1]
    return arn


def get_model_id() -> str:
    return clean_text(os.getenv("NOVA_ACT_MODEL_ID")) or "nova-act-preview"


def has_workflow_mode() -> bool:
    return bool(get_workflow_name())


def has_api_key_mode() -> bool:
    return bool(clean_text(os.getenv("NOVA_ACT_API")))


def has_local_browser_mode() -> bool:
    return NovaAct is not None and bool(clean_text(os.getenv("NOVA_ACT_API")))


def extract_run_id(payload: Dict[str, Any]) -> Optional[str]:
    for key in (
        "workflowRunId",
        "runId",
        "id",
        "workflowExecutionId",
        "executionId",
    ):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def deep_get(data: Any, path: List[str]) -> Any:
    cur = data
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def maybe_parse_json_string(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    text = value.strip()
    if not text:
        return value

    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    if text.startswith("{") or text.startswith("["):
        try:
            return json.loads(text)
        except Exception:
            return value

    return value


def find_first_dict_with_keys(
    data: Any,
    required_keys: List[str],
    max_depth: int = 6,
) -> Optional[Dict[str, Any]]:
    def _walk(node: Any, depth: int) -> Optional[Dict[str, Any]]:
        if depth > max_depth:
            return None

        node = maybe_parse_json_string(node)

        if isinstance(node, dict):
            if all(key in node for key in required_keys):
                return node

            for value in node.values():
                found = _walk(value, depth + 1)
                if found is not None:
                    return found

        elif isinstance(node, list):
            for item in node:
                found = _walk(item, depth + 1)
                if found is not None:
                    return found

        return None

    return _walk(data, 0)


def maybe_find_section(data: Any, names: List[str], max_depth: int = 6) -> Optional[Dict[str, Any]]:
    target_names = {n.lower() for n in names}

    def _walk(node: Any, depth: int) -> Optional[Dict[str, Any]]:
        if depth > max_depth:
            return None

        node = maybe_parse_json_string(node)

        if isinstance(node, dict):
            for key, value in node.items():
                if key.lower() in target_names:
                    value = maybe_parse_json_string(value)
                    if isinstance(value, dict):
                        return value

            for value in node.values():
                found = _walk(value, depth + 1)
                if found is not None:
                    return found

        elif isinstance(node, list):
            for item in node:
                found = _walk(item, depth + 1)
                if found is not None:
                    return found

        return None

    return _walk(data, 0)


def get_status(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None

    for key in ("status", "workflowRunStatus", "state", "executionStatus"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().upper()

    nested = find_first_dict_with_keys(payload, ["status"], max_depth=4)
    if nested and isinstance(nested.get("status"), str):
        return nested["status"].strip().upper()

    return None


def is_terminal_status(status: Optional[str]) -> bool:
    if not status:
        return False
    return status in {
        "SUCCEEDED",
        "SUCCESS",
        "COMPLETED",
        "FAILED",
        "ERROR",
        "CANCELLED",
        "TIMED_OUT",
        "TIMEOUT",
    }


def is_success_status(status: Optional[str]) -> bool:
    if not status:
        return False
    return status in {"SUCCEEDED", "SUCCESS", "COMPLETED"}


def stringify_error(exc: Exception) -> str:
    return f"{exc.__class__.__name__}: {exc}"


def to_int(value: Any) -> Optional[int]:
    try:
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, str):
            digits = "".join(ch for ch in value if ch.isdigit())
            if not digits:
                return None
            return int(digits)
        return int(value)
    except Exception:
        return None


def as_list_of_strings(value: Any) -> Optional[List[str]]:
    if not isinstance(value, list):
        return None

    out: List[str] = []
    for item in value:
        if isinstance(item, str):
            s = item.strip()
            if s:
                out.append(s)

    return out or None


def first_non_empty_str(*values: Any) -> Optional[str]:
    for value in values:
        if isinstance(value, str):
            s = value.strip()
            if s:
                return s
    return None


# ---------------------------
# JSON-safe helper
# ---------------------------

def make_json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {str(k): make_json_safe(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [make_json_safe(v) for v in value]

    iso_method = getattr(value, "isoformat", None)
    if callable(iso_method):
        try:
            return iso_method()
        except Exception:
            pass

    return str(value)


def try_extract_structured_output(payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None

    metadata_only_keys = {
        "workflowRunId",
        "runId",
        "id",
        "status",
        "workflowRunStatus",
        "state",
        "ResponseMetadata",
        "workflowRunArn",
        "startedAt",
        "modelId",
    }
    payload_keys = set(payload.keys())
    if payload_keys and payload_keys.issubset(metadata_only_keys):
        return None

    candidates: List[Any] = []

    direct_paths = [
        ["output"],
        ["result"],
        ["results"],
        ["response"],
        ["data"],
        ["payload"],
        ["executionResult"],
        ["workflowResult"],
        ["finalOutput"],
    ]

    for path in direct_paths:
        value = deep_get(payload, path)
        if value is not None:
            candidates.append(value)

    message_content = deep_get(payload, ["output", "message", "content"])
    if isinstance(message_content, list):
        for item in message_content:
            if isinstance(item, dict) and "text" in item:
                candidates.append(item.get("text"))

    for candidate in candidates:
        parsed = maybe_parse_json_string(candidate)
        if isinstance(parsed, dict):
            return parsed

    return None


def summarize_payload(payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None

    status = get_status(payload)
    run_id = extract_run_id(payload)
    keys = list(payload.keys())[:20]
    structured = try_extract_structured_output(payload)

    summary: Dict[str, Any] = {
        "status": status,
        "runId": run_id,
        "topLevelKeys": keys,
        "hasStructuredOutput": structured is not None,
    }

    if isinstance(structured, dict):
        summary["structuredTopLevelKeys"] = list(structured.keys())[:20]

    return summary


# ---------------------------
# Stub fallback
# ---------------------------


def build_stub_capture(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
) -> SocialCaptureOutput:
    linkedin = (
        LinkedInCapture(
            url=linkedin_url,
            found=True,
            headline="Captured via Nova Act stub",
            currentCompany="Unknown",
            school=None,
            skills=[],
            experiences=[],
            notes="Stub capture only. Replace with real browser extraction.",
        )
        if linkedin_url
        else None
    )

    github = (
        GitHubCapture(
            url=github_url,
            found=True,
            username=(github_url.rstrip("/").split("/")[-1] if github_url else None),
            displayName=None,
            bio="Stub capture only",
            followers=None,
            following=None,
            contributionsLastYear=None,
            pinnedRepos=[],
            topLanguages=[],
            notes="Stub capture only. Replace with real browser extraction.",
        )
        if github_url
        else None
    )

    web = WebCapture(
        queries=web_queries,
        results=[
            WebCaptureResult(
                title=f"Search result placeholder for: {q}",
                snippet="Stub result generated locally.",
                source="stub",
                url=None,
            )
            for q in web_queries
        ],
        notes="Stub web capture only. Replace with real search/browser results.",
    )

    return SocialCaptureOutput(
        ok=True,
        mode="api-key",
        candidateName=candidate_name,
        workflowRunId=None,
        timedOut=False,
        workflowDefinitionName=None,
        modelId=get_model_id(),
        linkedin=linkedin,
        github=github,
        web=web,
        warnings=[
            "API-key mode currently returns stub capture placeholders in this script.",
            "Hook API-key mode into a real Nova Act endpoint when available.",
        ],
        raw={"apiKeyPresent": True, "implementation": "stub"},
    )


# ---------------------------
# Local visible browser mode
# ---------------------------
def build_local_browser_instruction(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
    linkedin_manual_login: bool = False,
) -> str:
    lines: List[str] = [
        "You are helping gather visible public profile information for research and profile review.",
        "Only inspect information that is already visible in the current browser session.",
        "Narrate your actions briefly while you move so the operator can follow along.",
        "Scroll only when needed. Avoid repetitive scrolling. Prefer targeted clicks and concise movement.",
        "If you complete a stage, move to the next stage immediately instead of revisiting earlier sections repeatedly.",
        f"Primary candidate name: {candidate_name}.",
    ]

    if linkedin_url:
        lines.append("LINKEDIN STAGE: NGUYEN PHAN NGUYEN PROFILE")

        if linkedin_manual_login:
            lines.extend(
                [
                    "1. You are starting from an already authenticated LinkedIn session after the human operator logged in manually.",
                    "2. Stay inside the current LinkedIn tab.",
                    "3. First, in the LinkedIn global search bar, search this exact query: Bao Tran George Mason University",
                    "4. On the search results page, use the People filter if visible.",
                    "5. Click the relevant Bao Tran George Mason University result, top 3 result from search result, whose title is AI Software Intern @ Deepiri",
                    "6. On Bao Tran's profile, click message button, write message \"Test002: Hi Bao Tran, I think you are a very good fit for our Cloud Engineer New Grad in the Cloud Mobile team at XYZZZZ.\",",
                    "7. After writing the message, hit button send to send the message to Bao Tran."
                    "8. If an Experience section shows a button like 'Show all 6 experiences' or similar, click it, review the expanded experience list, then return to the main profile page if needed.",
                    "9. Summarize the strongest visible findings from Bao Tran, then continue.",
                    "10. Next, in the LinkedIn global search bar, search this exact query: Nguyen Phan Nguyen Virginia Tech",
                    "11. On the search results page, use the People filter if visible.",
                    "12. Click the first and most relevant Nguyen Phan Nguyen result.",
                    "13. On Nguyen Phan Nguyen's profile, capture the top card: headline, location, connection count, employer, school, and visible public links.",
                    "14. Scroll down through About, Activity, Experience, Education, Featured, and Skills, but do not overscroll past useful sections more than once.",
                    "15. If a visible public hyperlink such as Portfolio or https://dot.cards/steegle appears, click it, inspect the portfolio page for useful public signals, then return to the LinkedIn profile tab.",
                    "16. Back on the LinkedIn profile, if an Experience section shows a button like 'Show all 6 experiences' or similar, click it, review the expanded experience list, then return to the main profile page if needed.",
                    "17. Summarize the strongest visible findings from Nguyen Phan Nguyen before moving on.",
                ]
            )
        else:
            lines.extend(
                [
                    "1. Start on Google search, not LinkedIn directly.",
                    "2. Search this exact query on Google: Nguyen Phan Nguyen Virginia Tech LinkedIn",
                    "3. Click the most relevant LinkedIn result for Nguyen Phan Nguyen.",
                    "4. If a sign-in modal appears and there is a visible X, click the X to dismiss it.",
                    "5. If LinkedIn blocks access with an authwall and no public content is visible, stop trying to bypass it and note that the public page is blocked.",
                    "6. If the public profile is visible, capture the top card, then scan About, Activity, Experience, Education, Featured, and Skills.",
                    "7. If a visible portfolio link appears, click it, inspect it, then return to the LinkedIn profile.",
                    "8. Summarize the strongest visible findings from Nguyen Phan Nguyen before moving on.",
                ]
            )

    if github_url:
        lines.extend(
            [
                "GITHUB STAGE:",
                f"11. Navigate directly to this GitHub URL: {github_url}",
                "12. Capture the GitHub profile header: username, display name, bio, followers, following, location, organization, and contribution activity if visible.",
                "13. Review pinned repositories first. Open the strongest one or two only, not more.",
                "14. For each strong repo, gather useful evidence: repo name, description, language, stars, documentation quality, code organization, tests, issues, pull requests, actions, security, and overall engineering maturity if visible.",
                "15. Return to the main GitHub profile after reviewing each repo.",
                "16. Keep GitHub exploration efficient and avoid unnecessary extra clicks.",
            ]
        )

    effective_queries = list(web_queries)
    for required_query in [
        "Nguyen Phan Nguyen Virginia Tech",
        "Nguyen Phan Nguyen Software Engineer",
    ]:
        if required_query not in effective_queries:
            effective_queries.append(required_query)

    if effective_queries:
        lines.append("WEB SEARCH STAGE:")
        lines.append("17. Use web search for public evidence such as hackathons, conference talks, portfolios, technical blogs, internships, or awards.")
        for idx, query in enumerate(effective_queries, start=1):
            lines.append(f"17.{idx}. Search this exact query: {query}")
        lines.append("18. Open only clearly relevant public results and summarize only the strongest visible findings.")

    lines.extend(
        [
            "FINAL REPORT:",
            "19. End with a concise report of the strongest positive signals, any warnings, and any missing information.",
            "20. Once all requested stages are complete, stop and return control immediately. Do not continue exploring.",
        ]
    )

    return "\n".join(lines)

def wait_for_manual_login(prompt: str) -> None:
    print(prompt)
    try:
        input()
    except EOFError:
        pass



def run_local_browser_mode(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
    manual_linkedin_login: bool = False,
) -> SocialCaptureOutput:
    api_key = clean_text(os.getenv("NOVA_ACT_API"))
    if not api_key:
        raise RuntimeError("NOVA_ACT_API is required for local browser mode.")

    if NovaAct is None:
        raise RuntimeError(
            "nova_act is not installed. Install it first, e.g. `pip install nova-act`."
        )

    if local_debug_enabled():
        sys.stdout = TimestampedStdout()

    browser_args = clean_text(os.getenv("NOVA_ACT_BROWSER_ARGS"))
    if not browser_args:
        # Default to a normal non-incognito browser session.
        # Keep this profile-agnostic because the current NovaAct local launcher
        # does not support reusing a Chrome user profile through --user-data-dir.
        os.environ["NOVA_ACT_BROWSER_ARGS"] = (
            "--remote-debugging-port=9222 --no-first-run --no-default-browser-check"
        )

    if manual_linkedin_login and linkedin_url:
        starting_page = "https://www.linkedin.com/feed/"
    else:
        starting_page = "https://www.google.com" if linkedin_url else (github_url or "https://www.google.com")
    if local_debug_enabled():
        eprint(f"[INFO] Local browser starting page: {starting_page}")
        eprint(f"[INFO] Prefer Chrome enabled: {prefer_chrome_enabled()}")

    if prefer_chrome_enabled():
        # Do not open a separate browser window manually.
        # Instead, configure env vars so NovaAct itself prefers Chrome/Chromium.
        configure_local_browser_env_for_chrome()

        if local_debug_enabled():
            chrome_path = clean_text(os.getenv("CHROME_PATH")) or clean_text(os.getenv("GOOGLE_CHROME_BIN"))
            if chrome_path:
                eprint(f"[INFO] Chrome executable hint set: {chrome_path}")
            else:
                eprint(
                    "[INFO] Chrome preference enabled, but no explicit Chrome executable path was found. "
                    "Falling back to system Chrome/Chromium discovery."
                )
            eprint(f"[INFO] NOVA_ACT_BROWSER_ARGS: {os.getenv('NOVA_ACT_BROWSER_ARGS', '')}")
            eprint(
                "[INFO] Current NovaAct local mode uses an isolated Playwright-launched browser. "
                "It prefers Chrome/Chromium, but it does not reliably reuse your signed-in Chrome profile."
            )

    instruction = build_local_browser_instruction(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        web_queries=web_queries,
        linkedin_manual_login=manual_linkedin_login,
    )
    nova = NovaAct(
        starting_page=starting_page,
        headless=False,
        nova_act_api_key=api_key,
    )

    nova.start()
    if manual_linkedin_login and linkedin_url:
        wait_for_manual_login(
            "\n[MANUAL STEP] LinkedIn manual login mode is enabled.\n"
            "The browser is open on LinkedIn. Please finish logging into your LinkedIn account manually,\n"
            "navigate until you can see the authenticated LinkedIn UI (for example the feed page),\n"
            "then press Enter here in the terminal so Nova Act can continue from the signed-in session..."
        )
    try:
        act_result = nova.act(instruction)
    except Exception as exc:
        raise RuntimeError(
            "Local browser act failed. This can happen if the page closes, a modal blocks the page, or the browser session is interrupted. "
            f"Original error: {exc}"
        ) from exc

    linkedin = (
        LinkedInCapture(
            url=linkedin_url,
            found=bool(linkedin_url),
            notes="Local visible Nova Act browser session ran. Map structured extraction after you define your local parsing strategy.",
        )
        if linkedin_url
        else None
    )

    github = (
        GitHubCapture(
            url=github_url,
            found=bool(github_url),
            username=(github_url.rstrip("/").split("/")[-1] if github_url else None),
            notes="Local visible Nova Act browser session ran. Map structured extraction after you define your local parsing strategy.",
        )
        if github_url
        else None
    )

    web = WebCapture(
        queries=web_queries,
        results=[],
        notes="Local visible Nova Act browser session ran. Add parser logic if you want structured web extraction.",
    )

    return SocialCaptureOutput(
        ok=True,
        mode="local-browser",
        candidateName=candidate_name,
        workflowRunId=None,
        timedOut=False,
        workflowDefinitionName=None,
        modelId=get_model_id(),
        linkedin=linkedin,
        github=github,
        web=web,
        warnings=[
            "Local visible browser mode was used.",
            "This mode is best for debugging because you can see the browser and Nova Act actions directly.",
            "If manual LinkedIn login mode is enabled, the agent continues from your already signed-in LinkedIn session, reviews Bao Tran first for visible profile signals, then reviews Nguyen Phan Nguyen before GitHub.",
            "The local instruction now uses staged LinkedIn Nguyen scan -> Bao Tran outreach draft -> GitHub -> web-search steps with fewer redundant actions to reduce max-step failures.",
            "Structured extraction is still a placeholder in this mode until you add page parsing/mapping.",
            "If NOVA_ACT_PREFER_CHROME is enabled, the script prefers launching NovaAct itself in Chrome/Chromium.",
            "Local mode now starts on Google when LinkedIn is requested, so the agent searches for the public LinkedIn result instead of opening the profile URL directly.",
            "This SDK path currently launches an isolated Playwright browser context, so it will not reuse your already signed-in Chrome profile.",
            "Do not set a Chrome user-data-dir for this script unless NovaAct adds persistent-context profile support in a future SDK version.",
        ],
        raw={
            "startingPage": starting_page,
            "manualLinkedInLogin": manual_linkedin_login,
            "instruction": instruction,
            "actResult": act_result,
            "preferChrome": prefer_chrome_enabled(),
            "linkedInStartsFromGoogle": bool(linkedin_url),
            "profileReuseSupported": False,
        },
    )


# ---------------------------
# Workflow mode
# ---------------------------

def create_nova_act_client():
    if boto3 is None:
        raise RuntimeError("boto3 is not installed. Install it first: pip install boto3")
    return boto3.client("nova-act", region_name=get_region())


def start_workflow_run(client) -> Dict[str, Any]:
    workflow_name = get_workflow_name()
    if not workflow_name:
        raise RuntimeError(
            "Workflow mode requested but NOVA_ACT_WORKFLOW_NAME / NOVA_ACT_WORKFLOW_ARN is missing."
        )

    try:
        return client.create_workflow_run(
            workflowDefinitionName=workflow_name,
            modelId=get_model_id(),
            clientToken=str(uuid.uuid4()),
            clientInfo={
                "compatibilityVersion": 1,
                "sdkVersion": "custom-local-0.2.0",
            },
        )
    except Exception as exc:
        raise RuntimeError(f"create_workflow_run failed: {exc}") from exc


def get_workflow_run(client, run_id: str) -> Optional[Dict[str, Any]]:
    workflow_name = get_workflow_name()

    method_specs: List[Tuple[str, Dict[str, Any]]] = []

    if workflow_name:
        method_specs.extend(
            [
                ("get_workflow_run", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
                ("describe_workflow_run", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
                ("get_workflow_run_result", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
                ("get_workflow_execution", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
                ("describe_workflow_execution", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
            ]
        )

    errors: List[str] = []

    for method_name, kwargs in method_specs:
        method = getattr(client, method_name, None)
        if not callable(method):
            continue

        try:
            payload = method(**kwargs)
            if isinstance(payload, dict):
                return payload
        except Exception as exc:
            errors.append(f"{method_name}({kwargs}): {exc}")
            continue

    if errors:
        raise RuntimeError(
            "Could not fetch workflow run {}. Tried:\n{}".format(
                run_id,
                "\n".join(errors),
            )
        )

    return None


def poll_workflow_run(
    client,
    run_id: str,
    timeout_seconds: int = 45,
    poll_interval_seconds: float = 2.0,
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], List[str], bool]:
    deadline = time.time() + timeout_seconds
    last_payload: Optional[Dict[str, Any]] = None
    poll_history: List[Dict[str, Any]] = []
    poll_errors: List[str] = []
    attempt = 0
    timed_out = False

    while time.time() < deadline:
        attempt += 1
        now = time.time()
        remaining = max(0.0, deadline - now)

        try:
            payload = get_workflow_run(client, run_id)
        except Exception as exc:
            payload = None
            poll_errors.append(f"attempt {attempt}: {stringify_error(exc)}")

        snapshot: Dict[str, Any] = {
            "attempt": attempt,
            "secondsRemaining": round(remaining, 2),
        }

        if payload:
            last_payload = payload
            status = get_status(payload)
            structured = try_extract_structured_output(payload)

            snapshot.update(
                {
                    "status": status,
                    "hasStructuredOutput": structured is not None,
                    "payloadSummary": summarize_payload(payload),
                }
            )
            poll_history.append(snapshot)

            if is_terminal_status(status):
                return payload, poll_history, poll_errors, False

            if structured and status in {None, "RUNNING", "IN_PROGRESS", "PENDING"}:
                return payload, poll_history, poll_errors, False
        else:
            snapshot.update(
                {
                    "status": None,
                    "hasStructuredOutput": False,
                    "payloadSummary": None,
                }
            )
            poll_history.append(snapshot)

        time.sleep(poll_interval_seconds)

    timed_out = True
    return last_payload, poll_history, poll_errors, timed_out


def fetch_final_workflow_output(
    client,
    run_id: str,
    latest_payload: Optional[Dict[str, Any]],
    extra_attempts: int = 4,
    sleep_seconds: float = 2.0,
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    current = latest_payload
    fetch_history: List[Dict[str, Any]] = []
    fetch_errors: List[str] = []

    for attempt in range(1, max(0, extra_attempts) + 1):
        structured = try_extract_structured_output(current)
        if structured:
            fetch_history.append(
                {
                    "attempt": attempt,
                    "status": get_status(current),
                    "hasStructuredOutput": True,
                    "payloadSummary": summarize_payload(current),
                    "shortCircuit": True,
                }
            )
            return current, fetch_history, fetch_errors

        try:
            candidate = get_workflow_run(client, run_id)
        except Exception as exc:
            candidate = current
            fetch_errors.append(f"attempt {attempt}: {stringify_error(exc)}")

        if candidate:
            current = candidate

        fetch_history.append(
            {
                "attempt": attempt,
                "status": get_status(current),
                "hasStructuredOutput": try_extract_structured_output(current) is not None,
                "payloadSummary": summarize_payload(current),
                "shortCircuit": False,
            }
        )

        if try_extract_structured_output(current):
            return current, fetch_history, fetch_errors

        time.sleep(sleep_seconds)

    return current, fetch_history, fetch_errors


def extract_capture_from_workflow_output(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
    final_response: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    root = try_extract_structured_output(final_response) or final_response

    linkedin_section = None
    github_section = None
    web_section = None

    if root:
        linkedin_section = maybe_find_section(root, ["linkedin", "linkedIn"])
        github_section = maybe_find_section(root, ["github", "gitHub"])
        web_section = maybe_find_section(root, ["web", "search", "google", "webSearch"])

        if linkedin_section is None:
            linkedin_section = find_first_dict_with_keys(root, ["headline"], max_depth=6)

        if github_section is None:
            github_section = find_first_dict_with_keys(root, ["username"], max_depth=6)

        if web_section is None:
            web_section = find_first_dict_with_keys(root, ["results"], max_depth=6)

    linkedin = (
        LinkedInCapture(
            url=linkedin_url,
            found=bool(linkedin_url),
            headline=first_non_empty_str(
                deep_get(linkedin_section, ["headline"]) if linkedin_section else None,
                deep_get(linkedin_section, ["profileHeadline"]) if linkedin_section else None,
            ),
            currentCompany=first_non_empty_str(
                deep_get(linkedin_section, ["currentCompany"]) if linkedin_section else None,
                deep_get(linkedin_section, ["company"]) if linkedin_section else None,
            ),
            school=first_non_empty_str(
                deep_get(linkedin_section, ["school"]) if linkedin_section else None,
                deep_get(linkedin_section, ["education"]) if linkedin_section else None,
            ),
            skills=as_list_of_strings(
                deep_get(linkedin_section, ["skills"]) if linkedin_section else None
            ),
            experiences=(
                deep_get(linkedin_section, ["experiences"])
                if isinstance(deep_get(linkedin_section, ["experiences"]), list)
                else None
            ),
            notes=(
                None
                if linkedin_section
                else "No structured LinkedIn extraction found in workflow output yet."
            ),
        )
        if linkedin_url
        else None
    )

    github = (
        GitHubCapture(
            url=github_url,
            found=bool(github_url),
            username=first_non_empty_str(
                deep_get(github_section, ["username"]) if github_section else None,
                github_url.rstrip("/").split("/")[-1] if github_url else None,
            ),
            displayName=first_non_empty_str(
                deep_get(github_section, ["displayName"]) if github_section else None,
                deep_get(github_section, ["name"]) if github_section else None,
            ),
            bio=first_non_empty_str(
                deep_get(github_section, ["bio"]) if github_section else None,
            ),
            followers=to_int(
                deep_get(github_section, ["followers"]) if github_section else None
            ),
            following=to_int(
                deep_get(github_section, ["following"]) if github_section else None
            ),
            contributionsLastYear=to_int(
                first_non_empty_str(
                    deep_get(github_section, ["contributionsLastYear"]) if github_section else None,
                    deep_get(github_section, ["contributions"]) if github_section else None,
                )
                or (deep_get(github_section, ["contributionsLastYear"]) if github_section else None)
                or (deep_get(github_section, ["contributions"]) if github_section else None)
            ),
            pinnedRepos=(
                deep_get(github_section, ["pinnedRepos"])
                if isinstance(deep_get(github_section, ["pinnedRepos"]), list)
                else (
                    deep_get(github_section, ["repos"])
                    if isinstance(deep_get(github_section, ["repos"]), list)
                    else None
                )
            ),
            topLanguages=as_list_of_strings(
                deep_get(github_section, ["topLanguages"]) if github_section else None
            ),
            notes=(
                None
                if github_section
                else "No structured GitHub extraction found in workflow output yet."
            ),
        )
        if github_url
        else None
    )

    web_results: List[WebCaptureResult] = []
    if web_section:
        raw_results = None
        if isinstance(deep_get(web_section, ["results"]), list):
            raw_results = deep_get(web_section, ["results"])
        elif isinstance(deep_get(web_section, ["items"]), list):
            raw_results = deep_get(web_section, ["items"])

        if isinstance(raw_results, list):
            for item in raw_results:
                if not isinstance(item, dict):
                    continue
                title = first_non_empty_str(item.get("title"), item.get("name"))
                if not title:
                    continue
                web_results.append(
                    WebCaptureResult(
                        title=title,
                        snippet=first_non_empty_str(item.get("snippet"), item.get("summary")),
                        source=first_non_empty_str(item.get("source"), item.get("engine")),
                        url=first_non_empty_str(item.get("url"), item.get("link")),
                    )
                )

    web = WebCapture(
        queries=web_queries,
        results=web_results,
        notes=(
            None
            if web_section or web_results
            else "No structured web/search extraction found in workflow output yet."
        ),
    )

    return {
        "linkedin": linkedin,
        "github": github,
        "web": web,
    }


def normalize_workflow_capture(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
    start_response: Dict[str, Any],
    final_response: Optional[Dict[str, Any]],
    timed_out: bool,
) -> SocialCaptureOutput:
    workflow_name = get_workflow_name()
    run_id = extract_run_id(start_response)
    final_status = get_status(final_response)
    structured_output = try_extract_structured_output(final_response)

    extracted = extract_capture_from_workflow_output(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        web_queries=web_queries,
        final_response=final_response,
    )

    warnings: List[str] = []

    if final_response is None:
        warnings.append("Workflow started, but no final workflow payload was retrieved.")
        warnings.append("The read API likely needs workflowDefinitionName + workflowRunId or a different read method shape.")
        warnings.append("Inspect raw.pollHistory, raw.pollErrors, raw.fetchHistory, and raw.fetchErrors for diagnostics.")
    else:
        if timed_out and final_status == "RUNNING":
            warnings.append("Workflow is still RUNNING after the timeout window.")
            warnings.append("Increase --timeout-seconds, or inspect the run in Nova using workflowRunId.")
        elif final_status and not is_success_status(final_status):
            warnings.append(f"Workflow finished with non-success status: {final_status}")
        elif final_status:
            warnings.append(f"Workflow finished with status: {final_status}")
        else:
            warnings.append("Workflow payload fetched, but no explicit final status was found.")

    if structured_output is None and final_response is not None:
        if timed_out and final_status == "RUNNING":
            warnings.append("No structured output is available yet because the workflow has not completed.")
        else:
            warnings.append("Final workflow payload was fetched, but no structured output block was detected yet.")

    if extracted["linkedin"] and extracted["linkedin"].notes:
        warnings.append("LinkedIn extraction not fully mapped yet.")
    if extracted["github"] and extracted["github"].notes:
        warnings.append("GitHub extraction not fully mapped yet.")
    if extracted["web"] and extracted["web"].notes:
        warnings.append("Web extraction not fully mapped yet.")

    return SocialCaptureOutput(
        ok=True,
        mode="workflow",
        candidateName=candidate_name,
        workflowRunId=run_id,
        timedOut=timed_out,
        workflowDefinitionName=workflow_name,
        modelId=get_model_id(),
        linkedin=extracted["linkedin"],
        github=extracted["github"],
        web=extracted["web"],
        warnings=warnings,
        raw={
            "start": start_response,
            "final": final_response,
            "structuredOutput": structured_output,
            "finalStatus": final_status,
            "finalSummary": summarize_payload(final_response),
        },
    )


def run_workflow_mode(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
    timeout_seconds: int,
    poll_interval_seconds: float,
) -> SocialCaptureOutput:
    client = create_nova_act_client()
    start_response = start_workflow_run(client)
    run_id = extract_run_id(start_response)

    final_response: Optional[Dict[str, Any]] = None
    poll_history: List[Dict[str, Any]] = []
    poll_errors: List[str] = []
    fetch_history: List[Dict[str, Any]] = []
    fetch_errors: List[str] = []
    timed_out = False

    if run_id:
        latest, poll_history, poll_errors, timed_out = poll_workflow_run(
            client,
            run_id,
            timeout_seconds=timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )
        extra_fetch_attempts = max(
            4,
            min(12, int(max(1, timeout_seconds // max(1.0, poll_interval_seconds))))
        )
        final_response, fetch_history, fetch_errors = fetch_final_workflow_output(
            client,
            run_id,
            latest_payload=latest,
            extra_attempts=extra_fetch_attempts,
            sleep_seconds=max(1.0, poll_interval_seconds),
        )

    output = normalize_workflow_capture(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        web_queries=web_queries,
        start_response=start_response,
        final_response=final_response,
        timed_out=timed_out,
    )

    if output.raw is None:
        output.raw = {}

    last_status = get_status(final_response) or get_status(start_response)

    output.raw["pollHistory"] = poll_history
    output.raw["pollErrors"] = poll_errors
    output.raw["fetchHistory"] = fetch_history
    output.raw["fetchErrors"] = fetch_errors
    output.raw["lastKnownStatus"] = last_status
    output.raw["timedOut"] = timed_out
    output.raw["workflowDefinitionName"] = get_workflow_name()
    output.raw["startSummary"] = summarize_payload(start_response)
    output.raw["finalSummary"] = summarize_payload(final_response)
    output.raw["timeoutSeconds"] = timeout_seconds
    output.raw["pollIntervalSeconds"] = poll_interval_seconds

    if poll_errors:
        output.warnings.append("Some workflow polling attempts failed. Check raw.pollErrors.")
    if fetch_errors:
        output.warnings.append("Some final workflow fetch attempts failed. Check raw.fetchErrors.")
    if not final_response:
        output.warnings.append("No readable workflow payload was returned after polling + fetch attempts.")
    elif timed_out:
        final_status = get_status(final_response)
        if final_status == "RUNNING":
            output.warnings.append(
                "Workflow did not complete before timeout and is still RUNNING remotely; rerun with a larger timeout or inspect the remote run."
            )
        else:
            output.warnings.append("Workflow did not complete before timeout; rerun with a larger timeout or inspect the remote run.")
    return output

# ---------------------------
# API-key mode
# ---------------------------

def run_api_key_mode(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
) -> SocialCaptureOutput:
    api_key = clean_text(os.getenv("NOVA_ACT_API"))
    if not api_key:
        raise RuntimeError("NOVA_ACT_API is missing.")

    return build_stub_capture(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        web_queries=web_queries,
    )


# ---------------------------
# CLI
# ---------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Nova Act social capture in workflow mode first, then API-key fallback."
    )
    parser.add_argument("candidate_name", help="Candidate full name")
    parser.add_argument("--linkedin", dest="linkedin_url", help="LinkedIn URL")
    parser.add_argument("--github", dest="github_url", help="GitHub URL")
    parser.add_argument(
        "--web-query",
        dest="web_queries",
        action="append",
        default=[],
        help="Public web search query (repeatable)",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=180,
        help="Workflow polling timeout in seconds (default: 180)",
    )
    
    parser.add_argument(
        "--poll-interval-seconds",
        type=float,
        default=2.0,
        help="Workflow polling interval in seconds (default: 2.0)",
    )
    parser.add_argument(
        "--local-browser",
        action="store_true",
        help="Use local visible Nova Act SDK mode instead of AWS workflow mode.",
    )
    parser.add_argument(
        "--debug-logs",
        action="store_true",
        help="Enable timestamped local stdout logs (mainly useful with --local-browser).",
    )
    parser.add_argument(
        "--prefer-chrome",
        action="store_true",
        help="Open target URLs in Google Chrome first for visual debugging (best-effort, macOS only).",
    )
    parser.add_argument(
        "--manual-linkedin-login",
        action="store_true",
        help="Open LinkedIn first, let the human log in manually, then continue the agent from the signed-in LinkedIn session.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    candidate_name = args.candidate_name.strip()
    linkedin_url = clean_text(args.linkedin_url)
    github_url = clean_text(args.github_url)
    web_queries = [q.strip() for q in (args.web_queries or []) if q and q.strip()]

    if args.debug_logs:
        os.environ["NOVA_ACT_DEBUG_LOGS"] = "1"
    if args.prefer_chrome:
        os.environ["NOVA_ACT_PREFER_CHROME"] = "1"

    # These older profile env vars are intentionally ignored by the current
    # local NovaAct launcher path because passing --user-data-dir causes
    # Playwright launch failures in this SDK flow.
    # These older profile env vars are only relevant to local browser mode and are intentionally ignored there
    # because passing --user-data-dir causes Playwright launch failures in this SDK flow.
    if args.local_browser and (
        clean_text(os.getenv("NOVA_ACT_CHROME_USER_DATA_DIR"))
        or clean_text(os.getenv("NOVA_ACT_CHROME_PROFILE_DIRECTORY"))
    ):
        eprint(
            "[WARN] Ignoring NOVA_ACT_CHROME_USER_DATA_DIR / NOVA_ACT_CHROME_PROFILE_DIRECTORY in local mode. "
            "This NovaAct SDK path does not support Chrome profile reuse via --user-data-dir."
        )

    if not candidate_name:
        eprint("[ERROR] candidate_name is required.")
        return 2

    if args.local_browser:
        if not has_local_browser_mode():
            eprint(
                "[ERROR] Local browser mode requires both the local NovaAct SDK and NOVA_ACT_API.\n"
                "Install the SDK and set NOVA_ACT_API, then rerun with --local-browser."
            )
            return 2
    elif not has_workflow_mode() and not has_api_key_mode():
        eprint(
            "[ERROR] Nova Act is not configured. Set either:\n"
            "  - NOVA_ACT_WORKFLOW_ARN or NOVA_ACT_WORKFLOW_NAME (preferred)\n"
            "  - OR NOVA_ACT_API (fallback / local browser)"
        )
        return 2

    output: Optional[SocialCaptureOutput] = None
    workflow_error: Optional[str] = None

    if args.local_browser:
        try:
            output = run_local_browser_mode(
                candidate_name=candidate_name,
                linkedin_url=linkedin_url,
                github_url=github_url,
                web_queries=web_queries,
                manual_linkedin_login=args.manual_linkedin_login,
            )
        except Exception as exc:
            eprint(f"[ERROR] Local browser mode failed: {exc}")
            return 1
    else:
        if has_workflow_mode():
            if local_debug_enabled():
                eprint(
                    f"[INFO] Workflow mode enabled: definition={get_workflow_name()} model={get_model_id()} "
                    f"timeout={args.timeout_seconds}s poll_interval={args.poll_interval_seconds}s"
                )
            try:
                output = run_workflow_mode(
                    candidate_name=candidate_name,
                    linkedin_url=linkedin_url,
                    github_url=github_url,
                    web_queries=web_queries,
                    timeout_seconds=args.timeout_seconds,
                    poll_interval_seconds=args.poll_interval_seconds,
                )
            except Exception as exc:
                workflow_error = str(exc)
                eprint(f"[WARN] Workflow mode failed: {workflow_error}")
    
        if output is None and has_api_key_mode():
            try:
                output = run_api_key_mode(
                    candidate_name=candidate_name,
                    linkedin_url=linkedin_url,
                    github_url=github_url,
                    web_queries=web_queries,
                )
                if workflow_error:
                    output.warnings.insert(0, f"Workflow mode failed first: {workflow_error}")
            except Exception as exc:
                eprint(f"[ERROR] API-key mode failed: {exc}")
                return 1

    if output is None:
        if workflow_error:
            eprint(f"[ERROR] Workflow mode failed and no API-key fallback succeeded: {workflow_error}")
        else:
            eprint("[ERROR] No usable Nova Act mode available.")
        return 1

    payload = make_json_safe(asdict(output))

    if local_debug_enabled() and output.mode == "workflow":
        eprint(
            f"[INFO] Workflow result status: timedOut={payload.get('timedOut')} "
            f"runId={payload.get('workflowRunId')}"
        )

    if args.pretty:
        print(json.dumps(payload, indent=2))
    else:
        print(json.dumps(payload))
    return 0

    


if __name__ == "__main__":
    sys.exit(main())
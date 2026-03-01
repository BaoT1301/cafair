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
import sys
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

try:
    import boto3
except Exception:
    boto3 = None


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
    workflowDefinitionName: Optional[str]
    modelId: Optional[str]
    linkedin: Optional[LinkedInCapture]
    github: Optional[GitHubCapture]
    web: Optional[WebCapture]
    warnings: List[str]
    raw: Optional[Dict[str, Any]] = None


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


def get_status(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None

    for key in (
        "status",
        "workflowRunStatus",
        "state",
        "executionStatus",
    ):
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


def try_extract_structured_output(payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not payload:
        return None

    candidates: List[Any] = [payload]

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
    """
    Best-effort read of workflow run status/result.
    Tries multiple possible SDK method/parameter shapes.
    Returns the first successful response.
    """
    method_specs: List[Tuple[str, Dict[str, Any]]] = [
        ("get_workflow_run", {"workflowRunId": run_id}),
        ("get_workflow_run", {"runId": run_id}),
        ("describe_workflow_run", {"workflowRunId": run_id}),
        ("describe_workflow_run", {"runId": run_id}),
        ("get_workflow_run_result", {"workflowRunId": run_id}),
        ("get_workflow_run_result", {"runId": run_id}),
        ("get_workflow_execution", {"workflowRunId": run_id}),
        ("get_workflow_execution", {"runId": run_id}),
        ("describe_workflow_execution", {"workflowRunId": run_id}),
        ("describe_workflow_execution", {"runId": run_id}),
    ]

    last_error: Optional[str] = None

    for method_name, kwargs in method_specs:
        method = getattr(client, method_name, None)
        if not callable(method):
            continue

        try:
            payload = method(**kwargs)
            if isinstance(payload, dict):
                return payload
        except Exception as exc:
            last_error = str(exc)
            continue

    if last_error:
        raise RuntimeError(f"Could not fetch workflow run {run_id}: {last_error}")

    return None


def poll_workflow_run(
    client,
    run_id: str,
    timeout_seconds: int = 45,
    poll_interval_seconds: float = 2.0,
) -> Optional[Dict[str, Any]]:
    """
    Poll until terminal state or timeout.
    Keeps the latest payload. If a payload appears to contain final output,
    keep it even if status remains inconsistent.
    """
    deadline = time.time() + timeout_seconds
    last_payload: Optional[Dict[str, Any]] = None

    while time.time() < deadline:
        try:
            payload = get_workflow_run(client, run_id)
        except Exception:
            payload = None

        if payload:
            last_payload = payload
            status = get_status(payload)
            structured = try_extract_structured_output(payload)

            if is_terminal_status(status):
                return payload

            if structured and status in {None, "RUNNING", "IN_PROGRESS", "PENDING"}:
                # Some APIs may already expose final-ish payloads before status settles.
                return payload

        time.sleep(poll_interval_seconds)

    return last_payload


def fetch_final_workflow_output(
    client,
    run_id: str,
    latest_payload: Optional[Dict[str, Any]],
    extra_attempts: int = 4,
    sleep_seconds: float = 2.0,
) -> Optional[Dict[str, Any]]:
    """
    After polling stops, try a few extra reads to fetch the completed remote output.
    This helps when status flips to terminal slightly before output becomes readable.
    """
    current = latest_payload

    for _ in range(max(0, extra_attempts)):
        structured = try_extract_structured_output(current)
        if structured:
            return current

        try:
            candidate = get_workflow_run(client, run_id)
        except Exception:
            candidate = current

        if candidate:
            current = candidate
            structured = try_extract_structured_output(current)
            if structured:
                return current

        time.sleep(sleep_seconds)

    return current


def extract_capture_from_workflow_output(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
    final_response: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Best-effort mapper from workflow output into normalized capture sections.
    First unwrap likely output containers, then look for obvious sections.
    """
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
        warnings.append("Workflow started, but no final workflow payload was retrieved before timeout.")
        warnings.append("Increase timeout or inspect the run manually using workflowRunId.")
    else:
        if final_status and not is_success_status(final_status):
            warnings.append(f"Workflow finished with non-success status: {final_status}")
        elif final_status:
            warnings.append(f"Workflow finished with status: {final_status}")
        else:
            warnings.append("Workflow payload fetched, but no explicit final status was found.")

    if structured_output is None and final_response is not None:
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
    if run_id:
        latest = poll_workflow_run(
            client,
            run_id,
            timeout_seconds=timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )
        final_response = fetch_final_workflow_output(
            client,
            run_id,
            latest_payload=latest,
            extra_attempts=4,
            sleep_seconds=max(1.0, poll_interval_seconds),
        )

    return normalize_workflow_capture(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        web_queries=web_queries,
        start_response=start_response,
        final_response=final_response,
    )


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
        default=45,
        help="Workflow polling timeout in seconds (default: 45)",
    )
    parser.add_argument(
        "--poll-interval-seconds",
        type=float,
        default=2.0,
        help="Workflow polling interval in seconds (default: 2.0)",
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

    if not candidate_name:
        eprint("[ERROR] candidate_name is required.")
        return 2

    if not has_workflow_mode() and not has_api_key_mode():
        eprint(
            "[ERROR] Nova Act is not configured. Set either:\n"
            "  - NOVA_ACT_WORKFLOW_ARN or NOVA_ACT_WORKFLOW_NAME (preferred)\n"
            "  - OR NOVA_ACT_API (fallback)"
        )
        return 2

    output: Optional[SocialCaptureOutput] = None
    workflow_error: Optional[str] = None

    if has_workflow_mode():
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

    payload = asdict(output)
    if args.pretty:
        print(json.dumps(payload, indent=2))
    else:
        print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
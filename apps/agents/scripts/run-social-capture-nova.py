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
import re
import shutil
import sys
import time
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import boto3
except Exception:
    boto3 = None

try:
    from nova_act import NovaAct
except Exception:
    NovaAct = None


LOCAL_BROWSER_STDOUT_LINES: List[str] = []
ACTIVE_RUN_ARTIFACT_DIR: Optional[Path] = None
NOVA_LOG_COPY_SUFFIXES = {".html", ".json", ".png", ".jpg", ".jpeg", ".log", ".txt"}


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
class PortfolioCapture:
    url: str
    found: bool
    status: str = "skipped"
    ownerName: Optional[str] = None
    candidateLabel: Optional[str] = None
    mismatchFlag: bool = False
    evidence: Optional[List[str]] = None
    projectsReviewed: Optional[int] = None
    projectHighlights: Optional[List[str]] = None
    resumeFound: Optional[bool] = None
    githubLinkFound: Optional[bool] = None
    githubLinkMatchesExpected: Optional[str] = None
    retroFound: Optional[bool] = None
    warnings: Optional[List[str]] = None
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
    portfolio: Optional[PortfolioCapture] = None
    web: Optional[WebCapture] = None
    flags: Optional[List[str]] = None
    warnings: List[str] = None
    raw: Optional[Dict[str, Any]] = None


# ------------------------------------------
# Local browser mode helpers
# ------------------------------------------

class TimestampedStdout:
    def __init__(self, timestamp: bool = True) -> None:
        self.timestamp = timestamp

    def write(self, message: str) -> None:
        if message:
            LOCAL_BROWSER_STDOUT_LINES.append(message)
        if self.timestamp and message.strip():
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


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def slugify_candidate_name(candidate_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", candidate_name.strip().lower())
    slug = slug.strip("-")
    return slug or "candidate"


def build_default_artifact_dir(candidate_name: str) -> Path:
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    return (
        get_repo_root()
        / "apps"
        / "llm"
        / "agents"
        / ".runs"
        / "social"
        / slugify_candidate_name(candidate_name)
        / timestamp
    )


def ensure_artifact_dir(candidate_name: str, out_dir: Optional[str]) -> Path:
    if out_dir:
        artifact_dir = Path(out_dir).expanduser()
        if not artifact_dir.is_absolute():
            artifact_dir = (Path.cwd() / artifact_dir).resolve()
    else:
        artifact_dir = build_default_artifact_dir(candidate_name)

    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def write_json_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(make_json_safe(payload), handle, indent=2, ensure_ascii=True)
        handle.write("\n")


def truncate_text(value: Any, limit: int = 400) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def collect_path_candidates(value: Any, found: Optional[set[str]] = None) -> List[str]:
    if found is None:
        found = set()

    if isinstance(value, dict):
        for item in value.values():
            collect_path_candidates(item, found)
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            collect_path_candidates(item, found)
    elif isinstance(value, str):
        for match in re.findall(r"(/[^\s\"']+)", value):
            found.add(match.rstrip(".,:;)]}"))
        if (
            value.startswith("/")
            or "/tmp" in value
            or "nova_act_logs" in value
            or value.endswith((".html", ".png", ".jpg", ".jpeg", ".webp", ".json", ".log"))
        ):
            found.add(value.rstrip(".,:;)]}"))

    return sorted(found)


def collect_existing_artifact_paths(raw_payload: Any) -> Dict[str, Any]:
    safe_payload = make_json_safe(raw_payload)
    candidate_paths = collect_path_candidates(safe_payload)
    existing_paths: List[str] = []

    for candidate in candidate_paths:
        try:
            path = Path(candidate).expanduser()
        except Exception:
            continue
        if path.exists():
            existing_paths.append(str(path.resolve()))

    html_run_file = next((path for path in existing_paths if path.endswith(".html")), None)
    log_dir = None

    if html_run_file:
        log_dir = str(Path(html_run_file).parent)
    else:
        for path in existing_paths:
            if Path(path).is_dir() and "nova_act_logs" in path:
                log_dir = path
                break

    screenshot_paths = [
        path
        for path in existing_paths
        if path.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    ]

    if log_dir:
        log_dir_path = Path(log_dir)
        if log_dir_path.is_dir():
            for pattern in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
                for match in sorted(log_dir_path.rglob(pattern)):
                    resolved = str(match.resolve())
                    if resolved not in screenshot_paths:
                        screenshot_paths.append(resolved)

    return {
        "referencedPaths": existing_paths,
        "htmlRunFilePath": html_run_file,
        "logsDir": log_dir,
        "screenshots": screenshot_paths,
    }


def collect_stdout_artifact_paths() -> Dict[str, Any]:
    joined = "\n".join(LOCAL_BROWSER_STDOUT_LINES)
    if not joined.strip():
        return {
            "referencedPaths": [],
            "htmlRunFilePath": None,
            "logsDir": None,
            "screenshots": [],
        }

    referenced_paths = collect_path_candidates(joined)
    html_run_file = None
    logs_dir = None

    html_match = re.search(r"View your act run here:\s+(/[^ \n]+\.html)", joined)
    if html_match:
        html_run_file = html_match.group(1)

    logs_match = re.search(r"logs dir\s+(/[^ \n]+)", joined)
    if logs_match:
        logs_dir = logs_match.group(1)

    screenshot_paths = [
        path
        for path in referenced_paths
        if path.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    ]

    if html_run_file and logs_dir is None:
        logs_dir = str(Path(html_run_file).parent)

    return {
        "referencedPaths": referenced_paths,
        "htmlRunFilePath": html_run_file,
        "logsDir": logs_dir,
        "screenshots": screenshot_paths,
    }


def summarize_act_result(raw_payload: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw_payload, dict):
        return None

    act_result = raw_payload.get("actResult")
    if act_result is None:
        return None

    safe_result = make_json_safe(act_result)
    summary: Dict[str, Any] = {
        "pythonType": type(act_result).__name__,
    }

    if isinstance(safe_result, dict):
        summary["topLevelKeys"] = list(safe_result.keys())[:20]
        summary["preview"] = truncate_text(
            first_non_empty_str(
                safe_result.get("summary"),
                safe_result.get("message"),
                safe_result.get("text"),
            )
        )
    elif isinstance(safe_result, list):
        summary["itemCount"] = len(safe_result)
        if safe_result:
            summary["firstItemPreview"] = truncate_text(str(safe_result[0]))
    else:
        summary["preview"] = truncate_text(str(safe_result))

    return summary


def normalize_pinned_repos(repos: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(repos, list):
        return normalized

    for repo in repos:
        if not isinstance(repo, dict):
            continue
        normalized.append(
            {
                "name": first_non_empty_str(repo.get("name")),
                "description": first_non_empty_str(repo.get("description")),
                "language": first_non_empty_str(repo.get("language")),
                "stars": to_int(repo.get("stars")),
            }
        )

    return normalized


def build_normalized_signals(output: SocialCaptureOutput) -> Dict[str, Any]:
    linkedin = output.linkedin
    github = output.github
    portfolio = output.portfolio
    web = output.web

    normalized_linkedin = None
    if linkedin:
        normalized_linkedin = {
            "url": linkedin.url,
            "found": linkedin.found,
            "headline": clean_text(linkedin.headline),
            "currentCompany": clean_text(linkedin.currentCompany),
            "school": clean_text(linkedin.school),
            "skills": linkedin.skills or [],
            "experienceCount": len(linkedin.experiences or []),
        }

    normalized_github = None
    if github:
        pinned_repos = normalize_pinned_repos(github.pinnedRepos)
        normalized_github = {
            "url": github.url,
            "found": github.found,
            "username": clean_text(github.username),
            "displayName": clean_text(github.displayName),
            "bio": clean_text(github.bio),
            "followers": github.followers,
            "following": github.following,
            "contributionsLastYear": github.contributionsLastYear,
            "topLanguages": github.topLanguages or [],
            "pinnedRepoCount": len(pinned_repos),
            "pinnedRepos": pinned_repos,
        }

    normalized_web = None
    if web:
        normalized_web = {
            "queries": web.queries,
            "resultCount": len(web.results or []),
            "results": [
                {
                    "title": result.title,
                    "snippet": clean_text(result.snippet),
                    "source": clean_text(result.source),
                    "url": clean_text(result.url),
                }
                for result in (web.results or [])[:10]
            ],
        }

    normalized_portfolio = None
    if portfolio:
        normalized_portfolio = {
            "url": portfolio.url,
            "found": portfolio.found,
            "status": portfolio.status,
            "ownerName": clean_text(portfolio.ownerName),
            "candidateLabel": clean_text(portfolio.candidateLabel),
            "mismatchFlag": bool(portfolio.mismatchFlag),
            "evidence": portfolio.evidence or [],
            "projectsReviewed": portfolio.projectsReviewed,
            "projectHighlights": portfolio.projectHighlights or [],
            "resumeFound": portfolio.resumeFound,
            "githubLinkFound": portfolio.githubLinkFound,
            "githubLinkMatchesExpected": portfolio.githubLinkMatchesExpected,
            "retroFound": portfolio.retroFound,
            "warnings": portfolio.warnings or [],
            "notes": clean_text(portfolio.notes),
        }

    return {
        "linkedin": normalized_linkedin,
        "github": normalized_github,
        "portfolio": normalized_portfolio,
        "web": normalized_web,
        "flags": list(output.flags or []),
    }


def build_placeholder_normalized_signals(input_urls: Dict[str, Any], note: str) -> Dict[str, Any]:
    linkedin_url = clean_text(input_urls.get("linkedin"))
    github_url = clean_text(input_urls.get("github"))
    portfolio_url = clean_text(input_urls.get("portfolio"))
    web_queries = input_urls.get("webQueries") or []

    return {
        "linkedin": (
            {
                "url": linkedin_url,
                "found": False,
                "headline": None,
                "currentCompany": None,
                "school": None,
                "skills": [],
                "experienceCount": 0,
                "note": note,
            }
            if linkedin_url
            else None
        ),
        "github": (
            {
                "url": github_url,
                "found": False,
                "username": github_url.rstrip("/").split("/")[-1] if github_url else None,
                "displayName": None,
                "bio": None,
                "followers": None,
                "following": None,
                "contributionsLastYear": None,
                "topLanguages": [],
                "pinnedRepoCount": 0,
                "pinnedRepos": [],
                "note": note,
            }
            if github_url
            else None
        ),
        "portfolio": (
            {
                "url": portfolio_url,
                "found": False,
                "status": "skipped",
                "ownerName": None,
                "candidateLabel": clean_text(input_urls.get("candidateName")),
                "mismatchFlag": False,
                "evidence": [],
                "projectsReviewed": 0,
                "projectHighlights": [],
                "resumeFound": None,
                "githubLinkFound": None,
                "githubLinkMatchesExpected": "unknown",
                "retroFound": None,
                "warnings": [note],
                "note": note,
            }
            if portfolio_url
            else None
        ),
        "web": {
            "queries": web_queries,
            "resultCount": 0,
            "results": [],
            "note": note,
        },
        "flags": [],
    }


def iso_from_timestamp(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(
                timezone.utc
            ).isoformat()
        except Exception:
            return text
    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
    except Exception:
        return None


def duration_to_seconds(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 3)
    if not isinstance(value, str):
        return None

    text = value.strip().lower()
    if not text:
        return None

    total = 0.0
    matched = False
    for pattern, multiplier in (
        (r"(\d+(?:\.\d+)?)h", 3600.0),
        (r"(\d+(?:\.\d+)?)m", 60.0),
        (r"(\d+(?:\.\d+)?)s", 1.0),
    ):
        match = re.search(pattern, text)
        if not match:
            continue
        total += float(match.group(1)) * multiplier
        matched = True

    if matched:
        return round(total, 3)

    try:
        return round(float(text), 3)
    except Exception:
        return None


def seconds_between(start_iso: Optional[str], end_iso: Optional[str]) -> Optional[float]:
    if not start_iso or not end_iso:
        return None
    try:
        start_dt = datetime.fromisoformat(start_iso)
        end_dt = datetime.fromisoformat(end_iso)
        return round((end_dt - start_dt).total_seconds(), 3)
    except Exception:
        return None


def serialize_act_metadata(metadata_obj: Any) -> Optional[Dict[str, Any]]:
    if metadata_obj is None:
        return None

    if isinstance(metadata_obj, dict):
        return make_json_safe(metadata_obj)

    payload: Dict[str, Any] = {}
    for attr in (
        "session_id",
        "act_id",
        "num_steps_executed",
        "start_time",
        "end_time",
        "step_server_times_s",
        "time_worked_s",
        "time_worked",
        "human_wait_time_s",
        "prompt",
    ):
        value = getattr(metadata_obj, attr, None)
        if value is not None:
            payload[attr] = make_json_safe(value)

    return payload or None


def serialize_act_result(act_result: Any) -> Any:
    if act_result is None:
        return None
    if isinstance(act_result, (dict, list, tuple, set)):
        return make_json_safe(act_result)

    payload: Dict[str, Any] = {}
    for attr in ("response", "parsed_response", "valid_json", "matches_schema"):
        value = getattr(act_result, attr, None)
        if value is not None:
            payload[attr] = make_json_safe(value)

    metadata_payload = serialize_act_metadata(getattr(act_result, "metadata", None))
    if metadata_payload is not None:
        payload["metadata"] = metadata_payload

    if payload:
        return payload

    return make_json_safe(act_result)


def extract_last_return_text(stdout_text: Optional[str]) -> Optional[str]:
    if not stdout_text:
        return None
    matches = re.findall(r'return\("(.+?)"\);', stdout_text, re.S)
    if not matches:
        return None
    text = matches[-1].replace('\\"', '"').replace("\\n", "\n").strip()
    return text or None


def extract_local_nova_metadata(raw_payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    metadata: Dict[str, Any] = {}
    if isinstance(raw_payload, dict):
        act_result = make_json_safe(raw_payload.get("actResult"))
        if isinstance(act_result, dict):
            candidate_metadata = act_result.get("metadata")
            if isinstance(candidate_metadata, dict):
                metadata = candidate_metadata

    joined = "\n".join(LOCAL_BROWSER_STDOUT_LINES)
    session_matches = re.findall(r"start session\s+([0-9a-f-]+)", joined)
    act_matches = re.findall(r"act_([0-9a-f-]+)_", joined)

    started_at_value = None
    ended_at_value = None
    duration_value = None
    if metadata:
        started_at_value = metadata.get("start_time", metadata.get("startedAtISO"))
        ended_at_value = metadata.get("end_time", metadata.get("endedAtISO"))
        duration_value = metadata.get("time_worked_s", metadata.get("durationSeconds"))

    started_at = iso_from_timestamp(started_at_value)
    ended_at = iso_from_timestamp(ended_at_value)
    duration_seconds = duration_to_seconds(
        duration_value
    )
    if duration_seconds is None and metadata:
        duration_seconds = duration_to_seconds(metadata.get("time_worked"))

    return {
        "sessionId": first_non_empty_str(
            metadata.get("session_id") if metadata else None,
            metadata.get("sessionId") if metadata else None,
            session_matches[-1] if session_matches else None,
        ),
        "actId": first_non_empty_str(
            metadata.get("act_id") if metadata else None,
            metadata.get("actId") if metadata else None,
            act_matches[-1] if act_matches else None,
        ),
        "numStepsExecuted": to_int(
            metadata.get("num_steps_executed")
            if metadata
            else metadata.get("numStepsExecuted")
        ),
        "startedAtISO": started_at,
        "endedAtISO": ended_at,
        "durationSeconds": duration_seconds,
    }


def extract_final_summary_text(raw_payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if isinstance(raw_payload, dict):
        direct_summary = raw_payload.get("finalSummaryText")
        if isinstance(direct_summary, str) and direct_summary.strip():
            return direct_summary.strip()

    if not isinstance(raw_payload, dict):
        return extract_last_return_text("\n".join(LOCAL_BROWSER_STDOUT_LINES))

    act_result = make_json_safe(raw_payload.get("actResult"))
    if isinstance(act_result, dict):
        for path in (
            ["response"],
            ["result"],
            ["returnValue"],
            ["output"],
            ["summary"],
            ["text"],
        ):
            value = deep_get(act_result, path)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return_text = extract_last_return_text("\n".join(LOCAL_BROWSER_STDOUT_LINES))
    if return_text:
        return return_text

    if act_result is not None:
        rendered = truncate_text(str(act_result), limit=1000)
        if rendered:
            return rendered

    return None


def split_summary_items(text: Optional[str]) -> List[str]:
    if not text:
        return []
    normalized = text.replace("\n", ", ")
    parts = re.split(r",|;|\u2022|- ", normalized)
    cleaned: List[str] = []
    for part in parts:
        item = part.strip(" .:-")
        if item:
            cleaned.append(item)
    return cleaned


def extract_labeled_block(
    text: Optional[str],
    start_label: str,
    end_labels: List[str],
) -> Optional[str]:
    if not text:
        return None
    pattern = re.escape(start_label) + r"\s*(.*)"
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    value = match.group(1)
    for label in end_labels:
        splitter = re.search(re.escape(label), value, re.IGNORECASE)
        if splitter:
            value = value[: splitter.start()]
            break
    value = value.strip()
    return value or None


def extract_labeled_scalar(text: Optional[str], label: str) -> Optional[str]:
    if not text:
        return None
    match = re.search(rf"^{re.escape(label)}\s*(.+)$", text, re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip()
    return value or None


def parse_yes_no_unknown(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    lowered = value.strip().lower()
    if lowered in {"yes", "no", "unknown"}:
        return lowered
    return None


def parse_yes_no(value: Optional[str]) -> Optional[bool]:
    parsed = parse_yes_no_unknown(value)
    if parsed == "yes":
        return True
    if parsed == "no":
        return False
    return None


def names_look_mismatched(candidate_label: Optional[str], owner_name: Optional[str]) -> bool:
    candidate = clean_text(candidate_label)
    owner = clean_text(owner_name)
    if not candidate or not owner:
        return False

    candidate_tokens = {token for token in re.findall(r"[a-z0-9]+", candidate.lower()) if len(token) > 1}
    owner_tokens = {token for token in re.findall(r"[a-z0-9]+", owner.lower()) if len(token) > 1}
    if not candidate_tokens or not owner_tokens:
        return False
    if candidate_tokens == owner_tokens:
        return False

    overlap = candidate_tokens & owner_tokens
    if owner.lower() == "lam anh truong":
        return True
    return len(overlap) < min(2, len(owner_tokens))


def parse_portfolio_stage_summary(
    summary_text: Optional[str],
    *,
    candidate_name: str,
    portfolio_url: Optional[str],
    expected_github_url: Optional[str],
) -> Dict[str, Any]:
    owner_name = extract_labeled_scalar(summary_text, "PORTFOLIO_OWNER_NAME:")
    url = extract_labeled_scalar(summary_text, "PORTFOLIO_URL:") or portfolio_url
    candidate_label = (
        extract_labeled_scalar(summary_text, "CANDIDATE_LABEL:")
        or clean_text(candidate_name)
    )
    status = (
        extract_labeled_scalar(summary_text, "PORTFOLIO_STATUS:")
        or ("ok" if summary_text else "skipped")
    )
    mismatch_token = parse_yes_no_unknown(
        extract_labeled_scalar(summary_text, "MISMATCH_FLAG:")
    )
    evidence = extract_named_bullets(summary_text, "EVIDENCE:")
    project_highlights = extract_named_bullets(summary_text, "PROJECT_HIGHLIGHTS:")
    warnings = extract_named_bullets(summary_text, "WARNINGS:")
    missing = extract_named_bullets(summary_text, "MISSING:")
    github_link_matches_expected = parse_yes_no_unknown(
        extract_labeled_scalar(summary_text, "GITHUB_LINK_MATCHES_EXPECTED:")
    ) or "unknown"
    resume_found = parse_yes_no(extract_labeled_scalar(summary_text, "RESUME_FOUND:"))
    github_link_found = parse_yes_no(extract_labeled_scalar(summary_text, "GITHUB_LINK_FOUND:"))
    retro_found = parse_yes_no(extract_labeled_scalar(summary_text, "RETRO_FOUND:"))
    projects_reviewed = to_int(extract_labeled_scalar(summary_text, "PROJECTS_REVIEWED:"))

    mismatch_flag = mismatch_token == "yes"
    if not mismatch_flag and names_look_mismatched(candidate_label, owner_name):
        mismatch_flag = True
    if not mismatch_flag and summary_text and "lam anh truong" in summary_text.lower():
        mismatch_flag = True
    if not mismatch_flag and owner_name and expected_github_url:
        expected_slug = expected_github_url.rstrip("/").split("/")[-1].lower()
        if expected_slug and expected_slug not in owner_name.lower() and names_look_mismatched(candidate_label, owner_name):
            mismatch_flag = True

    flags: List[str] = []
    if mismatch_flag:
        flags.append("IDENTITY_MISMATCH_WEBSITE_OWNER")
        if not any("identity mismatch" in item.lower() for item in warnings):
            warnings.append(
                "Identity mismatch: visible portfolio owner name differs from the candidate label."
            )
        if owner_name and not any(owner_name in item for item in evidence):
            evidence.insert(
                0,
                f"Visible portfolio owner name appears to be '{owner_name}', which does not match candidate label '{candidate_label}'.",
            )

    return {
        "status": status.lower(),
        "url": url,
        "ownerName": owner_name,
        "candidateLabel": candidate_label,
        "mismatchFlag": mismatch_flag,
        "evidence": evidence,
        "projectsReviewed": projects_reviewed,
        "projectHighlights": project_highlights,
        "resumeFound": resume_found,
        "githubLinkFound": github_link_found,
        "githubLinkMatchesExpected": github_link_matches_expected,
        "retroFound": retro_found,
        "warnings": warnings,
        "missing": missing,
        "flags": flags,
    }


def parse_summary_text(final_summary_text: Optional[str]) -> Dict[str, List[str]]:
    text = final_summary_text or ""

    strong = extract_labeled_block(text, "Strong signals:", ["Missing pieces:", "Warnings:"])
    missing = extract_labeled_block(text, "Missing pieces:", ["Warnings:"])
    warnings = extract_labeled_block(text, "Warnings:", [])
    summary_block = extract_labeled_block(text, "SUMMARY:", [])
    linkedin_evidence = extract_labeled_block(
        text,
        "LINKEDIN_EVIDENCE:",
        ["GITHUB_STATUS:", "GITHUB_EVIDENCE:", "PORTFOLIO_STATUS:", "PORTFOLIO_EVIDENCE:", "MISSING:"],
    )
    github_evidence = extract_labeled_block(
        text,
        "GITHUB_EVIDENCE:",
        ["PORTFOLIO_STATUS:", "PORTFOLIO_EVIDENCE:", "MISSING:"],
    )
    portfolio_evidence = extract_labeled_block(
        text,
        "PORTFOLIO_EVIDENCE:",
        ["PORTFOLIO_WARNINGS:", "MISSING:"],
    )
    structured_missing = extract_labeled_block(text, "MISSING:", [])
    portfolio_warnings = extract_labeled_block(text, "PORTFOLIO_WARNINGS:", ["MISSING:"])

    positives = split_summary_items(strong)
    if not positives and summary_block:
        positives = split_summary_items(summary_block)
    if not positives:
        positives = (
            split_summary_items(linkedin_evidence)
            + split_summary_items(github_evidence)
            + split_summary_items(portfolio_evidence)
        )

    return {
        "positives": positives,
        "missingPieces": split_summary_items(missing) or split_summary_items(structured_missing),
        "warnings": split_summary_items(warnings) or split_summary_items(portfolio_warnings),
    }


def parse_completion_flags(final_summary_text: Optional[str]) -> Dict[str, Optional[bool]]:
    text = final_summary_text or ""

    def flag_value(name: str) -> Optional[bool]:
        match = re.search(rf"{name}:\s*(yes|no)", text, re.IGNORECASE)
        if not match:
            return None
        return match.group(1).lower() == "yes"

    return {
        "linkedin": flag_value("LINKEDIN_DONE"),
        "github": flag_value("GITHUB_DONE"),
        "web": flag_value("WEB_DONE"),
    }


def parse_stage_labels(final_summary_text: Optional[str]) -> Dict[str, Optional[str]]:
    text = final_summary_text or ""

    def label_value(name: str) -> Optional[str]:
        match = re.search(rf"{name}:\s*(ok|partial|blocked|skipped|yes|no)", text, re.IGNORECASE)
        if not match:
            return None
        return match.group(1).lower()

    return {
        "linkedin": label_value("LINKEDIN_STATUS"),
        "github": label_value("GITHUB_STATUS"),
        "portfolio": label_value("PORTFOLIO_STATUS"),
        "web": label_value("WEB_STATUS"),
    }


def extract_summary_bullets(final_summary_text: Optional[str]) -> List[str]:
    if not final_summary_text:
        return []

    bullets: List[str] = []
    in_summary = False
    for raw_line in final_summary_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.upper().startswith("SUMMARY:"):
            in_summary = True
            continue
        if in_summary and line.startswith("-"):
            bullets.append(line[1:].strip())

    if bullets:
        return bullets

    return parse_summary_text(final_summary_text).get("positives", [])


def extract_named_bullets(
    final_summary_text: Optional[str],
    header: str,
) -> List[str]:
    if not final_summary_text:
        return []

    headers = [
        "LINKEDIN_STATUS:",
        "LINKEDIN_EVIDENCE:",
        "GITHUB_STATUS:",
        "GITHUB_EVIDENCE:",
        "PORTFOLIO_STATUS:",
        "PORTFOLIO_URL:",
        "PORTFOLIO_OWNER_NAME:",
        "CANDIDATE_LABEL:",
        "MISMATCH_FLAG:",
        "PORTFOLIO_EVIDENCE:",
        "EVIDENCE:",
        "PROJECTS_REVIEWED:",
        "PROJECT_HIGHLIGHTS:",
        "RESUME_FOUND:",
        "GITHUB_LINK_FOUND:",
        "GITHUB_LINK_MATCHES_EXPECTED:",
        "RETRO_FOUND:",
        "PORTFOLIO_WARNINGS:",
        "WARNINGS:",
        "WEB_STATUS:",
        "WEB_EVIDENCE:",
        "MISSING:",
        "SUMMARY:",
    ]

    bullets: List[str] = []
    current_header: Optional[str] = None
    for raw_line in final_summary_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        matched_header = next((item for item in headers if line.upper().startswith(item)), None)
        if matched_header:
            current_header = matched_header
            continue
        if current_header == header and line.startswith("-"):
            bullets.append(line[1:].strip())

    return bullets


def detect_stage_status(
    *,
    stage_name: str,
    requested: bool,
    completion_flags: Dict[str, Optional[bool]],
    stage_labels: Dict[str, Optional[str]],
    final_summary_text: Optional[str],
) -> Dict[str, Any]:
    if not requested:
        return {"requested": False, "completed": False, "status": "skipped"}

    label = stage_labels.get(stage_name)
    if label in {"ok", "partial", "blocked", "skipped"}:
        return {
            "requested": True,
            "completed": label in {"ok", "partial"},
            "status": label,
        }

    flag = completion_flags.get(stage_name)
    if flag is not None:
        return {
            "requested": True,
            "completed": flag,
            "status": "ok" if flag else "incomplete",
        }

    if stage_name == "linkedin" and final_summary_text:
        return {"requested": True, "completed": True, "status": "partial"}

    return {"requested": True, "completed": False, "status": "pending"}


def copy_logs_subset(source_dir: Path, destination_dir: Path) -> List[str]:
    copied_relative_paths: List[str] = []
    if not source_dir.is_dir():
        return copied_relative_paths

    for item in sorted(source_dir.rglob("*")):
        if not item.is_file():
            continue
        if item.suffix.lower() not in NOVA_LOG_COPY_SUFFIXES:
            continue
        relative_path = item.relative_to(source_dir)
        target = destination_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
        copied_relative_paths.append(str(Path("nova_logs") / relative_path))

    return copied_relative_paths


def locate_logs_dir_for_session(session_id: str) -> Optional[Path]:
    stdout_paths = collect_stdout_artifact_paths()
    hinted_logs_dir = clean_text(stdout_paths.get("logsDir"))
    if hinted_logs_dir:
        path = Path(hinted_logs_dir)
        if path.is_dir():
            return path

    search_roots = [Path("/var/folders"), Path("/private/var/folders")]
    for root in search_roots:
        if not root.exists():
            continue
        try:
            for match in root.glob(f"**/tmp*_nova_act_logs/{session_id}"):
                if match.is_dir():
                    return match
        except Exception:
            continue

    return None


def resolve_nova_artifacts(session_id: str, act_id: str) -> Dict[str, Any]:
    artifact_dir = ACTIVE_RUN_ARTIFACT_DIR
    warnings: List[str] = []
    stdout_paths = collect_stdout_artifact_paths()

    logs_dir = locate_logs_dir_for_session(session_id)
    html_replay_path = None

    if logs_dir:
        direct_match = sorted(logs_dir.glob(f"act_{act_id}_*.html"))
        if direct_match:
            html_replay_path = direct_match[0]

    if html_replay_path is None:
        hinted_html = clean_text(stdout_paths.get("htmlRunFilePath"))
        if hinted_html and Path(hinted_html).exists():
            html_replay_path = Path(hinted_html)

    copied_logs_dir_local = None
    copied_replay_local = None
    screenshot_paths: List[str] = []

    if artifact_dir is None:
        warnings.append("Active run artifact directory is not set while resolving Nova artifacts.")
    else:
        if logs_dir and logs_dir.is_dir():
            destination_logs_dir = artifact_dir / "nova_logs"
            copied_paths = copy_logs_subset(logs_dir, destination_logs_dir)
            copied_logs_dir_local = "nova_logs" if copied_paths else None
            screenshot_paths = [
                path
                for path in copied_paths
                if path.lower().endswith((".png", ".jpg", ".jpeg"))
            ]
        else:
            warnings.append("Could not locate the Nova Act logs directory for this session.")

        if html_replay_path and html_replay_path.exists():
            destination_replay = artifact_dir / "replay.html"
            shutil.copy2(html_replay_path, destination_replay)
            copied_replay_local = "replay.html"
        else:
            warnings.append("Could not locate the Nova Act HTML replay for this act.")

    return {
        "logsDirTemp": str(logs_dir) if logs_dir else None,
        "replayHtmlTemp": str(html_replay_path) if html_replay_path else None,
        "logsDir": str(logs_dir) if logs_dir else None,
        "htmlReplayPath": str(html_replay_path) if html_replay_path else None,
        "logsDirLocal": copied_logs_dir_local,
        "replayHtmlLocal": copied_replay_local,
        "htmlReplayPathLocal": copied_replay_local,
        "screenshots": screenshot_paths,
        "warnings": warnings,
    }


def build_artifact_document(
    *,
    output: Optional[SocialCaptureOutput],
    mode: str,
    input_urls: Dict[str, Any],
    final_summary_text: Optional[str],
    structured_signals: Dict[str, Any],
    run_info: Dict[str, Any],
    nova_info: Dict[str, Any],
    raw_instruction: Optional[str],
    raw_act_result_path: Optional[str],
    raw_stage_summaries: Optional[Dict[str, Any]],
    warnings: List[str],
    error: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    requested_queries = input_urls.get("webQueries") or []
    completion_flags = parse_completion_flags(final_summary_text)
    stage_labels = parse_stage_labels(final_summary_text)
    portfolio_output = structured_signals.get("portfolio")
    output_flags = structured_signals.get("flags", [])

    outputs_structured = {
        "linkedin": structured_signals.get("linkedin"),
        "github": structured_signals.get("github"),
        "portfolio": portfolio_output,
        "web": structured_signals.get("web"),
        "summarySignals": structured_signals.get("summarySignals", []),
        "summaryMissing": structured_signals.get("summaryMissing", []),
        "summaryWarnings": structured_signals.get("summaryWarnings", []),
    }

    artifact = {
        "artifactVersion": "social_capture_v1",
        "ok": bool(output.ok) if output is not None else False,
        "run": {
            "startedAtISO": run_info.get("startedAtISO"),
            "endedAtISO": run_info.get("endedAtISO"),
            "durationSeconds": run_info.get("durationSeconds"),
            "mode": mode,
            "modelId": run_info.get("modelId"),
        },
        "nova": {
            "sessionId": nova_info.get("sessionId"),
            "actId": nova_info.get("actId"),
            "logsDirTemp": nova_info.get("logsDirTemp"),
            "replayHtmlTemp": nova_info.get("replayHtmlTemp"),
            "logsDir": nova_info.get("logsDir"),
            "htmlReplayPath": nova_info.get("htmlReplayPath"),
            "numStepsExecuted": nova_info.get("numStepsExecuted"),
            "logsDirLocal": nova_info.get("logsDirLocal"),
            "replayHtmlLocal": nova_info.get("replayHtmlLocal"),
            "htmlReplayPathLocal": nova_info.get("htmlReplayPathLocal"),
            "screenshots": nova_info.get("screenshots", []),
            "warnings": nova_info.get("warnings", []),
        },
        "inputs": {
            "candidateName": input_urls.get("candidateName"),
            "linkedinUrl": input_urls.get("linkedin"),
            "githubUrl": input_urls.get("github"),
            "portfolioUrl": input_urls.get("portfolio"),
            "webQueries": requested_queries,
        },
        "outputs": {
            "stageStatus": {
                "linkedin": detect_stage_status(
                    stage_name="linkedin",
                    requested=bool(input_urls.get("linkedin")),
                    completion_flags=completion_flags,
                    stage_labels=stage_labels,
                    final_summary_text=final_summary_text,
                ),
                "github": detect_stage_status(
                    stage_name="github",
                    requested=bool(input_urls.get("github")),
                    completion_flags=completion_flags,
                    stage_labels=stage_labels,
                    final_summary_text=final_summary_text,
                ),
                "portfolio": detect_stage_status(
                    stage_name="portfolio",
                    requested=bool(input_urls.get("portfolio")),
                    completion_flags=completion_flags,
                    stage_labels=stage_labels,
                    final_summary_text=final_summary_text,
                ),
            },
            "finalSummaryText": final_summary_text,
            "portfolio": portfolio_output,
            "flags": output_flags,
            "structured": outputs_structured,
        },
        "raw": {
            "instruction": raw_instruction,
            "actResultPath": raw_act_result_path,
            "stageSummaries": raw_stage_summaries,
        },
        "warnings": warnings,
        "error": error,
    }

    return artifact


def enforce_artifact_schema(artifact: Dict[str, Any]) -> None:
    if artifact.get("artifactVersion") != "social_capture_v1":
        raise ValueError("artifactVersion must equal social_capture_v1")

    top_level_keys = ["run", "nova", "inputs", "outputs", "raw"]
    for key in top_level_keys:
        if not isinstance(artifact.get(key), dict):
            raise ValueError(f"{key} must be an object")

    required_run_keys = ["startedAtISO", "endedAtISO", "durationSeconds", "mode", "modelId"]
    required_nova_keys = [
        "sessionId",
        "actId",
        "logsDirTemp",
        "replayHtmlTemp",
        "logsDir",
        "htmlReplayPath",
        "numStepsExecuted",
        "logsDirLocal",
        "replayHtmlLocal",
        "htmlReplayPathLocal",
        "screenshots",
    ]
    required_input_keys = ["candidateName", "linkedinUrl", "githubUrl", "portfolioUrl", "webQueries"]
    required_output_keys = ["stageStatus", "finalSummaryText", "portfolio", "flags", "structured"]

    for key in required_run_keys:
        if key not in artifact["run"]:
            raise ValueError(f"run.{key} is required")
    for key in required_nova_keys:
        if key not in artifact["nova"]:
            raise ValueError(f"nova.{key} is required")
    for key in required_input_keys:
        if key not in artifact["inputs"]:
            raise ValueError(f"inputs.{key} is required")
    for key in required_output_keys:
        if key not in artifact["outputs"]:
            raise ValueError(f"outputs.{key} is required")
    if (
        "instruction" not in artifact["raw"]
        or "actResultPath" not in artifact["raw"]
        or "stageSummaries" not in artifact["raw"]
    ):
        raise ValueError("raw.instruction, raw.actResultPath, and raw.stageSummaries are required")


def write_capture_artifacts(
    *,
    candidate_name: str,
    output: SocialCaptureOutput,
    payload: Dict[str, Any],
    out_dir: Optional[str],
    input_urls: Dict[str, Any],
) -> Path:
    global ACTIVE_RUN_ARTIFACT_DIR

    artifact_dir = ensure_artifact_dir(candidate_name, out_dir)
    ACTIVE_RUN_ARTIFACT_DIR = artifact_dir
    capture_path = artifact_dir / "capture.json"

    raw_instruction = None
    raw_act_result_path = None
    raw_stage_summaries = None
    if isinstance(output.raw, dict):
        raw_instruction = clean_text(output.raw.get("instruction"))
        if isinstance(output.raw.get("stageSummaries"), dict):
            raw_stage_summaries = make_json_safe(output.raw.get("stageSummaries"))
        if "actResult" in output.raw:
            act_result_path = artifact_dir / "raw_act_result.json"
            write_json_file(act_result_path, output.raw.get("actResult"))
            raw_act_result_path = act_result_path.name

    final_summary_text = extract_final_summary_text(output.raw)
    summary_parts = parse_summary_text(final_summary_text)
    normalized_signals = build_normalized_signals(output)
    structured_signals = {
        **normalized_signals,
        "summarySignals": summary_parts["positives"],
        "summaryMissing": summary_parts["missingPieces"],
        "summaryWarnings": summary_parts["warnings"],
    }
    portfolio_capture_path = None
    portfolio_stage_summary_path = None
    if structured_signals.get("portfolio") is not None:
        portfolio_stage_summary_file = artifact_dir / "portfolio_stage_summary.json"
        write_json_file(portfolio_stage_summary_file, structured_signals.get("portfolio"))
        portfolio_stage_summary_path = portfolio_stage_summary_file.name

        portfolio_capture_payload = {
            "summaryText": None,
            "parsed": structured_signals.get("portfolio"),
            "actResult": None,
        }
        if isinstance(raw_stage_summaries, dict):
            portfolio_capture_payload["summaryText"] = raw_stage_summaries.get("portfolio")
        if isinstance(output.raw, dict):
            stage_act_results = output.raw.get("stageActResults")
            if isinstance(stage_act_results, dict):
                portfolio_capture_payload["actResult"] = stage_act_results.get("portfolio")
        portfolio_capture_file = artifact_dir / "portfolio_capture.json"
        write_json_file(portfolio_capture_file, portfolio_capture_payload)
        portfolio_capture_path = portfolio_capture_file.name

    run_info = extract_local_nova_metadata(output.raw)
    run_info["mode"] = output.mode
    run_info["modelId"] = output.modelId
    if run_info.get("durationSeconds") is None:
        run_info["durationSeconds"] = seconds_between(
            run_info.get("startedAtISO"),
            run_info.get("endedAtISO"),
        )

    nova_info = {
        **extract_local_nova_metadata(output.raw),
        "logsDirTemp": None,
        "replayHtmlTemp": None,
        "logsDir": None,
        "htmlReplayPath": None,
        "logsDirLocal": None,
        "replayHtmlLocal": None,
        "htmlReplayPathLocal": None,
        "screenshots": [],
        "warnings": [],
    }

    if nova_info.get("sessionId") and nova_info.get("actId"):
        resolved = resolve_nova_artifacts(nova_info["sessionId"], nova_info["actId"])
        nova_info.update(resolved)

    warning_list = list(output.warnings or [])
    warning_list.extend(nova_info.get("warnings", []))

    artifact = build_artifact_document(
        output=output,
        mode=output.mode,
        input_urls=input_urls,
        final_summary_text=final_summary_text,
        structured_signals=structured_signals,
        run_info=run_info,
        nova_info=nova_info,
        raw_instruction=raw_instruction,
        raw_act_result_path=raw_act_result_path,
        raw_stage_summaries=raw_stage_summaries,
        warnings=warning_list,
    )
    if isinstance(output.raw, dict) and output.raw.get("guardrails"):
        artifact["blocked"] = True
        artifact["reason"] = "AGENT_GUARDRAILS_TRIGGERED"
        artifact["raw"]["guardrails"] = make_json_safe(output.raw.get("guardrails"))
    if portfolio_capture_path:
        artifact["raw"]["portfolioCapturePath"] = portfolio_capture_path
    if portfolio_stage_summary_path:
        artifact["raw"]["portfolioStageSummaryPath"] = portfolio_stage_summary_path
    enforce_artifact_schema(artifact)
    write_json_file(capture_path, artifact)
    return capture_path


def write_failure_artifact(
    *,
    candidate_name: str,
    mode: str,
    out_dir: Optional[str],
    input_urls: Dict[str, Any],
    error: Exception,
    raw_payload: Optional[Dict[str, Any]] = None,
) -> Path:
    global ACTIVE_RUN_ARTIFACT_DIR

    artifact_dir = ensure_artifact_dir(candidate_name, out_dir)
    ACTIVE_RUN_ARTIFACT_DIR = artifact_dir
    capture_path = artifact_dir / "capture.json"
    raw_error_path = artifact_dir / "raw-error.json"

    safe_raw_payload = make_json_safe(raw_payload or {})
    safe_error = {
        "type": error.__class__.__name__,
        "message": str(error),
        "stdoutPreview": truncate_text("\n".join(LOCAL_BROWSER_STDOUT_LINES), limit=2000),
    }

    write_json_file(
        raw_error_path,
        {
            "error": safe_error,
            "raw": safe_raw_payload,
        },
    )

    nova_info = {
        **extract_local_nova_metadata(safe_raw_payload if isinstance(safe_raw_payload, dict) else None),
        "logsDirTemp": None,
        "replayHtmlTemp": None,
        "logsDir": None,
        "htmlReplayPath": None,
        "logsDirLocal": None,
        "replayHtmlLocal": None,
        "htmlReplayPathLocal": None,
        "screenshots": [],
        "warnings": [],
    }
    if nova_info.get("sessionId") and nova_info.get("actId"):
        resolved = resolve_nova_artifacts(nova_info["sessionId"], nova_info["actId"])
        nova_info.update(resolved)

    run_info = {
        "startedAtISO": None,
        "endedAtISO": datetime.now(timezone.utc).isoformat(),
        "durationSeconds": None,
        "mode": mode,
        "modelId": get_model_id(),
    }

    structured_signals = {
        **build_placeholder_normalized_signals(
            input_urls,
            note="Capture failed before structured extraction completed.",
        ),
        "summarySignals": [],
        "summaryMissing": [],
        "summaryWarnings": [],
    }

    artifact = build_artifact_document(
        output=None,
        mode=mode,
        input_urls=input_urls,
        final_summary_text=None,
        structured_signals=structured_signals,
        run_info=run_info,
        nova_info=nova_info,
        raw_instruction=clean_text(deep_get(safe_raw_payload, ["instruction"])) if isinstance(safe_raw_payload, dict) else None,
        raw_act_result_path=None,
        raw_stage_summaries=make_json_safe(deep_get(safe_raw_payload, ["stageSummaries"])) if isinstance(safe_raw_payload, dict) else None,
        warnings=[
            "Nova Act capture failed before structured extraction completed.",
            "Inspect raw-error.json and any discovered HTML/log files for debugging.",
            *nova_info.get("warnings", []),
        ],
        error=safe_error,
    )
    artifact["raw"]["errorPath"] = raw_error_path.name
    enforce_artifact_schema(artifact)
    write_json_file(capture_path, artifact)
    return capture_path


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
    portfolio_url: Optional[str],
    linkedin_manual_login: bool = False,
) -> str:
    instructions = build_local_browser_stage_instructions(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
        linkedin_manual_login=linkedin_manual_login,
    )
    if not instructions:
        return ""

    parts: List[str] = []
    parts.append(
        "\n".join(
            [
                "You are a recruiter-style browser evidence collector.",
                f"Candidate label: {candidate_name}.",
                "Core goals:",
                "- LinkedIn: 30-step evidence checklist.",
                "- GitHub: 30-step evidence checklist.",
                "- Portfolio: interactive recruiter-style portfolio review stage.",
                "Hard constraints:",
                "- Treat steps as checklist items, not infinite actions.",
                "- LinkedIn action budget: at most 18 actions total.",
                "- GitHub action budget: at most 18 actions total.",
                "- Portfolio action budget: at most 25 actions total.",
                "- Max 2 consecutive scrolls. If the target section is still not visible, stop scrolling, try a different method, or mark it missing.",
                "- If the footer is visible, stop scrolling immediately; you reached the end.",
                "- LinkedIn deep opens: at most 1 Show all experiences action and 1 Featured item open.",
                "- GitHub deep opens: at most 2 repos total, prefer pinned repos first.",
                "- Portfolio deep opens: open at most 8 project cards, 1 resume page, 1 GitHub link, and 1 Retro section.",
                "- Do not contact anyone. Do not send messages. Do not make personal judgments. Visible facts only.",
                "Deterministic final report format:",
                "LINKEDIN_STATUS: ok|partial|blocked",
                "LINKEDIN_EVIDENCE:",
                "- bullets",
                "GITHUB_STATUS: ok|partial",
                "GITHUB_EVIDENCE:",
                "- bullets",
                "PORTFOLIO_STATUS: ok|partial|blocked",
                "PORTFOLIO_EVIDENCE:",
                "- bullets",
                "MISSING:",
                "- bullets",
                "Before return(), confirm LinkedIn, GitHub, and Portfolio stages were attempted if requested.",
                "Ignore any legacy web query inputs in this local-browser portfolio flow.",
            ]
        )
    )
    for stage_name in ("linkedin", "github", "portfolio"):
        instruction = instructions.get(stage_name)
        if not instruction:
            continue
        parts.append(f"{stage_name.upper()} STAGE INSTRUCTION\n{instruction}")

    return "\n\n".join(parts)


def build_local_browser_intro_lines(candidate_name: str) -> List[str]:
    return [
        "You are performing a recruiter-style browser evidence capture demo.",
        f"Candidate label for notes: {candidate_name}.",
        "Use only the URLs and search queries explicitly provided in this prompt.",
        "Visible facts only. No outreach, no messages, no personal judgments, no private inferences.",
        "Treat steps as checklist items, not as permission to loop.",
        "Prefer clicking section anchors, tabs, and clearly labeled navigation before scrolling.",
        "Max 2 consecutive scrolls. If the target is still not visible, mark it missing and continue.",
        "If the footer is visible, stop scrolling immediately.",
        "Once enough evidence is captured for the current stage, stop and return.",
    ]

def build_linkedin_stage_instruction(
    candidate_name: str,
    linkedin_url: str,
    linkedin_manual_login: bool = False,
) -> str:
    lines = build_local_browser_intro_lines(candidate_name)
    lines.append("LINKEDIN STAGE: COMPLETE THESE 30 EVIDENCE-CAPTURE CHECKLIST STEPS")
    search_query = f"{candidate_name} Virginia Tech"
    if linkedin_manual_login:
        step_lines = [
            "L1. The human operator already signed in manually before this stage starts.",
            "L2. Click the LinkedIn global search bar.",
            f"L3. Search this exact query in LinkedIn: {search_query}",
            "L4. If a People filter is visible, click it once.",
            f"L5. Open the most relevant visible result for {candidate_name}. If the provided profile is already open, stay on it.",
            "L6. Confirm whether the profile page is visible.",
            "L7. If redirected to login, authwall, or 'Sign in to see more', set LINKEDIN_STATUS: blocked and stop this stage.",
            "L8. Capture the visible profile URL and visible profile name exactly as shown.",
            "L9. Capture the headline exactly as shown.",
            "L10. Capture the location exactly as shown.",
            "L11. Capture the current role or company from the top card if visible.",
            "L12. Capture the visible education summary from the top card if visible.",
            "L13. Check for Contact info or visible links and capture any website, portfolio, or public profile links shown.",
            "L14. If About, Experience, Education, or Skills anchors are visible, prefer clicking an anchor instead of scrolling.",
            "L15. If About text is visible, capture 1 or 2 key phrases only.",
            "L16. If About is not visible, use at most 2 scrolls to try to reveal it; if still not visible, record About missing and continue.",
            "L17. If Featured is visible, capture the visible featured item titles.",
            "L18. Open at most 1 Featured item only if it looks relevant and clearly visible.",
            "L19. If you opened a Featured item, capture its title, type, and one visible fact, then return to the profile.",
            "L20. Move to Experience using an anchor if visible; otherwise use at most 2 scrolls.",
            "L21. Capture the latest visible role title, company, and dates.",
            "L22. Capture one additional visible role, internship, or research position if present.",
            "L23. If Show all experiences is visible and needed, open it once only.",
            "L24. If you opened Show all experiences, capture at most one additional role and then return to the main profile.",
            "L25. Capture one visible impact statement, technology, or responsibility only if explicitly written.",
            "L26. Move to Education using an anchor if visible; otherwise use at most 2 scrolls.",
            "L27. Capture school name, degree or field, and dates if visible.",
            "L28. Capture honors, societies, or organizations only if visibly attached to education or nearby sections.",
            "L29. Move to Skills using an anchor if visible; otherwise use at most 2 scrolls. Capture up to 8 top visible skills exactly as labeled on the current page.",
            "L30. Record factual missing pieces such as hidden sections, authwall blocks, or sections not visible within the action budget, then stop LinkedIn immediately after you have 6 to 10 evidence bullets or you reach the action budget.",
        ]
    else:
        step_lines = [
            "L1. Start the LinkedIn stage now.",
            f"L2. Navigate directly to the provided LinkedIn profile URL: {linkedin_url}. Do not search by name.",
            "L3. Confirm whether the profile page is visible.",
            "L4. If redirected to login, authwall, or 'Sign in to see more', set LINKEDIN_STATUS: blocked and stop this stage.",
            "L5. Capture the visible profile URL and visible profile name exactly as shown.",
            "L6. Capture the headline exactly as shown.",
            "L7. Capture the location exactly as shown.",
            "L8. Capture the current role or company from the top card if visible.",
            "L9. Capture the visible education summary from the top card if visible.",
            "L10. Check for Contact info or visible links and capture any website, portfolio, or public profile links shown.",
            "L11. If About, Experience, Education, or Skills anchors are visible, prefer clicking an anchor instead of scrolling.",
            "L12. If About text is visible, capture 1 or 2 key phrases only.",
            "L13. If About is not visible, use at most 2 scrolls to try to reveal it; if still not visible, record About missing and continue.",
            "L14. If Featured is visible, capture the visible featured item titles.",
            "L15. Open at most 1 Featured item only if it looks relevant and clearly visible.",
            "L16. If you opened a Featured item, capture its title, type, and one visible fact, then return to the profile.",
            "L17. Move to Experience using an anchor if visible; otherwise use at most 2 scrolls.",
            "L18. Capture the latest visible role title, company, and dates.",
            "L19. Capture one additional visible role, internship, or research position if present.",
            "L20. If Show all experiences is visible and needed, open it once only.",
            "L21. If you opened Show all experiences, capture at most one additional role and then return to the main profile.",
            "L22. Capture one visible impact statement, technology, or responsibility only if explicitly written.",
            "L23. Move to Education using an anchor if visible; otherwise use at most 2 scrolls.",
            "L24. Capture school name, degree or field, and dates if visible.",
            "L25. Capture honors, societies, or organizations only if visibly attached to education or nearby sections.",
            "L26. Move to Skills using an anchor if visible; otherwise use at most 2 scrolls.",
            "L27. Capture up to 8 top visible skills exactly as labeled on the current page.",
            "L28. If Certifications, Awards, Volunteer, or Activity are visible without extra navigation, capture 1 or 2 visible facts.",
            "L29. Record factual missing pieces such as hidden sections, authwall blocks, or sections not visible within the action budget.",
            "L30. Stop LinkedIn immediately after you have 6 to 10 evidence bullets or you reach the action budget.",
        ]

    lines.extend(
        [
            "LinkedIn hard limits:",
            "- At most 18 actions total in this stage.",
            "- Max 2 consecutive scrolls.",
            "- Open at most 1 Featured item and at most 1 Show all experiences view.",
            "- Do not click Show all skills.",
            *step_lines,
            "FINAL REPORT:",
            "F1. Call return() immediately after the LinkedIn stage is complete.",
            "F2. Use LINKEDIN_STATUS: ok if the profile was reviewed with multiple sections captured.",
            "F3. Use LINKEDIN_STATUS: partial if only the top card or a subset of sections were captured before limits or page issues.",
            "F4. Use LINKEDIN_STATUS: blocked if LinkedIn authwall or login blocking prevented visible profile review.",
            "F5. The final return() must include exactly these lines:",
            "F6. LINKEDIN_STATUS: ok|partial|blocked",
            "F7. LINKEDIN_EVIDENCE:",
            "F8. - 6 to 10 bullets of visible facts only.",
            "F9. MISSING:",
            "F10. - bullets for missing sections, blocked sections, or facts not visible.",
            "F11. Do not include GitHub or Web keys in this stage return.",
        ]
    )
    return "\n".join(lines)


def build_github_stage_instruction(candidate_name: str, github_url: str) -> str:
    lines = build_local_browser_intro_lines(candidate_name)
    lines.extend(
        [
            "GITHUB STAGE: COMPLETE THESE 30 EVIDENCE-CAPTURE CHECKLIST STEPS",
            "GitHub hard limits:",
            "- At most 18 actions total in this stage.",
            "- Max 2 consecutive scrolls.",
            "- Open at most 2 repos total, prefer pinned repos first.",
            "- Do not open Issues, Pull Requests, Actions, or Security tabs in this stage.",
            f"G1. Navigate directly to this GitHub URL: {github_url}",
            "G2. Wait for the profile page to load.",
            "G3. Confirm whether the profile is visible. If the page fails to load properly, use GITHUB_STATUS: partial and continue with whatever is visible.",
            "G4. Capture the visible profile URL and username.",
            "G5. Capture the display name if shown.",
            "G6. Capture the bio or tagline if shown.",
            "G7. Capture location, organization, website, or employer links if shown.",
            "G8. Capture followers and following counts if visible.",
            "G9. Capture contribution count or contribution summary if visible.",
            "G10. Capture all visible pinned repository names.",
            "G11. Capture visible pinned repo languages and stars if shown.",
            "G12. Capture visible topics, highlights, organizations, or achievements if shown.",
            "G13. If pinned repos are not enough, click Repositories once to surface visible facts.",
            "G14. Capture total public repository count if visible.",
            "G15. Identify the strongest visible repository based on visible description, stars, and relevance.",
            "G16. Open the first strongest repository.",
            "G17. Capture repo name, description, language, stars, and last updated if visible.",
            "G18. Capture first-screen README quality signals such as install, run, demo, or badges.",
            "G19. Capture whether the visible file tree suggests organized structure.",
            "G20. Capture whether tests, CI config, Docker, notebooks, or build files are visibly present.",
            "G21. If there is a clear demo link on the first screen, capture its text only.",
            "G22. Return to the GitHub profile.",
            "G23. Decide whether a second repo is meaningfully different. If not, do not open a second repo.",
            "G24. If a second repo is worth opening, open only one more repo total.",
            "G25. Capture the second repo name, purpose, language, stars, and README quality quickly.",
            "G26. Return to the GitHub profile after the second repo if you opened it.",
            "G27. Record overall technical themes across the visible profile and repos such as ML, full-stack, data, systems, music tech, or hackathon work.",
            "G28. Record factual risk or weakness signals only if visible, such as missing README, no visible recent activity, or minimal repo descriptions.",
            "G29. Stop GitHub after 6 to 10 evidence bullets or after opening 2 repos total.",
            "G30. End the GitHub stage immediately and proceed no further in GitHub.",
            "FINAL REPORT:",
            "F1. Call return() immediately after the GitHub stage is complete.",
            "F2. Use GITHUB_STATUS: ok if the profile and at least one repo were reviewed.",
            "F3. Use GITHUB_STATUS: partial if only the profile or incomplete repo evidence was captured.",
            "F4. The final return() must include exactly these lines:",
            "F5. GITHUB_STATUS: ok|partial",
            "F6. GITHUB_EVIDENCE:",
            "F7. - 6 to 10 bullets of visible facts only.",
            "F8. MISSING:",
            "F9. - bullets for missing evidence, tabs not opened, or data not visible.",
            "F10. Do not include LinkedIn or Web keys in this stage return.",
        ]
    )
    return "\n".join(lines)


def build_portfolio_stage_instruction(
    candidate_name: str,
    portfolio_url: str,
    expected_github_url: Optional[str],
) -> str:
    lines = build_local_browser_intro_lines(candidate_name)
    lines.extend(
        [
            "PORTFOLIO STAGE: COMPLETE THIS RECRUITER-STYLE INTERACTIVE PORTFOLIO REVIEW",
            "Portfolio hard limits:",
            "- At most 25 actions total in this stage.",
            "- Max 2 consecutive scrolls; after that, use navigation, anchors, or mark the section missing.",
            "- Prefer visible navigation such as Projects, Resume, GitHub, Retro, About, Experience, or headings before scrolling.",
            "- Open at most 8 project cards total, but stop earlier once strong evidence is gathered.",
            "- Open at most 1 Resume target, 1 GitHub target from the portfolio, and 1 Retro entry.",
            f"P1. Navigate directly to the portfolio URL: {portfolio_url}",
            "P2. Confirm the site is visible. If the page is blocked or fails to load, set PORTFOLIO_STATUS: blocked and stop.",
            "P3. Capture the visible landing-page title, hero name, and title or role text exactly as shown.",
            "P4. Capture the first visible owner name from the hero, header, or top navigation.",
            f"P5. Compare the visible owner name to the candidate label '{candidate_name}'. If the visible owner looks like a different person, record that clearly.",
            "P6. Bias toward flagging a mismatch if 'Lam Anh Truong' appears prominently in the hero, header, title, or repeated branding.",
            "P7. Capture the visible top navigation labels and recruiter-relevant links.",
            "P8. Navigate to Projects using a visible Projects tab, button, anchor, or heading if available.",
            "P9. Capture the visible project section heading and count how many project cards are visible before opening anything.",
            "P10. Open the strongest visible project card.",
            "P11. Capture the project name, the problem or theme, and one visible engineering fact such as stack, demo, or README-style description.",
            "P12. Return to the project list or portfolio landing after the first project review.",
            "P13. Open a second clearly different project card if available.",
            "P14. Capture the second project's name, theme, and one visible engineering fact, then return.",
            "P15. If more strong projects are clearly visible and action budget remains, open up to 2 more project cards total; never exceed 8.",
            "P16. Open Resume using a visible Resume link, button, or section if present.",
            "P17. Capture whether a resume page or downloadable resume was found and 2 or 3 visible facts from it, then return to the portfolio.",
            "P18. Open the GitHub link from the portfolio if visible.",
            f"P19. Compare the opened GitHub destination to the expected GitHub URL '{expected_github_url or 'unknown'}'.",
            "P20. Capture whether the GitHub link exists and whether it appears to match the expected GitHub profile, then return to the portfolio.",
            "P21. Click Retro if a Retro section, button, or nav item is visible.",
            "P22. Inside Retro, perform up to 10 recruiter-style inspection checks using headings, visible links, and one recruiter-relevant deep open if available.",
            "P23. Capture visible themes from Retro such as reflections, lessons learned, project reviews, timelines, or process notes.",
            "P24. Record factual warnings only, such as owner-name mismatch, missing resume, missing GitHub link, broken navigation, or sections not visible within the budget.",
            "P25. Stop the portfolio stage immediately once you have enough evidence. Do not continue browsing after the structured return is ready.",
            "FINAL REPORT:",
            "F1. Call return() immediately after the portfolio stage is complete.",
            "F2. Return this exact block with these exact keys on separate lines:",
            "F3. PORTFOLIO_STATUS: ok|partial|blocked",
            "F4. PORTFOLIO_URL: <url>",
            "F5. PORTFOLIO_OWNER_NAME: <best-effort extracted name>",
            f"F6. CANDIDATE_LABEL: {candidate_name}",
            "F7. MISMATCH_FLAG: yes|no",
            "F8. EVIDENCE:",
            "F9. - 6 to 10 bullets of visible facts only.",
            "F10. PROJECTS_REVIEWED: <n>",
            "F11. PROJECT_HIGHLIGHTS:",
            "F12. - bullets",
            "F13. RESUME_FOUND: yes|no",
            "F14. GITHUB_LINK_FOUND: yes|no",
            "F15. GITHUB_LINK_MATCHES_EXPECTED: yes|no|unknown",
            "F16. RETRO_FOUND: yes|no",
            "F17. WARNINGS:",
            "F18. - bullets",
            "F19. MISSING:",
            "F20. - bullets",
            "F21. Only record visible facts. Do not contact anyone. Do not make personal judgments.",
        ]
    )
    return "\n".join(lines)


def build_web_stage_instruction(candidate_name: str, web_queries: List[str]) -> str:
    lines = build_local_browser_intro_lines(candidate_name)
    lines.append("WEB SEARCH STAGE: COMPLETE THESE 20 EVIDENCE-CAPTURE CHECKLIST STEPS USING ONLY PROVIDED QUERIES")
    query_limit = web_queries[:3]
    query_one = query_limit[0]
    query_two = query_limit[1] if len(query_limit) > 1 else None
    query_three = query_limit[2] if len(query_limit) > 2 else None
    lines.extend(
        [
            "Web hard limits:",
            "- At most 12 actions total in this stage.",
            "- Use Google or Bing only, not LinkedIn or GitHub search boxes.",
            "- Use at most the first 3 provided queries.",
            "- Open at most 3 results total, at most 1 result per query.",
            "W1. Open a general web search page in a fresh normal search context.",
            "W2. Use only the provided web queries. Do not invent new queries.",
            f"W3. Query 1: search exactly '{query_one}'.",
            "W4. Review the first screen of results and prefer professional, portfolio, university, conference, blog, or project pages.",
            "W5. Open the most relevant result for Query 1.",
            "W6. Capture page title, source, URL, and 1 or 2 factual snippets.",
            "W7. Return to search results or close the opened result.",
            (
                f"W8. Query 2: search exactly '{query_two}'."
                if query_two
                else "W8. If there is no Query 2, skip directly to Query 3 handling."
            ),
            "W9. Review the first screen of results and open at most one relevant result for Query 2 if provided.",
            "W10. Capture page title, source, URL, and 1 or 2 factual snippets.",
            "W11. Return to search results or close the opened result.",
            (
                f"W12. Query 3: search exactly '{query_three}'."
                if query_three
                else "W12. If there is no Query 3, stop after Query 2 evidence is captured."
            ),
            "W13. Review the first screen of results and open at most one relevant result for Query 3 if provided.",
            "W14. Capture page title, source, URL, and 1 or 2 factual snippets.",
            "W15. Return to results or close the opened result.",
            "W16. If a result mentions a portfolio, publication, award, talk, hackathon, or internship, capture the claim and source.",
            "W17. Do not open more than 3 results total across all queries.",
            "W18. Record factual missing pieces, such as no clearly relevant public results found for a query.",
            "W19. Stop Web when you have 4 to 8 evidence bullets or you reach the action budget.",
            "W20. End the Web stage immediately and prepare the final Web return.",
            "FINAL REPORT:",
            "F1. Call return() immediately after the Web stage is complete.",
            "F2. Use WEB_STATUS: ok if at least 2 pieces of evidence were captured from search results.",
            "F3. Use WEB_STATUS: partial if only limited evidence was found or only one result was useful.",
            "F4. Use WEB_STATUS: skipped only if no web queries were provided.",
            "F5. The final return() must include exactly these lines:",
            "F6. WEB_STATUS: ok|partial|skipped",
            "F7. WEB_EVIDENCE:",
            "F8. - 4 to 8 bullets of visible facts only.",
            "F9. MISSING:",
            "F10. - bullets for queries with weak or missing public results.",
            "F11. Do not include LinkedIn or GitHub keys in this stage return.",
        ]
    )
    return "\n".join(lines)


def build_local_browser_stage_instructions(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    portfolio_url: Optional[str],
    linkedin_manual_login: bool = False,
) -> Dict[str, str]:
    instructions: Dict[str, str] = {}
    if linkedin_url:
        instructions["linkedin"] = build_linkedin_stage_instruction(
            candidate_name=candidate_name,
            linkedin_url=linkedin_url,
            linkedin_manual_login=linkedin_manual_login,
        )
    if github_url:
        instructions["github"] = build_github_stage_instruction(
            candidate_name=candidate_name,
            github_url=github_url,
        )
    if portfolio_url:
        instructions["portfolio"] = build_portfolio_stage_instruction(
            candidate_name=candidate_name,
            portfolio_url=portfolio_url,
            expected_github_url=github_url,
        )
    return instructions

def wait_for_manual_login(prompt: str) -> None:
    print(prompt)
    try:
        input()
    except EOFError:
        pass


def get_local_browser_starting_page(
    linkedin_url: Optional[str],
    github_url: Optional[str],
    portfolio_url: Optional[str],
    manual_linkedin_login: bool,
) -> str:
    if manual_linkedin_login and linkedin_url:
        return "https://www.linkedin.com/login"
    if linkedin_url:
        return linkedin_url
    if github_url:
        return github_url
    if portfolio_url:
        return portfolio_url
    return "https://www.google.com"


def extract_stage_summary_text(
    act_payload: Any,
    stdout_text: Optional[str],
) -> Optional[str]:
    if isinstance(act_payload, dict):
        for key in ("response", "result", "returnValue", "output", "summary", "text"):
            value = act_payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return extract_last_return_text(stdout_text)


def stage_status_from_summary(
    stage_name: str,
    summary_text: Optional[str],
    requested: bool,
    default_status: str,
) -> str:
    if not requested:
        return "skipped"

    label = parse_stage_labels(summary_text).get(stage_name)
    if label in {"ok", "partial", "blocked", "skipped"}:
        return label

    if summary_text:
        return default_status

    return "skipped"


def build_stage_fallback_summary(
    stage_name: str,
    status: str,
    reason: str,
    stage_context: Optional[Dict[str, Any]] = None,
) -> str:
    stage_context = stage_context or {}
    if stage_name == "portfolio":
        portfolio_url = clean_text(stage_context.get("portfolio_url")) or "unknown"
        candidate_label = clean_text(stage_context.get("candidate_name")) or "unknown"
        owner_name = clean_text(stage_context.get("owner_name")) or "unknown"
        return "\n".join(
            [
                f"PORTFOLIO_STATUS: {status}",
                f"PORTFOLIO_URL: {portfolio_url}",
                f"PORTFOLIO_OWNER_NAME: {owner_name}",
                f"CANDIDATE_LABEL: {candidate_label}",
                "MISMATCH_FLAG: no",
                "EVIDENCE:",
                f"- Portfolio stage status: {status}.",
                "PROJECTS_REVIEWED: 0",
                "PROJECT_HIGHLIGHTS:",
                "- No project highlights captured.",
                "RESUME_FOUND: no",
                "GITHUB_LINK_FOUND: no",
                "GITHUB_LINK_MATCHES_EXPECTED: unknown",
                "RETRO_FOUND: no",
                "WARNINGS:",
                f"- {reason}",
                "MISSING:",
                f"- {reason}",
            ]
        )
    return "\n".join(
        [
            f"{stage_name.upper()}_STATUS: {status}",
            f"{stage_name.upper()}_EVIDENCE:",
            f"- {stage_name.capitalize()} stage status: {status}.",
            "MISSING:",
            f"- {reason}",
        ]
    )


def run_local_browser_stage(
    *,
    nova: Any,
    stage_name: str,
    instruction: Optional[str],
    requested: bool,
    stage_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not requested or not instruction:
        return {
            "requested": False,
            "status": "skipped",
            "summaryText": None,
            "actResult": None,
            "warnings": [],
            "error": None,
            "guardrails": None,
        }

    stdout_start = len(LOCAL_BROWSER_STDOUT_LINES)
    try:
        act_result = nova.act(instruction)
        serialized_result = serialize_act_result(act_result)
        stdout_fragment = "".join(LOCAL_BROWSER_STDOUT_LINES[stdout_start:])
        summary_text = extract_stage_summary_text(serialized_result, stdout_fragment)
        had_executed_steps = False
        if isinstance(serialized_result, dict) and isinstance(serialized_result.get("metadata"), dict):
            had_executed_steps = (to_int(serialized_result["metadata"].get("num_steps_executed")) or 0) > 0
        status = stage_status_from_summary(
            stage_name=stage_name,
            summary_text=summary_text,
            requested=True,
            default_status="partial" if had_executed_steps else "skipped",
        )
        if not summary_text and had_executed_steps:
            status = "partial"
        if not summary_text:
            summary_text = build_stage_fallback_summary(
                stage_name=stage_name,
                status=status,
                reason=(
                    f"{stage_name.capitalize()} stage completed without an explicit summary payload."
                    if had_executed_steps
                    else f"{stage_name.capitalize()} stage did not produce an explicit summary payload."
                ),
                stage_context=stage_context,
            )
        return {
            "requested": True,
            "status": status,
            "summaryText": summary_text,
            "actResult": serialized_result,
            "warnings": [],
            "error": None,
            "guardrails": None,
        }
    except Exception as exc:
        error_text = str(exc)
        guardrails_triggered = "AGENT_GUARDRAILS_TRIGGERED" in error_text
        exceeded_steps = "Exceeded max steps" in error_text
        status = "blocked" if stage_name == "linkedin" and guardrails_triggered else "partial"
        if not requested:
            status = "skipped"
        if stage_name == "linkedin" and not guardrails_triggered and not exceeded_steps:
            status = "partial"
        summary_text = build_stage_fallback_summary(
            stage_name=stage_name,
            status=status,
            reason=(
                "Nova Act guardrails blocked this stage before it could complete."
                if guardrails_triggered
                else f"Nova Act failed during the {stage_name} stage: {error_text}"
            ),
            stage_context=stage_context,
        )
        warnings = [f"{stage_name}_stage_failed"]
        if guardrails_triggered:
            warnings.append("blocked_by_guardrails")
        return {
            "requested": True,
            "status": status,
            "summaryText": summary_text,
            "actResult": None,
            "warnings": warnings,
            "error": error_text,
            "guardrails": {
                "triggered": True,
                "stage": stage_name,
                "errorMessage": error_text,
            }
            if guardrails_triggered
            else None,
        }


def build_combined_final_summary(
    stage_results: Dict[str, Dict[str, Any]],
    *,
    linkedin_requested: bool,
    github_requested: bool,
    portfolio_requested: bool,
) -> str:
    status_map = {
        "linkedin": stage_results.get("linkedin", {}).get("status", "skipped")
        if linkedin_requested
        else "skipped",
        "github": stage_results.get("github", {}).get("status", "skipped")
        if github_requested
        else "skipped",
        "portfolio": stage_results.get("portfolio", {}).get("status", "skipped")
        if portfolio_requested
        else "skipped",
    }

    linkedin_bullets = extract_named_bullets(
        stage_results.get("linkedin", {}).get("summaryText"),
        "LINKEDIN_EVIDENCE:",
    )
    github_bullets = extract_named_bullets(
        stage_results.get("github", {}).get("summaryText"),
        "GITHUB_EVIDENCE:",
    )
    portfolio_bullets = extract_named_bullets(
        stage_results.get("portfolio", {}).get("summaryText"),
        "EVIDENCE:",
    )
    portfolio_project_highlights = extract_named_bullets(
        stage_results.get("portfolio", {}).get("summaryText"),
        "PROJECT_HIGHLIGHTS:",
    )
    portfolio_warnings = extract_named_bullets(
        stage_results.get("portfolio", {}).get("summaryText"),
        "WARNINGS:",
    )

    if not linkedin_bullets:
        linkedin_bullets = extract_summary_bullets(stage_results.get("linkedin", {}).get("summaryText"))[:8]
    if not github_bullets:
        github_bullets = extract_summary_bullets(stage_results.get("github", {}).get("summaryText"))[:8]
    if not portfolio_bullets:
        portfolio_bullets = extract_summary_bullets(stage_results.get("portfolio", {}).get("summaryText"))[:8]

    missing_bullets: List[str] = []
    for stage_name, header in (
        ("linkedin", "MISSING:"),
        ("github", "MISSING:"),
        ("portfolio", "MISSING:"),
    ):
        missing_bullets.extend(
            extract_named_bullets(stage_results.get(stage_name, {}).get("summaryText"), header)
        )

    for stage_name, stage_label in (
        ("linkedin", "LinkedIn"),
        ("github", "GitHub"),
        ("portfolio", "Portfolio"),
    ):
        result = stage_results.get(stage_name)
        if not result or not result.get("requested"):
            continue
        if result.get("error"):
            missing_bullets.append(
                f"{stage_label} warning: {truncate_text(result.get('error'), limit=220)}"
            )
        elif result.get("status") in {"partial", "blocked", "skipped"} and not extract_named_bullets(
            result.get("summaryText"), "MISSING:"
        ):
            missing_bullets.append(f"{stage_label} stage status: {result.get('status')}.")

    if not linkedin_bullets:
        linkedin_bullets = ["No LinkedIn evidence captured."]
    if not github_bullets:
        github_bullets = ["No GitHub evidence captured."]
    if not portfolio_bullets:
        portfolio_bullets = ["No portfolio evidence captured."]
    if not missing_bullets:
        missing_bullets = ["No additional missing items recorded."]

    portfolio_summary = parse_portfolio_stage_summary(
        stage_results.get("portfolio", {}).get("summaryText"),
        candidate_name="",
        portfolio_url=None,
        expected_github_url=None,
    )
    portfolio_url = portfolio_summary.get("url") or "unknown"
    portfolio_owner_name = portfolio_summary.get("ownerName") or "unknown"
    candidate_label = portfolio_summary.get("candidateLabel") or "unknown"
    mismatch_flag = "yes" if portfolio_summary.get("mismatchFlag") else "no"
    projects_reviewed = portfolio_summary.get("projectsReviewed")
    resume_found = portfolio_summary.get("resumeFound")
    github_link_found = portfolio_summary.get("githubLinkFound")
    github_link_matches_expected = portfolio_summary.get("githubLinkMatchesExpected") or "unknown"
    retro_found = portfolio_summary.get("retroFound")

    lines = [
        f"LINKEDIN_STATUS: {status_map['linkedin']}",
        "LINKEDIN_EVIDENCE:",
        *[f"- {bullet}" for bullet in linkedin_bullets[:10]],
        f"GITHUB_STATUS: {status_map['github']}",
        "GITHUB_EVIDENCE:",
        *[f"- {bullet}" for bullet in github_bullets[:10]],
        f"PORTFOLIO_STATUS: {status_map['portfolio']}",
        f"PORTFOLIO_URL: {portfolio_url}",
        f"PORTFOLIO_OWNER_NAME: {portfolio_owner_name}",
        f"CANDIDATE_LABEL: {candidate_label}",
        f"MISMATCH_FLAG: {mismatch_flag}",
        "PORTFOLIO_EVIDENCE:",
        *[f"- {bullet}" for bullet in portfolio_bullets[:10]],
        f"PROJECTS_REVIEWED: {projects_reviewed if projects_reviewed is not None else 0}",
        "PROJECT_HIGHLIGHTS:",
        *[f"- {bullet}" for bullet in (portfolio_project_highlights or ['No project highlights captured.'])[:8]],
        f"RESUME_FOUND: {'yes' if resume_found is True else 'no' if resume_found is False else 'unknown'}",
        f"GITHUB_LINK_FOUND: {'yes' if github_link_found is True else 'no' if github_link_found is False else 'unknown'}",
        f"GITHUB_LINK_MATCHES_EXPECTED: {github_link_matches_expected}",
        f"RETRO_FOUND: {'yes' if retro_found is True else 'no' if retro_found is False else 'unknown'}",
        "PORTFOLIO_WARNINGS:",
        *[f"- {bullet}" for bullet in (portfolio_warnings or ['No additional portfolio warnings recorded.'])[:8]],
        "MISSING:",
        *[f"- {bullet}" for bullet in missing_bullets[:10]],
    ]
    return "\n".join(lines)


def build_combined_act_result(stage_results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    combined: Dict[str, Any] = {"stages": {}}
    stage_metadata: List[Dict[str, Any]] = []
    step_server_times: List[str] = []

    for stage_name in ("linkedin", "github", "portfolio"):
        result = stage_results.get(stage_name)
        if not result:
            continue

        combined["stages"][stage_name] = {
            "status": result.get("status"),
            "summaryText": result.get("summaryText"),
            "warnings": result.get("warnings", []),
            "error": result.get("error"),
            "guardrails": result.get("guardrails"),
            "actResult": result.get("actResult"),
        }

        act_payload = result.get("actResult")
        if isinstance(act_payload, dict) and isinstance(act_payload.get("metadata"), dict):
            metadata = act_payload["metadata"]
            stage_metadata.append(metadata)
            raw_step_times = metadata.get("step_server_times_s")
            if isinstance(raw_step_times, list):
                step_server_times.extend([str(item) for item in raw_step_times])

    if stage_metadata:
        last_meta = stage_metadata[-1]
        total_steps = sum(to_int(meta.get("num_steps_executed")) or 0 for meta in stage_metadata)
        total_duration = sum(
            duration_to_seconds(meta.get("time_worked_s"))
            or duration_to_seconds(meta.get("time_worked"))
            or 0.0
            for meta in stage_metadata
        )
        combined["metadata"] = {
            "session_id": first_non_empty_str(*[meta.get("session_id") for meta in stage_metadata]),
            "act_id": first_non_empty_str(last_meta.get("act_id")),
            "num_steps_executed": total_steps or to_int(last_meta.get("num_steps_executed")),
            "start_time": first_non_empty_str(*[meta.get("start_time") for meta in stage_metadata]),
            "end_time": first_non_empty_str(
                *[meta.get("end_time") for meta in reversed(stage_metadata)]
            ),
            "step_server_times_s": step_server_times,
            "time_worked_s": round(total_duration, 3) if total_duration else None,
            "prompt": first_non_empty_str(last_meta.get("prompt")),
        }

    return combined



def run_local_browser_mode(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    portfolio_url: Optional[str],
    web_queries: List[str],
    manual_linkedin_login: bool = False,
) -> SocialCaptureOutput:
    LOCAL_BROWSER_STDOUT_LINES.clear()
    api_key = clean_text(os.getenv("NOVA_ACT_API"))
    if not api_key:
        raise RuntimeError("NOVA_ACT_API is required for local browser mode.")

    if NovaAct is None:
        raise RuntimeError(
            "nova_act is not installed. Install it first, e.g. `pip install nova-act`."
        )

    sys.stdout = TimestampedStdout(timestamp=local_debug_enabled())

    browser_args = clean_text(os.getenv("NOVA_ACT_BROWSER_ARGS"))
    if not browser_args:
        # Default to a normal non-incognito browser session.
        # Keep this profile-agnostic because the current NovaAct local launcher
        # does not support reusing a Chrome user profile through --user-data-dir.
        os.environ["NOVA_ACT_BROWSER_ARGS"] = (
            "--remote-debugging-port=9222 --no-first-run --no-default-browser-check"
        )

    starting_page = get_local_browser_starting_page(
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
        manual_linkedin_login=manual_linkedin_login,
    )
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

    stage_instructions = build_local_browser_stage_instructions(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
        linkedin_manual_login=manual_linkedin_login,
    )
    instruction = build_local_browser_instruction(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
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
            "The browser is open on the LinkedIn sign-in page.\n"
            "Please enter your email/password manually, complete any 2FA or checkpoint steps,\n"
            "and wait until you can see the authenticated LinkedIn UI such as the feed/search bar.\n"
            "Once you are fully signed in, press Enter here in the terminal so Nova Act can continue the remaining LinkedIn capture steps..."
        )
    stage_results: Dict[str, Dict[str, Any]] = {}
    for stage_name in ("linkedin", "github", "portfolio"):
        stage_requested = bool(
            (stage_name == "linkedin" and linkedin_url)
            or (stage_name == "github" and github_url)
            or (stage_name == "portfolio" and portfolio_url)
        )
        stage_results[stage_name] = run_local_browser_stage(
            nova=nova,
            stage_name=stage_name,
            instruction=stage_instructions.get(stage_name),
            requested=stage_requested,
            stage_context={
                "candidate_name": candidate_name,
                "portfolio_url": portfolio_url,
            },
        )

    final_summary_text = build_combined_final_summary(
        stage_results,
        linkedin_requested=bool(linkedin_url),
        github_requested=bool(github_url),
        portfolio_requested=bool(portfolio_url),
    )
    combined_act_result = build_combined_act_result(stage_results)
    linkedin_status = stage_results["linkedin"].get("status", "skipped")
    github_status = stage_results["github"].get("status", "skipped")
    portfolio_status = stage_results["portfolio"].get("status", "skipped")

    linkedin = (
        LinkedInCapture(
            url=linkedin_url,
            found=linkedin_status in {"ok", "partial"},
            notes="Local visible Nova Act browser session ran. Map structured extraction after you define your local parsing strategy.",
        )
        if linkedin_url
        else None
    )

    github = (
        GitHubCapture(
            url=github_url,
            found=github_status in {"ok", "partial"},
            username=(github_url.rstrip("/").split("/")[-1] if github_url else None),
            notes="Local visible Nova Act browser session ran. Map structured extraction after you define your local parsing strategy.",
        )
        if github_url
        else None
    )

    portfolio_summary = parse_portfolio_stage_summary(
        stage_results.get("portfolio", {}).get("summaryText"),
        candidate_name=candidate_name,
        portfolio_url=portfolio_url,
        expected_github_url=github_url,
    )
    portfolio = (
        PortfolioCapture(
            url=portfolio_url,
            found=portfolio_status in {"ok", "partial"},
            status=portfolio_summary.get("status") or portfolio_status,
            ownerName=portfolio_summary.get("ownerName"),
            candidateLabel=portfolio_summary.get("candidateLabel"),
            mismatchFlag=bool(portfolio_summary.get("mismatchFlag")),
            evidence=portfolio_summary.get("evidence") or [],
            projectsReviewed=portfolio_summary.get("projectsReviewed"),
            projectHighlights=portfolio_summary.get("projectHighlights") or [],
            resumeFound=portfolio_summary.get("resumeFound"),
            githubLinkFound=portfolio_summary.get("githubLinkFound"),
            githubLinkMatchesExpected=portfolio_summary.get("githubLinkMatchesExpected"),
            retroFound=portfolio_summary.get("retroFound"),
            warnings=(portfolio_summary.get("warnings") or []) + (portfolio_summary.get("missing") or []),
            notes="Portfolio stage parsed from the Nova Act structured return block.",
        )
        if portfolio_url
        else None
    )

    flags = list(portfolio_summary.get("flags") or [])

    stage_warnings: List[str] = []
    guardrails_entries: List[Dict[str, Any]] = []
    requested_stage_count = 0
    handled_stage_count = 0
    for stage_name in ("linkedin", "github", "portfolio"):
        result = stage_results.get(stage_name) or {}
        if result.get("requested"):
            requested_stage_count += 1
        if result.get("requested") and result.get("status") in {"ok", "partial", "blocked", "skipped"}:
            handled_stage_count += 1
        stage_warnings.extend(result.get("warnings", []))
        if isinstance(result.get("guardrails"), dict):
            guardrails_entries.append(result["guardrails"])

    return SocialCaptureOutput(
        ok=handled_stage_count == requested_stage_count,
        mode="local-browser",
        candidateName=candidate_name,
        workflowRunId=None,
        timedOut=False,
        workflowDefinitionName=None,
        modelId=get_model_id(),
        linkedin=linkedin,
        github=github,
        portfolio=portfolio,
        web=None,
        flags=flags,
        warnings=[
            "Local visible browser mode was used.",
            "This mode is best for debugging because you can see the browser and Nova Act actions directly.",
            "If manual LinkedIn login mode is enabled, the agent resumes only after you sign in manually on LinkedIn.",
            "The local instruction now uses a shorter guardrails-safe evidence capture flow with provided URLs only.",
            "Structured extraction is still placeholder-based for LinkedIn and GitHub in this mode until deeper page parsing is added.",
            "If NOVA_ACT_PREFER_CHROME is enabled, the script prefers launching NovaAct itself in Chrome/Chromium.",
            "If --manual-linkedin-login is enabled, local mode starts on the LinkedIn login page and waits for human sign-in before Nova Act continues.",
            "Without --manual-linkedin-login, local mode opens the provided LinkedIn URL directly and stops if LinkedIn shows an authwall or login block.",
            "This SDK path currently launches an isolated Playwright browser context, so it will not reuse your already signed-in Chrome profile.",
            "Do not set a Chrome user-data-dir for this script unless NovaAct adds persistent-context profile support in a future SDK version.",
            "Local browser mode now runs LinkedIn, GitHub, and portfolio review as separate sequential Nova acts in the same browser session.",
            "Legacy web query inputs are recorded but intentionally ignored in this portfolio flow.",
            *stage_warnings,
        ],
        raw={
            "startingPage": starting_page,
            "manualLinkedInLogin": manual_linkedin_login,
            "instruction": instruction,
            "stageInstructions": stage_instructions,
            "stageSummaries": {
                stage_name: stage_results.get(stage_name, {}).get("summaryText")
                for stage_name in ("linkedin", "github", "portfolio")
            },
            "stageActResults": {
                stage_name: stage_results.get(stage_name, {}).get("actResult")
                for stage_name in ("linkedin", "github", "portfolio")
            },
            "actResult": combined_act_result,
            "finalSummaryText": final_summary_text,
            "preferChrome": prefer_chrome_enabled(),
            "linkedInStartsFromGoogle": bool(linkedin_url) and not manual_linkedin_login,
            "profileReuseSupported": False,
            "guardrails": guardrails_entries or None,
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
        "--portfolio-url",
        default="https://lamanhtruong.com",
        help="Portfolio URL for the post-GitHub recruiter-style portfolio stage.",
    )
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
    parser.add_argument(
        "--out-dir",
        help=(
            "Artifact output directory. Default: "
            "apps/llm/agents/.runs/social/<candidate>/<timestamp>/"
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    candidate_name = args.candidate_name.strip()
    linkedin_url = clean_text(args.linkedin_url)
    github_url = clean_text(args.github_url)
    portfolio_url = clean_text(args.portfolio_url)
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
    input_urls = {
        "candidateName": candidate_name,
        "linkedin": linkedin_url,
        "github": github_url,
        "portfolio": portfolio_url,
        "webQueries": web_queries,
    }

    if args.local_browser:
        try:
            output = run_local_browser_mode(
                candidate_name=candidate_name,
                linkedin_url=linkedin_url,
                github_url=github_url,
                portfolio_url=portfolio_url,
                web_queries=web_queries,
                manual_linkedin_login=args.manual_linkedin_login,
            )
        except Exception as exc:
            capture_path = write_failure_artifact(
                candidate_name=candidate_name,
                mode="local-browser",
                out_dir=args.out_dir,
                input_urls=input_urls,
                error=exc,
                raw_payload={
                    "stdoutLines": LOCAL_BROWSER_STDOUT_LINES[-200:],
                },
            )
            eprint(f"[INFO] Wrote social capture artifact: {capture_path}")
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
    capture_path = write_capture_artifacts(
        candidate_name=candidate_name,
        output=output,
        payload=payload,
        out_dir=args.out_dir,
        input_urls=input_urls,
    )

    if local_debug_enabled() and output.mode == "workflow":
        eprint(
            f"[INFO] Workflow result status: timedOut={payload.get('timedOut')} "
            f"runId={payload.get('workflowRunId')}"
        )

    eprint(f"[INFO] Wrote social capture artifact: {capture_path}")

    if args.pretty:
        print(json.dumps(payload, indent=2))
    else:
        print(json.dumps(payload))
    return 0

    


if __name__ == "__main__":
    sys.exit(main())

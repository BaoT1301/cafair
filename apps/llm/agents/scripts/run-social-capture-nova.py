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
- falls back to API-key mode for local/dev usage
- returns a normalized JSON payload that can feed the social screen pipeline

Notes:
- Workflow mode starts the configured workflow definition.
- This script does NOT pass runtime `input` into create_workflow_run because the
  Nova Act workflow API shape here does not accept it.
- If your workflow needs dynamic per-run parameters, that must be handled inside
  the workflow definition or via a different supported mechanism.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except Exception:
    boto3 = None
    BotoCoreError = Exception
    ClientError = Exception


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


def env_truthy(name: str) -> bool:
    value = os.getenv(name, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


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

    web_results = [
        WebCaptureResult(
            title=f"Search result placeholder for: {q}",
            snippet="Stub result generated locally.",
            source="stub",
            url=None,
        )
        for q in web_queries
    ]

    web = WebCapture(
        queries=web_queries,
        results=web_results,
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
            "Hook the API-key mode into a real Nova Act HTTP endpoint when available.",
        ],
        raw={
            "apiKeyPresent": True,
            "implementation": "stub",
        },
    )


# ---------------------------
# Workflow mode
# ---------------------------

def create_nova_act_client():
    if boto3 is None:
        raise RuntimeError(
            "boto3 is not installed. Install it first: pip install boto3"
        )

    region = get_region()
    # Service name may differ in some environments; keeping the expected one here.
    return boto3.client("nova-act", region_name=region)



def start_workflow_run(client) -> Dict[str, Any]:
    workflow_name = get_workflow_name()
    if not workflow_name:
        raise RuntimeError(
            "Workflow mode requested but NOVA_ACT_WORKFLOW_NAME / NOVA_ACT_WORKFLOW_ARN is missing."
        )

    model_id = get_model_id()

    try:
        return client.create_workflow_run(
            workflowDefinitionName=workflow_name,
            modelId=model_id,
            clientToken=str(uuid.uuid4()),
            clientInfo={
                "compatibilityVersion": 1,
                "sdkVersion": "custom-local-0.1.0",
            },
        )
    except Exception as exc:
        raise RuntimeError(f"create_workflow_run failed: {exc}") from exc

def extract_run_id(start_response: Dict[str, Any]) -> Optional[str]:
    for key in ("workflowRunId", "runId", "id", "workflowExecutionId"):
        value = start_response.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def safe_get_workflow_run(client, run_id: str) -> Optional[Dict[str, Any]]:
    """
    Best-effort polling helper.
    Nova Act SDK shapes may vary by account/version, so this tries a few patterns.
    """
    getters = [
        ("get_workflow_run", {"workflowRunId": run_id}),
        ("get_workflow_run", {"runId": run_id}),
        ("describe_workflow_run", {"workflowRunId": run_id}),
        ("describe_workflow_run", {"runId": run_id}),
    ]

    for method_name, kwargs in getters:
        method = getattr(client, method_name, None)
        if callable(method):
            try:
                return method(**kwargs)
            except Exception:
                continue

    return None


def poll_workflow_run(
    client,
    run_id: str,
    timeout_seconds: int = 20,
    poll_interval_seconds: float = 2.0,
) -> Optional[Dict[str, Any]]:
    deadline = time.time() + timeout_seconds
    last_payload: Optional[Dict[str, Any]] = None

    while time.time() < deadline:
        payload = safe_get_workflow_run(client, run_id)
        if payload:
            last_payload = payload

            status = str(
                payload.get("status")
                or payload.get("workflowRunStatus")
                or payload.get("state")
                or ""
            ).upper()

            if status in {"SUCCEEDED", "SUCCESS", "COMPLETED"}:
                return payload

            if status in {"FAILED", "ERROR", "CANCELLED", "TIMED_OUT"}:
                return payload

        time.sleep(poll_interval_seconds)

    return last_payload


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
    raw_payload = {
        "start": start_response,
        "final": final_response,
    }

    # Until we know the exact workflow output contract, keep a safe normalized shell.
    # This still gives your TS pipeline the URLs and metadata to continue downstream.
    linkedin = (
        LinkedInCapture(
            url=linkedin_url,
            found=bool(linkedin_url),
            notes="Workflow started. Parse workflow output here once your workflow returns structured browser capture data.",
        )
        if linkedin_url
        else None
    )

    github = (
        GitHubCapture(
            url=github_url,
            found=bool(github_url),
            username=(github_url.rstrip("/").split("/")[-1] if github_url else None),
            notes="Workflow started. Parse workflow output here once your workflow returns structured browser capture data.",
        )
        if github_url
        else None
    )

    web = WebCapture(
        queries=web_queries,
        results=[],
        notes="Workflow started. Map workflow search/browser outputs here after you confirm response fields.",
    )

    warnings: List[str] = [
        "Workflow mode started successfully.",
        "This script currently normalizes workflow metadata, but not full browser extraction fields yet.",
        "Next step: map your actual workflow output JSON into linkedin/github/web fields.",
    ]

    if final_response:
        status = str(
            final_response.get("status")
            or final_response.get("workflowRunStatus")
            or final_response.get("state")
            or ""
        ).upper()
        if status and status not in {"SUCCEEDED", "SUCCESS", "COMPLETED"}:
            warnings.append(f"Workflow final status: {status}")

    return SocialCaptureOutput(
        ok=True,
        mode="workflow",
        candidateName=candidate_name,
        workflowRunId=run_id,
        workflowDefinitionName=workflow_name,
        modelId=get_model_id(),
        linkedin=linkedin,
        github=github,
        web=web,
        warnings=warnings,
        raw=raw_payload,
    )


def run_workflow_mode(
    candidate_name: str,
    linkedin_url: Optional[str],
    github_url: Optional[str],
    web_queries: List[str],
) -> SocialCaptureOutput:
    client = create_nova_act_client()
    start_response = start_workflow_run(client)
    run_id = extract_run_id(start_response)

    final_response: Optional[Dict[str, Any]] = None
    if run_id:
        final_response = poll_workflow_run(client, run_id)

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

    # Current safe fallback: emit a normalized stub payload.
    # Replace this with real HTTP calls if/when you confirm the Nova Act API-key endpoint shape.
    return build_stub_capture(
        candidate_name=candidate_name,
        linkedin_url=linkedin_url,
        github_url=github_url,
        web_queries=web_queries,
    )


# ---------------------------
# Main
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

    # 1) Preferred: workflow mode
    if has_workflow_mode():
        try:
            output = run_workflow_mode(
                candidate_name=candidate_name,
                linkedin_url=linkedin_url,
                github_url=github_url,
                web_queries=web_queries,
            )
        except Exception as exc:
            workflow_error = str(exc)
            eprint(f"[WARN] Workflow mode failed: {workflow_error}")

    # 2) Fallback: API-key mode
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

    # 3) Fail clearly
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
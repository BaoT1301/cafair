#!/usr/bin/env python3
"""
social_capture_batch_helper.py

Shared Python helper for:
- loading candidate lists
- calling the single-candidate runner (run-social-capture-nova.py)
- collecting results safely
- writing batch output

This helper is intentionally simple and reuses your existing
run-social-capture-nova.py instead of reimplementing Nova logic again.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class BatchCandidateInput:
    candidateId: str
    name: str
    linkedin: Optional[str] = None
    github: Optional[str] = None
    webQueries: Optional[List[str]] = None


@dataclass
class BatchCandidateResult:
    candidateId: str
    name: str
    ok: bool
    mode: Optional[str] = None
    workflowRunId: Optional[str] = None
    timedOut: Optional[bool] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    stderr: Optional[str] = None


def load_candidates_from_json(path: str) -> List[BatchCandidateInput]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raise ValueError("Input JSON must be a list of candidate objects.")

    out: List[BatchCandidateInput] = []
    for idx, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Candidate at index {idx} is not an object.")

        candidate_id = str(item.get("candidateId", "")).strip()
        name = str(item.get("name", "")).strip()

        if not candidate_id:
            raise ValueError(f"Candidate at index {idx} is missing candidateId.")
        if not name:
            raise ValueError(f"Candidate at index {idx} is missing name.")

        linkedin = item.get("linkedin")
        github = item.get("github")
        web_queries = item.get("webQueries") or item.get("web_queries") or []

        if linkedin is not None:
            linkedin = str(linkedin).strip() or None
        if github is not None:
            github = str(github).strip() or None

        normalized_queries: List[str] = []
        if isinstance(web_queries, list):
            for q in web_queries:
                if isinstance(q, str) and q.strip():
                    normalized_queries.append(q.strip())

        out.append(
            BatchCandidateInput(
                candidateId=candidate_id,
                name=name,
                linkedin=linkedin,
                github=github,
                webQueries=normalized_queries,
            )
        )

    return out


def ensure_parent_dir(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def get_single_runner_path() -> str:
    here = Path(__file__).resolve().parent
    runner = here / "run-social-capture-nova.py"
    return str(runner)


def run_single_capture(
    candidate: BatchCandidateInput,
    timeout_seconds: int = 180,
    poll_interval_seconds: float = 3.0,
    use_local_browser: bool = False,
    manual_linkedin_login: bool = False,
    debug_logs: bool = False,
    prefer_chrome: bool = False,
) -> BatchCandidateResult:
    runner_path = get_single_runner_path()

    cmd: List[str] = [
        sys.executable,
        runner_path,
        candidate.name,
        "--timeout-seconds",
        str(timeout_seconds),
        "--poll-interval-seconds",
        str(poll_interval_seconds),
    ]

    if candidate.linkedin:
        cmd.extend(["--linkedin", candidate.linkedin])

    if candidate.github:
        cmd.extend(["--github", candidate.github])

    for q in candidate.webQueries or []:
        cmd.extend(["--web-query", q])

    if use_local_browser:
        cmd.append("--local-browser")
    if manual_linkedin_login:
        cmd.append("--manual-linkedin-login")
    if debug_logs:
        cmd.append("--debug-logs")
    if prefer_chrome:
        cmd.append("--prefer-chrome")

    # Important: JSON output stays easiest to parse without --pretty.
    env = os.environ.copy()

    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )
    except Exception as exc:
        return BatchCandidateResult(
            candidateId=candidate.candidateId,
            name=candidate.name,
            ok=False,
            error=f"Failed to launch single runner: {exc}",
        )

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()

    if completed.returncode != 0:
        return BatchCandidateResult(
            candidateId=candidate.candidateId,
            name=candidate.name,
            ok=False,
            error=f"Single runner exited with code {completed.returncode}",
            stderr=stderr or stdout,
        )

    try:
        parsed = json.loads(stdout)
    except Exception as exc:
        return BatchCandidateResult(
            candidateId=candidate.candidateId,
            name=candidate.name,
            ok=False,
            error=f"Could not parse single-runner JSON output: {exc}",
            stderr=stderr,
        )

    return BatchCandidateResult(
        candidateId=candidate.candidateId,
        name=candidate.name,
        ok=bool(parsed.get("ok")),
        mode=parsed.get("mode"),
        workflowRunId=parsed.get("workflowRunId"),
        timedOut=parsed.get("timedOut"),
        result=parsed,
        stderr=stderr or None,
    )


def build_batch_summary(results: List[BatchCandidateResult]) -> Dict[str, Any]:
    total = len(results)
    ok_count = sum(1 for r in results if r.ok)
    failed_count = total - ok_count
    timed_out_count = sum(1 for r in results if r.timedOut is True)

    by_mode: Dict[str, int] = {}
    for r in results:
        mode = r.mode or "unknown"
        by_mode[mode] = by_mode.get(mode, 0) + 1

    return {
        "total": total,
        "ok": ok_count,
        "failed": failed_count,
        "timedOut": timed_out_count,
        "byMode": by_mode,
    }


def write_json(path: str, payload: Dict[str, Any]) -> None:
    ensure_parent_dir(path)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
#!/usr/bin/env python3
"""
poll-existing-workflow-run.py

Poll an already-started Nova Act workflow run by workflowRunId.

Purpose:
- inspect an existing remote workflow run after it was started earlier
- poll until terminal status or timeout
- print the latest payload
- try to extract any structured output block if present

Usage:
python apps/llm/agents/scripts/poll-existing-workflow-run.py \
  --run-id 019cac7f-fda5-7698-8a1c-101353a20080 \
  --timeout-seconds 300 \
  --poll-interval-seconds 5 \
  --pretty
  
maybe increase timeout to 600++
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    import boto3
except Exception:
    boto3 = None


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


def deep_get(data: Any, path: List[str]) -> Any:
    cur = data
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def get_status(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None

    for key in ("status", "workflowRunStatus", "state", "executionStatus"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().upper()

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


def stringify_error(exc: Exception) -> str:
    return f"{exc.__class__.__name__}: {exc}"


def create_nova_act_client():
    if boto3 is None:
        raise RuntimeError("boto3 is not installed. Install it first: pip install boto3")
    return boto3.client("nova-act", region_name=get_region())


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

    return {
        "status": get_status(payload),
        "workflowRunId": payload.get("workflowRunId") or payload.get("runId") or payload.get("id"),
        "topLevelKeys": list(payload.keys())[:20],
        "hasStructuredOutput": try_extract_structured_output(payload) is not None,
    }


def get_workflow_run(client, workflow_name: str, run_id: str) -> Optional[Dict[str, Any]]:
    method_specs: List[Tuple[str, Dict[str, Any]]] = [
        ("get_workflow_run", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
        ("describe_workflow_run", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
        ("get_workflow_run_result", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
        ("get_workflow_execution", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
        ("describe_workflow_execution", {"workflowDefinitionName": workflow_name, "workflowRunId": run_id}),
    ]

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

    if errors:
        raise RuntimeError(
            "Could not fetch workflow run {}. Tried:\n{}".format(
                run_id,
                "\n".join(errors),
            )
        )

    return None


def poll_existing_run(
    client,
    workflow_name: str,
    run_id: str,
    timeout_seconds: int,
    poll_interval_seconds: float,
) -> Dict[str, Any]:
    deadline = time.time() + timeout_seconds
    attempt = 0
    poll_history: List[Dict[str, Any]] = []
    poll_errors: List[str] = []
    last_payload: Optional[Dict[str, Any]] = None
    timed_out = False

    while time.time() < deadline:
        attempt += 1
        remaining = max(0.0, deadline - time.time())

        try:
            payload = get_workflow_run(client, workflow_name, run_id)
            last_payload = payload
            status = get_status(payload)
            structured = try_extract_structured_output(payload)

            poll_history.append(
                {
                    "attempt": attempt,
                    "secondsRemaining": round(remaining, 2),
                    "status": status,
                    "hasStructuredOutput": structured is not None,
                    "payloadSummary": summarize_payload(payload),
                }
            )

            if is_terminal_status(status):
                break

            if structured is not None:
                break

        except Exception as exc:
            poll_errors.append(f"attempt {attempt}: {stringify_error(exc)}")
            poll_history.append(
                {
                    "attempt": attempt,
                    "secondsRemaining": round(remaining, 2),
                    "status": None,
                    "hasStructuredOutput": False,
                    "payloadSummary": None,
                }
            )

        time.sleep(poll_interval_seconds)
    else:
        timed_out = True

    final_payload = last_payload
    final_status = get_status(final_payload)
    structured_output = try_extract_structured_output(final_payload)

    warnings: List[str] = []
    if timed_out and final_status == "RUNNING":
        warnings.append("Workflow is still RUNNING after the timeout window.")
    elif timed_out:
        warnings.append("Polling timed out before a terminal status was observed.")
    elif final_status:
        warnings.append(f"Workflow ended polling with status: {final_status}")
    else:
        warnings.append("No readable workflow status was found.")

    if structured_output is None:
        warnings.append("No structured output block detected in the latest workflow payload yet.")

    if poll_errors:
        warnings.append("Some polling attempts failed. Check pollErrors.")

    return {
        "ok": True,
        "workflowDefinitionName": workflow_name,
        "workflowRunId": run_id,
        "timedOut": timed_out,
        "finalStatus": final_status,
        "structuredOutput": structured_output,
        "warnings": warnings,
        "raw": {
            "final": final_payload,
            "finalSummary": summarize_payload(final_payload),
            "pollHistory": poll_history,
            "pollErrors": poll_errors,
            "timeoutSeconds": timeout_seconds,
            "pollIntervalSeconds": poll_interval_seconds,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Poll an existing Nova Act workflow run."
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Existing workflowRunId to inspect",
    )
    parser.add_argument(
        "--workflow-name",
        default=None,
        help="Override workflow definition name (otherwise uses NOVA_ACT_WORKFLOW_NAME / ARN)",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=180,
        help="Polling timeout in seconds (default: 180)",
    )
    parser.add_argument(
        "--poll-interval-seconds",
        type=float,
        default=3.0,
        help="Polling interval in seconds (default: 3.0)",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    run_id = clean_text(args.run_id)
    workflow_name = clean_text(args.workflow_name) or get_workflow_name()

    if not run_id:
        eprint("[ERROR] --run-id is required.")
        return 2

    if not workflow_name:
        eprint(
            "[ERROR] Workflow name is required. Set NOVA_ACT_WORKFLOW_NAME / NOVA_ACT_WORKFLOW_ARN or pass --workflow-name."
        )
        return 2

    try:
        client = create_nova_act_client()
        result = poll_existing_run(
            client=client,
            workflow_name=workflow_name,
            run_id=run_id,
            timeout_seconds=args.timeout_seconds,
            poll_interval_seconds=args.poll_interval_seconds,
        )
    except Exception as exc:
        payload = {
            "ok": False,
            "error": "Failed to poll existing workflow run",
            "details": str(exc),
            "workflowDefinitionName": workflow_name,
            "workflowRunId": run_id,
        }
        if args.pretty:
            print(json.dumps(make_json_safe(payload), indent=2))
        else:
            print(json.dumps(make_json_safe(payload)))
        return 1

    safe_result = make_json_safe(result)
    if args.pretty:
        print(json.dumps(safe_result, indent=2))
    else:
        print(json.dumps(safe_result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
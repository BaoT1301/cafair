#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional, TypedDict


class Result(TypedDict, total=False):
    ok: bool
    error: str
    details: str


def _print_json(data: Dict[str, Any]) -> None:
    print(json.dumps(data, ensure_ascii=False))


def _print_error_and_exit(error: str, details: Optional[str] = None) -> None:
    result: Result = {
        "ok": False,
        "error": error,
    }

    if details:
        result["details"] = details

    _print_json(result)
    sys.exit(1)


def _read_stdin_payload() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()

    if not raw:
        raise ValueError("No JSON payload received by Python runner.")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Top-level JSON payload must be a JSON object.")

    return parsed


def _resolve_nova_runner_path() -> Path:
    script_path = Path(__file__).resolve()

    # apps/llm/agents/scripts/apply-agent/run-nova.py
    # -> apps/llm/agents/src/apply-agent/nova_runner.py
    runner_path = (
        script_path.parents[2]
        / "src"
        / "apply-agent"
        / "nova_runner.py"
    )

    if not runner_path.exists():
        raise FileNotFoundError(
            f"Could not find nova_runner.py at: {runner_path}"
        )

    return runner_path


def _load_nova_runner_module() -> Any:
    runner_path = _resolve_nova_runner_path()

    spec = importlib.util.spec_from_file_location(
        "apply_agent_nova_runner",
        runner_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(
            f"Failed to create import spec for: {runner_path}"
        )

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module


def _run_apply_agent(payload: Dict[str, Any]) -> Dict[str, Any]:
    module = _load_nova_runner_module()

    run_func = getattr(module, "run", None)
    if not callable(run_func):
        raise RuntimeError(
            "Loaded nova_runner.py, but it does not expose a callable run(payload)."
        )

    result = run_func(payload)

    if not isinstance(result, dict):
        raise RuntimeError(
            "nova_runner.run(payload) must return a dictionary."
        )

    return result


def main() -> None:
    try:
        payload = _read_stdin_payload()
    except Exception as exc:  # noqa: BLE001
        _print_error_and_exit(
            "Failed to read Python runner payload.",
            str(exc),
        )
        return

    try:
        result = _run_apply_agent(payload)
    except Exception as exc:  # noqa: BLE001
        _print_error_and_exit(
            "Unhandled error in Python Nova runner bridge.",
            str(exc),
        )
        return

    _print_json(result)


if __name__ == "__main__":
    main()
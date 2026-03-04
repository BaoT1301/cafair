from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional, TypedDict

from .nova_runner import run as run_nova_payload


class RuntimeBridgeSuccess(TypedDict, total=False):
    ok: bool
    result: Dict[str, Any]


class RuntimeBridgeError(TypedDict, total=False):
    ok: bool
    error: str
    details: str


def parse_json_input(raw: str) -> Dict[str, Any]:
    payload = raw.strip()

    if not payload:
      raise ValueError("No JSON payload received.")

    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Top-level JSON payload must be an object.")

    return parsed


def read_stdin_json() -> Dict[str, Any]:
    return parse_json_input(sys.stdin.read())


def run_runtime_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Runtime bridge payload must be a dictionary.")

    result = run_nova_payload(payload)

    if not isinstance(result, dict):
        raise ValueError("Python Nova runner returned a non-dictionary response.")

    return result


def build_success_result(result: Dict[str, Any]) -> RuntimeBridgeSuccess:
    return {
        "ok": True,
        "result": result,
    }


def build_error_result(
    error: str,
    details: Optional[str] = None,
) -> RuntimeBridgeError:
    response: RuntimeBridgeError = {
        "ok": False,
        "error": error,
    }

    if details:
        response["details"] = details

    return response


def print_json(data: Dict[str, Any]) -> None:
    print(json.dumps(data))


def main() -> None:
    try:
        payload = read_stdin_json()
    except Exception as exc:  # noqa: BLE001
        print_json(
            build_error_result(
                "Failed to read runtime bridge input.",
                str(exc),
            )
        )
        sys.exit(1)
        return

    try:
        result = run_runtime_bridge(payload)
        print_json(build_success_result(result))
    except Exception as exc:  # noqa: BLE001
        print_json(
            build_error_result(
                "Runtime bridge execution failed.",
                str(exc),
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
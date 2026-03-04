from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional, TypedDict


class RuntimeBridgeRunner(TypedDict, total=False):
    engine: str
    transport: str
    adapter: str
    provider: str


class RuntimeBridgeActionLog(TypedDict, total=False):
    stepId: str
    action: str
    status: str
    detail: str


class RuntimeBridgeReasoningLog(TypedDict, total=False):
    stepId: str
    summary: str


class RuntimeBridgeSuccess(TypedDict, total=False):
    ok: bool
    status: str
    executed: bool
    executionSteps: list[Dict[str, Any]]
    message: str
    runner: RuntimeBridgeRunner
    actionLogs: list[RuntimeBridgeActionLog]
    reasoningLogs: list[RuntimeBridgeReasoningLog]
    transportSummary: str
    provider: str
    mode: str
    runId: str
    targetUrl: str
    company: str
    roleTitle: str
    safeStopBeforeSubmit: bool
    visibleFields: list[Dict[str, Any]]
    selectors: list[str]
    plannedSteps: list[str]
    browserSession: Dict[str, Any]
    fieldFillPlan: list[Dict[str, Any]]
    result: Dict[str, Any]


class RuntimeBridgeError(TypedDict, total=False):
    ok: bool
    error: str
    details: str


RuntimeBridgeResponse = RuntimeBridgeSuccess | RuntimeBridgeError


def load_nova_runner() -> Any:
    try:
        from .nova_runner import run as run_nova_payload
    except ImportError:
        from nova_runner import run as run_nova_payload  # type: ignore

    return run_nova_payload


def normalize_bridge_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Runtime bridge payload must be a dictionary.")

    nested_payload = payload.get("payload")
    if isinstance(nested_payload, dict):
        return nested_payload

    return payload


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
    raw = sys.stdin.read()
    return parse_json_input(raw)


def run_runtime_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized_payload = normalize_bridge_payload(payload)
    run_nova_payload = load_nova_runner()

    result = run_nova_payload(normalized_payload)

    if not isinstance(result, dict):
        raise ValueError(
            "Python Nova runner returned a non-dictionary response."
        )

    return result


def _copy_string_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, str) and value.strip():
        target[key] = value.strip()  # type: ignore[literal-required]


def _copy_bool_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, bool):
        target[key] = value  # type: ignore[literal-required]


def _copy_list_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, list):
        target[key] = value  # type: ignore[literal-required]


def _copy_dict_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, dict):
        target[key] = value  # type: ignore[literal-required]


def build_success_result(result: Dict[str, Any]) -> RuntimeBridgeSuccess:
    response: RuntimeBridgeSuccess = {
        "ok": True,
        "result": result,
    }

    _copy_string_field(result, response, "status")
    _copy_bool_field(result, response, "executed")
    _copy_list_field(result, response, "executionSteps")
    _copy_string_field(result, response, "message")
    _copy_dict_field(result, response, "runner")
    _copy_list_field(result, response, "actionLogs")
    _copy_list_field(result, response, "reasoningLogs")
    _copy_string_field(result, response, "transportSummary")

    _copy_string_field(result, response, "provider")
    _copy_string_field(result, response, "mode")
    _copy_string_field(result, response, "runId")
    _copy_string_field(result, response, "targetUrl")
    _copy_string_field(result, response, "company")
    _copy_string_field(result, response, "roleTitle")

    _copy_bool_field(result, response, "safeStopBeforeSubmit")

    _copy_list_field(result, response, "visibleFields")
    _copy_list_field(result, response, "selectors")
    _copy_list_field(result, response, "plannedSteps")
    _copy_list_field(result, response, "fieldFillPlan")

    _copy_dict_field(result, response, "browserSession")

    return response


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


def print_json(data: RuntimeBridgeResponse) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> None:
    try:
        payload = read_stdin_json()
    except Exception as exc:  # noqa: BLE001
        print(f"[runtime_bridge] input error: {exc}", file=sys.stderr)
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
    except Exception as exc:  # noqa: BLE001
        print(f"[runtime_bridge] execution error: {exc}", file=sys.stderr)
        print_json(
            build_error_result(
                "Runtime bridge execution failed.",
                str(exc),
            )
        )
        sys.exit(1)
        return

    print_json(build_success_result(result))


if __name__ == "__main__":
    main()
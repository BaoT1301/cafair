from __future__ import annotations

import json
import os
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


def load_browser_session_executor() -> tuple[Any, Any]:
    try:
        from .browser_session import (
            browser_execution_result_to_dict,
            execute_browser_session,
        )
    except ImportError:
        from browser_session import (  # type: ignore
            browser_execution_result_to_dict,
            execute_browser_session,
        )

    return execute_browser_session, browser_execution_result_to_dict


def _build_nova_instruction(
    payload: Dict[str, Any],
    browser_session_result: Dict[str, Any],
) -> str:
    target_url = _safe_string(payload.get("targetUrl"))
    provider = _safe_string(payload.get("provider"), "unknown")
    company = _safe_string(payload.get("company"), "target company")
    role_title = _safe_string(payload.get("roleTitle"), "target role")
    safe_stop = _safe_bool(payload.get("safeStopBeforeSubmit"), True)

    planned_steps = payload.get("plannedSteps")
    if not isinstance(planned_steps, list):
        planned_steps = []

    browser_steps = browser_session_result.get("steps")
    if not isinstance(browser_steps, list):
        browser_steps = []

    lines: list[str] = [
        "You are an apply-agent browser runner using the Nova Act SDK.",
        "Open and interact only with the target application flow requested.",
        "Keep actions concise and visible.",
        f"Target URL: {target_url}",
        f"Provider: {provider}",
        f"Company: {company}",
        f"Role: {role_title}",
        "",
        "Execution goals:",
        "1. Open the target job application page.",
        "2. Wait for the page to stabilize.",
        "3. Follow the provider-specific application path.",
        "4. Capture visible applicant fields.",
        "5. Prefill only clearly mapped fields when possible.",
    ]

    if safe_stop:
        lines.append(
            "6. Hit the final submit button when you finish most of the fields."
        )
    else:
        lines.append(
            "6. After all required fields are filled, click the final submit button and submit the application."
        )
        lines.append(
            "7. If a required file upload appears, use the file input directly and complete the upload before submitting."
        )

    if planned_steps:
        lines.append("")
        lines.append("Provider plan:")
        for index, step in enumerate(planned_steps, start=1):
            if isinstance(step, str) and step.strip():
                lines.append(f"- {step.strip()}")

    if browser_steps:
        lines.append("")
        lines.append("Browser session steps:")
        for step in browser_steps:
            if not isinstance(step, dict):
                continue
            detail = _safe_string(step.get("detail"))
            if detail:
                lines.append(f"- {detail}")

    lines.append("")
    if safe_stop:
        lines.append(
            "Try to resolve minor on-screen obstacles, hit submit when you can."
        )
    else:
        lines.append(
            "Try to resolve minor on-screen obstacles and complete the submission once the form is fully filled."
        )

    return "\n".join(lines)


def run_local_nova_act_browser(
    payload: Dict[str, Any],
    browser_session_result: Dict[str, Any],
) -> Dict[str, Any]:
    api_key = _safe_string(os.getenv("NOVA_ACT_API"))
    if not api_key:
        raise RuntimeError(
            "NOVA_ACT_API is required for live local Nova Act browser execution."
        )

    try:
        from nova_act import NovaAct
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "nova_act is not installed. Install it first, e.g. `pip install nova-act`."
        ) from exc

    target_url = _safe_string(payload.get("targetUrl"))
    provider = _safe_string(payload.get("provider"), "unknown")
    transport = _safe_string(payload.get("transport"), "api")
    adapter = _safe_string(payload.get("adapterName"), "provider-adapter")

    instruction = _build_nova_instruction(payload, browser_session_result)

    nova = NovaAct(
        starting_page=target_url,
        headless=False,
        nova_act_api_key=api_key,
    )

    action_logs: list[RuntimeBridgeActionLog] = [
        {
            "stepId": "step_1",
            "action": "launch_browser",
            "status": "started",
            "detail": f"Launching visible Nova Act browser at {target_url}.",
        }
    ]
    reasoning_logs: list[RuntimeBridgeReasoningLog] = [
        {
            "stepId": "step_1",
            "summary": (
                "Live API mode requested a real SDK browser session, so the "
                "runtime bridge launched Nova Act directly."
            ),
        }
    ]

    execution_steps: list[Dict[str, Any]] = [
        {
            "id": "step_1",
            "action": "launch_browser",
            "detail": f"Launch visible Nova Act browser for {provider}.",
        },
        {
            "id": "step_2",
            "action": "navigate",
            "detail": f"Open {target_url} in the Nova Act browser session.",
        },
        {
            "id": "step_3",
            "action": "act",
            "detail": "Run provider-aware apply instruction through Nova Act.",
        },
    ]

    nova.start()
    act_result = nova.act(instruction)

    action_logs.append(
        {
            "stepId": "step_2",
            "action": "act",
            "status": "completed",
            "detail": "Nova Act executed the live browser instruction.",
        }
    )
    reasoning_logs.append(
        {
            "stepId": "step_2",
            "summary": (
                "The bridge handed off the planned apply steps to Nova Act and "
                "captured the SDK result for upper layers."
            ),
        }
    )

    return {
        "ok": True,
        "status": "running",
        "executed": True,
        "executionSteps": execution_steps,
        "message": (
            "Runtime bridge launched a real visible Nova Act browser session "
            "and executed the apply instruction."
        ),
        "runner": {
            "engine": "nova-act",
            "transport": transport,
            "adapter": adapter,
            "provider": provider,
        },
        "actionLogs": action_logs,
        "reasoningLogs": reasoning_logs,
        "transportSummary": (
            "Runtime bridge used the local Nova Act SDK to open a visible "
            "browser and run the apply-agent instruction."
        ),
        "provider": provider,
        "mode": _safe_string(payload.get("mode"), "live"),
        "runId": _safe_string(payload.get("runId")),
        "targetUrl": target_url,
        "company": _safe_string(payload.get("company")),
        "roleTitle": _safe_string(payload.get("roleTitle")),
        "safeStopBeforeSubmit": _safe_bool(
            payload.get("safeStopBeforeSubmit"),
            True,
        ),
        "visibleFields": payload.get("visibleFields", []),
        "selectors": _safe_list_of_strings(payload.get("selectors")),
        "plannedSteps": _safe_list_of_strings(payload.get("plannedSteps")),
        "browserSession": browser_session_result,
        "fieldFillPlan": payload.get("fieldFillPlan", []),
        "result": {
            "instruction": instruction,
            "actResult": act_result,
        },
    }


def _safe_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y", "on"}:
            return True
        if lowered in {"false", "0", "no", "n", "off"}:
            return False

    if isinstance(value, (int, float)):
        return bool(value)

    return default


def _safe_list_of_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    output: list[str] = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
            if text:
                output.append(text)

    return output


def _extract_browser_session_payload(
    payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    browser_session = payload.get("browserSession")
    if isinstance(browser_session, dict):
        return browser_session

    nested_payload = payload.get("payload")
    if isinstance(nested_payload, dict):
        nested_browser_session = nested_payload.get("browserSession")
        if isinstance(nested_browser_session, dict):
            return nested_browser_session

    return None


def _build_bridge_result_from_browser_session(
    payload: Dict[str, Any],
    browser_session_result: Dict[str, Any],
) -> Dict[str, Any]:
    summary = browser_session_result.get("summary")
    if not isinstance(summary, dict):
        summary = {}

    browser_opened = bool(browser_session_result.get("browser_opened", False))
    steps = browser_session_result.get("steps")
    if not isinstance(steps, list):
        steps = []

    action_logs = browser_session_result.get("action_logs")
    if not isinstance(action_logs, list):
        action_logs = []

    reasoning_logs = browser_session_result.get("reasoning_logs")
    if not isinstance(reasoning_logs, list):
        reasoning_logs = []

    if browser_opened:
        status = "running"
        executed = True
        message = (
            "Runtime bridge launched a real browser session through the "
            "browser_session layer."
        )
    else:
        status = "planned"
        executed = False
        message = (
            "Runtime bridge prepared browser execution steps, but no live "
            "browser window was opened yet."
        )

    provider = _safe_string(payload.get("provider"), "unknown")
    transport = _safe_string(payload.get("transport"), "workflow")
    adapter = _safe_string(payload.get("adapterName"), "provider-adapter")

    return {
        "ok": True,
        "status": status,
        "executed": executed,
        "executionSteps": steps,
        "message": message,
        "runner": {
            "engine": _safe_string(
                browser_session_result.get("browser_engine"),
                "nova-act",
            ),
            "transport": transport,
            "adapter": adapter,
            "provider": provider,
        },
        "actionLogs": action_logs,
        "reasoningLogs": reasoning_logs,
        "transportSummary": (
            "Runtime bridge delegated execution to browser_session and "
            f"prepared {len(steps)} browser steps."
        ),
        "provider": provider,
        "mode": _safe_string(payload.get("mode"), "demo"),
        "runId": _safe_string(payload.get("runId")),
        "targetUrl": _safe_string(payload.get("targetUrl")),
        "company": _safe_string(payload.get("company")),
        "roleTitle": _safe_string(payload.get("roleTitle")),
        "safeStopBeforeSubmit": _safe_bool(
            payload.get("safeStopBeforeSubmit"),
            True,
        ),
        "visibleFields": payload.get("visibleFields", []),
        "selectors": _safe_list_of_strings(payload.get("selectors")),
        "plannedSteps": _safe_list_of_strings(payload.get("plannedSteps")),
        "browserSession": browser_session_result,
        "fieldFillPlan": payload.get("fieldFillPlan", []),
    }


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

    existing_browser_session = _extract_browser_session_payload(payload)
    if existing_browser_session is not None:
        browser_session_result = existing_browser_session
    else:
        execute_browser_session, browser_execution_result_to_dict = (
            load_browser_session_executor()
        )

        browser_result = execute_browser_session(
            run_id=_safe_string(normalized_payload.get("runId")),
            target_url=_safe_string(normalized_payload.get("targetUrl")),
            provider=_safe_string(
                normalized_payload.get("provider"),
                "unknown",
            ),
            mode=_safe_string(normalized_payload.get("mode"), "demo"),
            transport=_safe_string(
                normalized_payload.get("transport"),
                "workflow",
            ),
            should_apply=_safe_bool(
                normalized_payload.get("shouldApply"),
                False,
            ),
            safe_stop_before_submit=_safe_bool(
                normalized_payload.get("safeStopBeforeSubmit"),
                True,
            ),
            apply_button_selectors=_safe_list_of_strings(
                normalized_payload.get("selectors")
            ),
            fill_actions=normalized_payload.get("fillActions"),
        )

        browser_session_result = browser_execution_result_to_dict(browser_result)

    mode = _safe_string(normalized_payload.get("mode"), "demo")
    transport = _safe_string(normalized_payload.get("transport"), "workflow")
    should_apply = _safe_bool(normalized_payload.get("shouldApply"), False)
    has_nova_api = bool(_safe_string(os.getenv("NOVA_ACT_API")))

    should_launch_live_sdk = (
        mode == "live"
        and transport == "api"
        and should_apply
        and has_nova_api
        and bool(browser_session_result.get("launch_requested"))
    )

    if should_launch_live_sdk:
        return run_local_nova_act_browser(
            normalized_payload,
            browser_session_result,
        )

    return _build_bridge_result_from_browser_session(
        normalized_payload,
        browser_session_result,
    )


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
    _copy_dict_field(result, response, "result")

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
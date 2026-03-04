from __future__ import annotations

import os
from typing import Any, Dict, List, Literal, Optional, TypedDict, cast

from .providers.base import ProviderAdapter


Mode = Literal["plan", "demo", "live"]
Transport = Literal["workflow", "api"]
ExecutionStatus = Literal[
    "planned",
    "queued",
    "running",
    "completed",
    "failed",
]


class ExecutionStep(TypedDict):
    id: str
    action: str
    detail: str


class RunnerMetadata(TypedDict):
    engine: str
    transport: str
    adapter: str
    provider: str


class ActionLog(TypedDict):
    stepId: str
    action: str
    status: str
    detail: str


class ReasoningLog(TypedDict):
    stepId: str
    summary: str


class TransportExecutionResult(TypedDict):
    status: ExecutionStatus
    executed: bool
    executionSteps: List[ExecutionStep]
    message: str
    runner: RunnerMetadata
    actionLogs: List[ActionLog]
    reasoningLogs: List[ReasoningLog]
    transportSummary: str


class RuntimeBridgeStep(TypedDict, total=False):
    id: str
    action: str
    detail: str


class RuntimeBridgeRunner(TypedDict, total=False):
    engine: str
    transport: str
    adapter: str
    provider: str


class RuntimeBridgeResult(TypedDict, total=False):
    ok: bool
    status: ExecutionStatus
    executed: bool
    executionSteps: List[RuntimeBridgeStep]
    message: str
    runner: RuntimeBridgeRunner
    actionLogs: List[ActionLog]
    reasoningLogs: List[ReasoningLog]
    transportSummary: str


class TransportExecutionInput(TypedDict):
    runId: str
    targetUrl: str
    provider: str
    mode: Mode
    transport: Transport
    shouldApply: bool
    safeStopBeforeSubmit: bool
    company: Optional[str]
    roleTitle: Optional[str]
    adapter: ProviderAdapter
    runtimeBridgeResult: Optional[RuntimeBridgeResult]
    browserSessionSummary: Optional[str]
    filledFieldCount: Optional[int]
    detectedFieldCount: Optional[int]


NOVA_ENGINE_NAME = "nova-act"
WORKFLOW_TRANSPORT_LABEL = "workflow"
API_TRANSPORT_LABEL = "api"


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_optional_text(value: Any) -> Optional[str]:
    text = _normalize_text(value)
    return text or None


def _as_mode(value: Any) -> Mode:
    if value == "plan":
        return "plan"
    if value == "live":
        return "live"
    return "demo"


def _as_transport(value: Any) -> Transport:
    if value == "api":
        return "api"
    return "workflow"


def _get_adapter_name(adapter: ProviderAdapter) -> str:
    explicit_name = getattr(adapter, "adapter_name", None)
    if isinstance(explicit_name, str) and explicit_name.strip():
        return explicit_name.strip()

    class_name = adapter.__class__.__name__.strip()
    if class_name:
        return class_name

    return "provider-adapter"


def _get_transport_label(transport: Transport) -> str:
    if transport == "api":
        return API_TRANSPORT_LABEL
    return WORKFLOW_TRANSPORT_LABEL


def _build_runner_metadata(
    normalized: TransportExecutionInput,
) -> RunnerMetadata:
    return {
        "engine": NOVA_ENGINE_NAME,
        "transport": _get_transport_label(normalized["transport"]),
        "adapter": _get_adapter_name(normalized["adapter"]),
        "provider": normalized["provider"],
    }


def _make_step(
    step_number: int,
    action: str,
    detail: str,
) -> ExecutionStep:
    return {
        "id": f"step_{step_number}",
        "action": action,
        "detail": detail,
    }


def _make_action_log(
    *,
    step_id: str,
    action: str,
    status: str,
    detail: str,
) -> ActionLog:
    return {
        "stepId": step_id,
        "action": action,
        "status": status,
        "detail": detail,
    }


def _make_reasoning_log(
    *,
    step_id: str,
    summary: str,
) -> ReasoningLog:
    return {
        "stepId": step_id,
        "summary": summary,
    }


def _normalize_input(payload: Dict[str, Any]) -> TransportExecutionInput:
    adapter = payload["adapter"]

    runtime_bridge_result = payload.get("runtimeBridgeResult")
    if not isinstance(runtime_bridge_result, dict):
        runtime_bridge_result = None

    filled_field_count_raw = payload.get("filledFieldCount")
    detected_field_count_raw = payload.get("detectedFieldCount")

    filled_field_count = (
        int(filled_field_count_raw)
        if isinstance(filled_field_count_raw, int)
        else None
    )
    detected_field_count = (
        int(detected_field_count_raw)
        if isinstance(detected_field_count_raw, int)
        else None
    )

    return {
        "runId": _normalize_text(payload.get("runId")),
        "targetUrl": _normalize_text(payload.get("targetUrl")),
        "provider": _normalize_text(payload.get("provider")) or "unknown",
        "mode": _as_mode(payload.get("mode")),
        "transport": _as_transport(payload.get("transport")),
        "shouldApply": bool(payload.get("shouldApply", False)),
        "safeStopBeforeSubmit": bool(
            payload.get("safeStopBeforeSubmit", True)
        ),
        "company": _normalize_optional_text(payload.get("company")),
        "roleTitle": _normalize_optional_text(payload.get("roleTitle")),
        "adapter": adapter,
        "runtimeBridgeResult": cast(
            Optional[RuntimeBridgeResult],
            runtime_bridge_result,
        ),
        "browserSessionSummary": _normalize_optional_text(
            payload.get("browserSessionSummary")
        ),
        "filledFieldCount": filled_field_count,
        "detectedFieldCount": detected_field_count,
    }


def _build_base_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    provider = normalized["provider"]
    adapter_name = _get_adapter_name(normalized["adapter"])
    target_url = normalized["targetUrl"]

    return [
        _make_step(
            1,
            "initialize",
            f"Initialize Python Nova runner for {provider} via {adapter_name}.",
        ),
        _make_step(
            2,
            "navigate",
            f"Prepare browser navigation for {target_url}.",
        ),
    ]


def _build_skip_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    steps = _build_base_steps(normalized)
    steps.extend(
        [
            _make_step(
                3,
                "threshold_check",
                "Confirm the job did not meet the apply threshold.",
            ),
            _make_step(
                4,
                "skip",
                "Stop without launching browser automation.",
            ),
        ]
    )
    return steps


def _build_plan_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    adapter_name = _get_adapter_name(normalized["adapter"])
    steps = _build_base_steps(normalized)
    steps.extend(
        [
            _make_step(
                3,
                "load_adapter",
                (
                    "Load provider-specific field and action rules from "
                    f"{adapter_name}."
                ),
            ),
            _make_step(
                4,
                "plan_only",
                "Return execution plan only. No live browser launched.",
            ),
        ]
    )
    return steps


def _build_demo_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    safe_stop = normalized["safeStopBeforeSubmit"]
    adapter_name = _get_adapter_name(normalized["adapter"])
    steps = _build_base_steps(normalized)
    steps.extend(
        [
            _make_step(
                3,
                "load_adapter",
                (
                    "Load provider-specific field and action rules from "
                    f"{adapter_name}."
                ),
            ),
            _make_step(
                4,
                "simulate_open",
                "Simulate opening the application page.",
            ),
            _make_step(
                5,
                "simulate_detect",
                "Simulate detecting visible form fields and apply controls.",
            ),
            _make_step(
                6,
                "simulate_fill",
                "Simulate prefilling candidate profile data.",
            ),
            _make_step(
                7,
                "safe_stop",
                (
                    "Stop before final submit in safe mode."
                    if safe_stop
                    else "Safe stop disabled for demo flow."
                ),
            ),
        ]
    )
    return steps


def _build_live_fallback_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    transport = normalized["transport"]
    safe_stop = normalized["safeStopBeforeSubmit"]
    provider = normalized["provider"]
    adapter_name = _get_adapter_name(normalized["adapter"])

    launch_detail = (
        "Launch API-driven Nova Act browser automation."
        if transport == "api"
        else "Launch workflow-driven Nova Act browser automation."
    )

    steps = _build_base_steps(normalized)
    steps.extend(
        [
            _make_step(
                3,
                "load_adapter",
                (
                    "Load provider-specific field and action rules from "
                    f"{adapter_name}."
                ),
            ),
            _make_step(
                4,
                "launch_browser",
                launch_detail,
            ),
            _make_step(
                5,
                "detect_provider_flow",
                (
                    "Execute provider-specific application flow logic for "
                    f"{provider} using {adapter_name}."
                ),
            ),
            _make_step(
                6,
                "prefill",
                "Prefill visible application fields.",
            ),
            _make_step(
                7,
                "safe_stop",
                (
                    "Stop before final submit in safe mode."
                    if safe_stop
                    else "Safe stop disabled; final submit may be allowed."
                ),
            ),
        ]
    )
    return steps


def _coerce_bridge_step(
    raw_step: RuntimeBridgeStep,
    fallback_index: int,
) -> ExecutionStep:
    step_id = _normalize_text(raw_step.get("id")) or f"step_{fallback_index}"
    action = _normalize_text(raw_step.get("action")) or "runtime"
    detail = _normalize_text(raw_step.get("detail")) or "Runtime bridge step."

    return {
        "id": step_id,
        "action": action,
        "detail": detail,
    }


def _coerce_bridge_steps(raw_steps: Any) -> List[ExecutionStep]:
    if not isinstance(raw_steps, list):
        return []

    steps: List[ExecutionStep] = []
    for index, raw_step in enumerate(raw_steps, start=1):
        if not isinstance(raw_step, dict):
            continue
        steps.append(
            _coerce_bridge_step(cast(RuntimeBridgeStep, raw_step), index)
        )

    return steps


def _coerce_action_logs(raw_logs: Any) -> List[ActionLog]:
    if not isinstance(raw_logs, list):
        return []

    logs: List[ActionLog] = []
    for raw_log in raw_logs:
        if not isinstance(raw_log, dict):
            continue

        step_id = _normalize_text(
            raw_log.get("stepId") or raw_log.get("step_id")
        )
        action = _normalize_text(raw_log.get("action"))
        status = _normalize_text(raw_log.get("status")) or "recorded"
        detail = _normalize_text(raw_log.get("detail"))

        if not step_id:
            step_id = f"step_{len(logs) + 1}"
        if not action:
            action = "runtime"
        if not detail:
            detail = "Runtime action log entry."

        logs.append(
            _make_action_log(
                step_id=step_id,
                action=action,
                status=status,
                detail=detail,
            )
        )

    return logs


def _coerce_reasoning_logs(raw_logs: Any) -> List[ReasoningLog]:
    if not isinstance(raw_logs, list):
        return []

    logs: List[ReasoningLog] = []
    for raw_log in raw_logs:
        if not isinstance(raw_log, dict):
            continue

        step_id = _normalize_text(
            raw_log.get("stepId") or raw_log.get("step_id")
        )
        summary = _normalize_text(raw_log.get("summary"))

        if not summary:
            continue
        if not step_id:
            step_id = f"step_{len(logs) + 1}"

        logs.append(
            _make_reasoning_log(
                step_id=step_id,
                summary=summary,
            )
        )

    return logs


def _build_action_logs_from_steps(
    execution_steps: List[ExecutionStep],
    *,
    executed: bool,
) -> List[ActionLog]:
    if not execution_steps:
        return []

    terminal_status = "executed" if executed else "planned"
    return [
        _make_action_log(
            step_id=step["id"],
            action=step["action"],
            status=terminal_status,
            detail=step["detail"],
        )
        for step in execution_steps
    ]


def _build_reasoning_logs_from_steps(
    execution_steps: List[ExecutionStep],
) -> List[ReasoningLog]:
    if not execution_steps:
        return []

    logs: List[ReasoningLog] = []
    for step in execution_steps:
        summary = (
            f"{step['action']} was included because the apply-agent flow "
            f"requires: {step['detail']}"
        )
        logs.append(
            _make_reasoning_log(
                step_id=step["id"],
                summary=summary,
            )
        )

    return logs


def _build_transport_summary(
    normalized: TransportExecutionInput,
    *,
    status: ExecutionStatus,
    executed: bool,
    execution_steps: List[ExecutionStep],
) -> str:
    provider = normalized["provider"]
    transport = _get_transport_label(normalized["transport"])
    mode = normalized["mode"]
    step_count = len(execution_steps)
    execution_label = "executed" if executed else "prepared"

    return (
        f"Transport executor {execution_label} a {mode} run for {provider} "
        f"using {transport} transport with {step_count} steps "
        f"and final status {status}."
    )


def _build_message(normalized: TransportExecutionInput) -> str:
    provider = normalized["provider"]
    transport = normalized["transport"]
    mode = normalized["mode"]
    should_apply = normalized["shouldApply"]
    adapter_name = _get_adapter_name(normalized["adapter"])

    if not should_apply:
        return (
            "Python Nova runner skipped execution because the role did not "
            "meet the apply threshold."
        )

    if mode == "plan":
        return (
            "Python Nova runner prepared successfully. "
            "Plan-only mode returned a provider-specific execution plan."
        )

    if mode == "demo":
        return (
            "Python Nova runner prepared successfully. "
            "Demo mode is simulating provider-specific browser actions."
        )

    return (
        "Python Nova runner prepared successfully. "
        f"Live execution is set to {transport} transport for {provider} "
        f"using {adapter_name}."
    )


def _build_live_message(
    normalized: TransportExecutionInput,
) -> str:
    runtime_bridge_result = normalized.get("runtimeBridgeResult")
    if runtime_bridge_result:
        runtime_message = _normalize_text(runtime_bridge_result.get("message"))
        if runtime_message:
            return runtime_message

    browser_session_summary = normalized.get("browserSessionSummary")
    if browser_session_summary:
        return (
            "Python Nova runner prepared successfully. "
            f"{browser_session_summary}"
        )

    return _build_message(normalized)


def _build_result(
    *,
    status: ExecutionStatus,
    executed: bool,
    execution_steps: List[ExecutionStep],
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    action_logs = _build_action_logs_from_steps(
        execution_steps,
        executed=executed,
    )
    reasoning_logs = _build_reasoning_logs_from_steps(execution_steps)
    transport_summary = _build_transport_summary(
        normalized,
        status=status,
        executed=executed,
        execution_steps=execution_steps,
    )

    return {
        "status": status,
        "executed": executed,
        "executionSteps": execution_steps,
        "message": _build_message(normalized),
        "runner": _build_runner_metadata(normalized),
        "actionLogs": action_logs,
        "reasoningLogs": reasoning_logs,
        "transportSummary": transport_summary,
    }


def _execute_skip(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return _build_result(
        status="completed",
        executed=False,
        execution_steps=_build_skip_steps(normalized),
        normalized=normalized,
    )


def _execute_plan_mode(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return _build_result(
        status="planned",
        executed=False,
        execution_steps=_build_plan_steps(normalized),
        normalized=normalized,
    )


def _execute_demo_mode(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return _build_result(
        status="queued",
        executed=False,
        execution_steps=_build_demo_steps(normalized),
        normalized=normalized,
    )


def _merge_runner_metadata(
    base_runner: RunnerMetadata,
    bridge_runner: Any,
) -> RunnerMetadata:
    if not isinstance(bridge_runner, dict):
        return base_runner

    return {
        "engine": _normalize_text(bridge_runner.get("engine"))
        or base_runner["engine"],
        "transport": _normalize_text(bridge_runner.get("transport"))
        or base_runner["transport"],
        "adapter": _normalize_text(bridge_runner.get("adapter"))
        or base_runner["adapter"],
        "provider": _normalize_text(bridge_runner.get("provider"))
        or base_runner["provider"],
    }


def _load_runtime_bridge_executor() -> Any:
    try:
        from .runtime_bridge import run_runtime_bridge
    except ImportError:
        from runtime_bridge import run_runtime_bridge  # type: ignore

    return run_runtime_bridge


def _should_invoke_runtime_bridge(
    normalized: TransportExecutionInput,
) -> bool:
    if normalized["mode"] != "live":
        return False

    if normalized["transport"] != "api":
        return False

    if not normalized["shouldApply"]:
        return False

    if normalized.get("runtimeBridgeResult") is not None:
        return False

    return bool(_normalize_text(os.getenv("NOVA_ACT_API")))


def _invoke_runtime_bridge_if_needed(
    normalized: TransportExecutionInput,
) -> Optional[RuntimeBridgeResult]:
    if not _should_invoke_runtime_bridge(normalized):
        return normalized.get("runtimeBridgeResult")

    run_runtime_bridge = _load_runtime_bridge_executor()

    bridge_payload: Dict[str, Any] = {
        "runId": normalized["runId"],
        "targetUrl": normalized["targetUrl"],
        "provider": normalized["provider"],
        "mode": normalized["mode"],
        "transport": normalized["transport"],
        "shouldApply": normalized["shouldApply"],
        "safeStopBeforeSubmit": normalized["safeStopBeforeSubmit"],
        "company": normalized["company"],
        "roleTitle": normalized["roleTitle"],
        "adapterName": _get_adapter_name(normalized["adapter"]),
    }

    try:
        bridge_result = run_runtime_bridge(bridge_payload)
    except Exception:
        return None

    if not isinstance(bridge_result, dict):
        return None

    if bridge_result.get("ok") is False:
        return None

    return cast(RuntimeBridgeResult, bridge_result)


def _build_live_steps_from_runtime_bridge(
    normalized: TransportExecutionInput,
) -> Optional[List[ExecutionStep]]:
    runtime_bridge_result = normalized.get("runtimeBridgeResult")
    if not runtime_bridge_result:
        return None

    bridge_steps = _coerce_bridge_steps(
        runtime_bridge_result.get("executionSteps")
    )
    if bridge_steps:
        return bridge_steps

    fallback_steps = _build_live_fallback_steps(normalized)

    browser_session_summary = normalized.get("browserSessionSummary")
    if browser_session_summary:
        fallback_steps.append(
            _make_step(
                len(fallback_steps) + 1,
                "browser_session",
                browser_session_summary,
            )
        )

    detected_field_count = normalized.get("detectedFieldCount")
    if isinstance(detected_field_count, int):
        fallback_steps.append(
            _make_step(
                len(fallback_steps) + 1,
                "field_detection",
                f"Detected {detected_field_count} application fields.",
            )
        )

    filled_field_count = normalized.get("filledFieldCount")
    if isinstance(filled_field_count, int):
        fallback_steps.append(
            _make_step(
                len(fallback_steps) + 1,
                "field_fill",
                f"Prepared {filled_field_count} field fill actions.",
            )
        )

    return fallback_steps


def _execute_live_mode(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    runtime_bridge_result = _invoke_runtime_bridge_if_needed(normalized)

    if runtime_bridge_result is not None:
        normalized["runtimeBridgeResult"] = runtime_bridge_result

    execution_steps = _build_live_steps_from_runtime_bridge(normalized)

    if execution_steps is None:
        execution_steps = _build_live_fallback_steps(normalized)

    status: ExecutionStatus = "running"
    executed = True
    runner = _build_runner_metadata(normalized)

    action_logs = _build_action_logs_from_steps(
        execution_steps,
        executed=True,
    )
    reasoning_logs = _build_reasoning_logs_from_steps(execution_steps)
    transport_summary = _build_transport_summary(
        normalized,
        status=status,
        executed=executed,
        execution_steps=execution_steps,
    )

    if runtime_bridge_result:
        bridge_status = runtime_bridge_result.get("status")
        if bridge_status in {
            "planned",
            "queued",
            "running",
            "completed",
            "failed",
        }:
            status = bridge_status

        bridge_executed = runtime_bridge_result.get("executed")
        if isinstance(bridge_executed, bool):
            executed = bridge_executed

        runner = _merge_runner_metadata(
            runner,
            runtime_bridge_result.get("runner"),
        )

        bridge_action_logs = _coerce_action_logs(
            runtime_bridge_result.get("actionLogs")
        )
        if bridge_action_logs:
            action_logs = bridge_action_logs
        else:
            action_logs = _build_action_logs_from_steps(
                execution_steps,
                executed=executed,
            )

        bridge_reasoning_logs = _coerce_reasoning_logs(
            runtime_bridge_result.get("reasoningLogs")
        )
        if bridge_reasoning_logs:
            reasoning_logs = bridge_reasoning_logs
        else:
            reasoning_logs = _build_reasoning_logs_from_steps(execution_steps)

        bridge_transport_summary = _normalize_text(
            runtime_bridge_result.get("transportSummary")
        )
        if bridge_transport_summary:
            transport_summary = bridge_transport_summary

    if not _normalize_text(transport_summary):
        transport_summary = _build_transport_summary(
            normalized,
            status=status,
            executed=executed,
            execution_steps=execution_steps,
        )

    return {
        "status": status,
        "executed": executed,
        "executionSteps": execution_steps,
        "message": _build_live_message(normalized),
        "runner": runner,
        "actionLogs": action_logs,
        "reasoningLogs": reasoning_logs,
        "transportSummary": transport_summary,
    }


def execute_transport(payload: Dict[str, Any]) -> TransportExecutionResult:
    """
    Central transport executor for the apply-agent Python runtime.

    This keeps the richer structured output:
    - executionSteps
    - runner metadata
    - actionLogs
    - reasoningLogs
    - transportSummary

    In live API mode, if NOVA_ACT_API is present, this can directly invoke
    the runtime bridge so the real Nova Act SDK browser path is attempted
    here instead of only returning a structured fallback.
    """
    normalized = _normalize_input(payload)

    if not normalized["shouldApply"]:
        return _execute_skip(normalized)

    mode = normalized["mode"]

    if mode == "plan":
        return _execute_plan_mode(normalized)

    if mode == "demo":
        return _execute_demo_mode(normalized)

    return _execute_live_mode(normalized)


def execute_transport_with_adapter(
    *,
    run_id: str,
    target_url: str,
    provider: str,
    mode: Mode,
    transport: Transport,
    should_apply: bool,
    safe_stop_before_submit: bool,
    company: Optional[str],
    role_title: Optional[str],
    adapter: ProviderAdapter,
    runtime_bridge_result: Optional[RuntimeBridgeResult] = None,
    browser_session_summary: Optional[str] = None,
    filled_field_count: Optional[int] = None,
    detected_field_count: Optional[int] = None,
) -> TransportExecutionResult:
    return execute_transport(
        {
            "runId": run_id,
            "targetUrl": target_url,
            "provider": provider,
            "mode": mode,
            "transport": transport,
            "shouldApply": should_apply,
            "safeStopBeforeSubmit": safe_stop_before_submit,
            "company": company,
            "roleTitle": role_title,
            "adapter": adapter,
            "runtimeBridgeResult": runtime_bridge_result,
            "browserSessionSummary": browser_session_summary,
            "filledFieldCount": filled_field_count,
            "detectedFieldCount": detected_field_count,
        }
    )
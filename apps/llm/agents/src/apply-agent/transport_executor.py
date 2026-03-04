from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict, cast

from .providers.base import ProviderAdapter


Mode = Literal["plan", "demo", "live"]
Transport = Literal["workflow", "api"]
ExecutionStatus = Literal["planned", "queued", "running", "completed", "failed"]


class ExecutionStep(TypedDict):
    id: str
    action: str
    detail: str


class RunnerMetadata(TypedDict):
    engine: str
    transport: str
    adapter: str
    provider: str


class TransportExecutionResult(TypedDict):
    status: ExecutionStatus
    executed: bool
    executionSteps: List[ExecutionStep]
    message: str
    runner: RunnerMetadata


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


class RuntimeBridgeStep(TypedDict, total=False):
    id: str
    action: str
    detail: str


class RuntimeBridgeResult(TypedDict, total=False):
    ok: bool
    status: ExecutionStatus
    executed: bool
    executionSteps: List[RuntimeBridgeStep]
    message: str
    runner: RunnerMetadata


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


def _build_runner_metadata(normalized: TransportExecutionInput) -> RunnerMetadata:
    return {
        "engine": NOVA_ENGINE_NAME,
        "transport": _get_transport_label(normalized["transport"]),
        "adapter": _get_adapter_name(normalized["adapter"]),
        "provider": normalized["provider"],
    }


def _get_provider_context_label(normalized: TransportExecutionInput) -> str:
    provider = normalized["provider"]
    adapter_name = _get_adapter_name(normalized["adapter"])
    return f"{provider} via {adapter_name}"


def _make_step(step_number: int, action: str, detail: str) -> ExecutionStep:
    return {
        "id": f"step_{step_number}",
        "action": action,
        "detail": detail,
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
        "safeStopBeforeSubmit": bool(payload.get("safeStopBeforeSubmit", True)),
        "company": _normalize_optional_text(payload.get("company")),
        "roleTitle": _normalize_optional_text(payload.get("roleTitle")),
        "adapter": adapter,
        "runtimeBridgeResult": cast(Optional[RuntimeBridgeResult], runtime_bridge_result),
        "browserSessionSummary": _normalize_optional_text(
            payload.get("browserSessionSummary")
        ),
        "filledFieldCount": filled_field_count,
        "detectedFieldCount": detected_field_count,
    }


def _build_base_steps(normalized: TransportExecutionInput) -> List[ExecutionStep]:
    provider_label = _get_provider_context_label(normalized)
    target_url = normalized["targetUrl"]

    return [
        _make_step(
            1,
            "initialize",
            f"Initialize Python Nova runner for {provider_label}.",
        ),
        _make_step(
            2,
            "navigate",
            f"Prepare browser navigation for {target_url}.",
        ),
    ]


def _build_skip_steps(normalized: TransportExecutionInput) -> List[ExecutionStep]:
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


def _build_plan_steps(normalized: TransportExecutionInput) -> List[ExecutionStep]:
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


def _build_demo_steps(normalized: TransportExecutionInput) -> List[ExecutionStep]:
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


def _build_live_steps(normalized: TransportExecutionInput) -> List[ExecutionStep]:
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
        steps.append(_coerce_bridge_step(cast(RuntimeBridgeStep, raw_step), index))

    return steps



def _build_live_steps_from_runtime_bridge(
    normalized: TransportExecutionInput,
) -> Optional[List[ExecutionStep]]:
    runtime_bridge_result = normalized.get("runtimeBridgeResult")
    if not runtime_bridge_result:
        return None

    bridge_steps = _coerce_bridge_steps(runtime_bridge_result.get("executionSteps"))
    if bridge_steps:
        return bridge_steps

    fallback_steps = _build_live_steps(normalized)

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
    execution_steps: List[ExecutionStep],
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

    if execution_steps:
        return _build_message(normalized)

    return _build_message(normalized)


def _build_result(
    *,
    status: ExecutionStatus,
    executed: bool,
    execution_steps: List[ExecutionStep],
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return {
        "status": status,
        "executed": executed,
        "executionSteps": execution_steps,
        "message": _build_message(normalized),
        "runner": _build_runner_metadata(normalized),
    }


def _execute_plan_mode(normalized: TransportExecutionInput) -> TransportExecutionResult:
    return _build_result(
        status="planned",
        executed=False,
        execution_steps=_build_plan_steps(normalized),
        normalized=normalized,
    )


def _execute_demo_mode(normalized: TransportExecutionInput) -> TransportExecutionResult:
    return _build_result(
        status="queued",
        executed=False,
        execution_steps=_build_demo_steps(normalized),
        normalized=normalized,
    )


def _execute_live_mode(normalized: TransportExecutionInput) -> TransportExecutionResult:
    runtime_bridge_result = normalized.get("runtimeBridgeResult")
    execution_steps = _build_live_steps_from_runtime_bridge(normalized)
    if execution_steps is None:
        execution_steps = _build_live_steps(normalized)

    status: ExecutionStatus = "running"
    executed = True
    runner = _build_runner_metadata(normalized)

    if runtime_bridge_result:
        bridge_status = runtime_bridge_result.get("status")
        if bridge_status in {"planned", "queued", "running", "completed", "failed"}:
            status = bridge_status

        bridge_executed = runtime_bridge_result.get("executed")
        if isinstance(bridge_executed, bool):
            executed = bridge_executed

        bridge_runner = runtime_bridge_result.get("runner")
        if isinstance(bridge_runner, dict):
            merged_runner: RunnerMetadata = {
                "engine": _normalize_text(bridge_runner.get("engine"))
                or runner["engine"],
                "transport": _normalize_text(bridge_runner.get("transport"))
                or runner["transport"],
                "adapter": _normalize_text(bridge_runner.get("adapter"))
                or runner["adapter"],
                "provider": _normalize_text(bridge_runner.get("provider"))
                or runner["provider"],
            }
            runner = merged_runner

    return {
        "status": status,
        "executed": executed,
        "executionSteps": execution_steps,
        "message": _build_live_message(normalized, execution_steps),
        "runner": runner,
    }


def _execute_skip(normalized: TransportExecutionInput) -> TransportExecutionResult:
    return _build_result(
        status="completed",
        executed=False,
        execution_steps=_build_skip_steps(normalized),
        normalized=normalized,
    )


def execute_transport(payload: Dict[str, Any]) -> TransportExecutionResult:
    """
    Central transport executor for the apply-agent Python runtime.

    This module is the single decision point for transport behavior.
    Right now it builds structured execution output for plan / demo / live
    and keeps the Nova Act-facing metadata in one place.

    This now supports an optional runtime bridge payload for live execution, and this is the safest
    place to replace simulated live-mode steps with a real transport call.
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
    """
    Convenience wrapper so nova_runner.py can call this with explicit args
    instead of building a dict itself.
    """
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
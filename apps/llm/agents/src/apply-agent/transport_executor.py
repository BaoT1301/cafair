from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from .providers.base import ProviderAdapter


Mode = Literal["plan", "demo", "live"]
Transport = Literal["workflow", "api"]


class ExecutionStep(TypedDict):
    id: str
    action: str
    detail: str


class TransportExecutionResult(TypedDict):
    status: str
    executed: bool
    executionSteps: List[ExecutionStep]
    message: str


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


def _get_adapter_name(adapter: ProviderAdapter) -> str:
    name = getattr(adapter, "adapter_name", None)
    if isinstance(name, str) and name.strip():
        return name.strip()

    cls_name = adapter.__class__.__name__.strip()
    if cls_name:
        return cls_name

    return "provider-adapter"


def _get_adapter_provider_label(
    normalized: TransportExecutionInput,
) -> str:
    adapter_name = _get_adapter_name(normalized["adapter"])
    provider = normalized["provider"]
    return f"{provider} via {adapter_name}"


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


def _resolve_status(
    should_apply: bool,
    mode: Mode,
) -> str:
    if not should_apply:
        return "completed"
    if mode == "plan":
        return "planned"
    if mode == "live":
        return "running"
    return "queued"


def _normalize_input(
    payload: Dict[str, Any],
) -> TransportExecutionInput:
    adapter = payload["adapter"]

    return {
        "runId": str(payload.get("runId", "")),
        "targetUrl": str(payload.get("targetUrl", "")),
        "provider": str(payload.get("provider", "unknown")),
        "mode": _as_mode(payload.get("mode")),
        "transport": _as_transport(payload.get("transport")),
        "shouldApply": bool(payload.get("shouldApply", False)),
        "safeStopBeforeSubmit": bool(
            payload.get("safeStopBeforeSubmit", True)
        ),
        "company": payload.get("company"),
        "roleTitle": payload.get("roleTitle"),
        "adapter": adapter,
    }


def _build_base_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    provider_label = _get_adapter_provider_label(normalized)
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


def _build_skip_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    steps = _build_base_steps(normalized)
    steps.append(
        _make_step(
            3,
            "skip",
            "Stop because the job did not meet the apply threshold.",
        )
    )
    return steps


def _build_plan_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    steps = _build_base_steps(normalized)
    steps.append(
        _make_step(
            3,
            "plan_only",
            "Return execution plan only. No live browser launched.",
        )
    )
    return steps


def _build_demo_steps(
    normalized: TransportExecutionInput,
) -> List[ExecutionStep]:
    safe_stop = normalized["safeStopBeforeSubmit"]

    steps = _build_base_steps(normalized)
    adapter_name = _get_adapter_name(normalized["adapter"])

    steps.extend(
        [
            _make_step(
                3,
                "simulate_open",
                "Simulate opening the application page.",
            ),
            _make_step(
                4,
                "simulate_detect",
                (
                    "Simulate detecting provider-specific apply controls, "
                    "visible fields, and adapter rules using "
                    f"{adapter_name}."
                ),
            ),
            _make_step(
                5,
                "simulate_fill",
                "Simulate prefilling candidate fields.",
            ),
            _make_step(
                6,
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


def _build_live_steps(
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
                "launch_browser",
                launch_detail,
            ),
            _make_step(
                4,
                "detect_provider_flow",
                (
                    "Execute provider-specific application flow logic for "
                    f"{provider} using {adapter_name}."
                ),
            ),
            _make_step(
                5,
                "prefill",
                "Prefill visible application fields.",
            ),
            _make_step(
                6,
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


def _build_message(
    normalized: TransportExecutionInput,
) -> str:
    provider = normalized["provider"]
    transport = normalized["transport"]
    mode = normalized["mode"]
    should_apply = normalized["shouldApply"]

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

    adapter_name = _get_adapter_name(normalized["adapter"])

    return (
        "Python Nova runner prepared successfully. "
        f"Live execution is set to {transport} transport for {provider} "
        f"using {adapter_name}."
    )


def _execute_plan_mode(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return {
        "status": "planned",
        "executed": False,
        "executionSteps": _build_plan_steps(normalized),
        "message": _build_message(normalized),
    }


def _execute_demo_mode(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return {
        "status": "queued",
        "executed": False,
        "executionSteps": _build_demo_steps(normalized),
        "message": _build_message(normalized),
    }


def _execute_live_mode(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return {
        "status": "running",
        "executed": True,
        "executionSteps": _build_live_steps(normalized),
        "message": _build_message(normalized),
    }


def _execute_skip(
    normalized: TransportExecutionInput,
) -> TransportExecutionResult:
    return {
        "status": "completed",
        "executed": False,
        "executionSteps": _build_skip_steps(normalized),
        "message": _build_message(normalized),
    }


def execute_transport(
    payload: Dict[str, Any],
) -> TransportExecutionResult:
    """
    Central transport executor for the apply-agent Python runtime.

    This file does not yet perform real browser automation.
    Instead, it is the single place that decides how execution should
    behave based on:
    - mode: plan / demo / live
    - transport: workflow / api
    - shouldApply: whether the job passed threshold

    Later, this is the safest place to replace simulated execution
    with a real Nova Act client or workflow bridge.
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
        }
    )
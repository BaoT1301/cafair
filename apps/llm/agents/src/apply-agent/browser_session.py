from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, TypedDict

from .form_filler import FillAction


BrowserTransport = Literal["workflow", "api"]
BrowserMode = Literal["demo", "plan", "live"]

BrowserStepAction = Literal[
    "launch_browser",
    "open_page",
    "wait_for_page",
    "find_element",
    "click",
    "type",
    "upload_file",
    "check",
    "select",
    "scroll_into_view",
    "capture_snapshot",
    "safe_stop",
    "skip",
    "blocked",
]

BrowserStepStatus = Literal[
    "ready",
    "skipped",
    "blocked",
    "completed",
]


class BrowserActionLog(TypedDict):
    stepId: str
    action: str
    status: str
    detail: str


class BrowserReasoningLog(TypedDict):
    stepId: str
    summary: str


class BrowserRuntimeStep(TypedDict, total=False):
    id: str
    action: str
    detail: str
    status: str


class BrowserRuntimeResult(TypedDict, total=False):
    ok: bool
    status: str
    executed: bool
    browserOpened: bool
    currentUrl: str
    browserSessionId: str
    browserEngine: str
    actionLogs: List[BrowserActionLog]
    reasoningLogs: List[BrowserReasoningLog]
    executionSteps: List[BrowserRuntimeStep]
    message: str


@dataclass(frozen=True)
class BrowserStep:
    step_id: str
    action: BrowserStepAction
    status: BrowserStepStatus
    detail: str
    selector: str
    value: Any
    field_name: str
    required: bool


@dataclass(frozen=True)
class BrowserExecutionResult:
    steps: List[BrowserStep]
    summary: Dict[str, Any]
    transport: BrowserTransport
    mode: BrowserMode
    executed: bool
    safe_stop_before_submit: bool
    live_supported: bool
    launch_requested: bool
    runtime_bridge_required: bool
    visible_browser_expected: bool
    provider: str
    target_url: str
    current_url: str
    browser_opened: bool
    browser_session_id: Optional[str]
    browser_engine: str
    action_logs: List[BrowserActionLog]
    reasoning_logs: List[BrowserReasoningLog]
    message: str


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _normalize_selector(selector: str) -> str:
    normalized = _safe_text(selector)
    return normalized or "body"


def _bool_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = _safe_text(value).lower()
    return text in {"true", "1", "yes", "y", "checked"}


def _coerce_mode(value: Any) -> BrowserMode:
    if value == "plan":
        return "plan"
    if value == "live":
        return "live"
    return "demo"


def _coerce_transport(value: Any) -> BrowserTransport:
    if value == "api":
        return "api"
    return "workflow"


def _coerce_step_action(value: Any) -> BrowserStepAction:
    allowed: set[str] = {
        "launch_browser",
        "open_page",
        "wait_for_page",
        "find_element",
        "click",
        "type",
        "upload_file",
        "check",
        "select",
        "scroll_into_view",
        "capture_snapshot",
        "safe_stop",
        "skip",
        "blocked",
    }
    text = _safe_text(value)
    if text in allowed:
        return text  # type: ignore[return-value]
    return "capture_snapshot"


def _coerce_step_status(value: Any) -> BrowserStepStatus:
    allowed: set[str] = {"ready", "skipped", "blocked", "completed"}
    text = _safe_text(value)
    if text in allowed:
        return text  # type: ignore[return-value]
    return "completed"


def _make_action_log(
    *,
    step_id: str,
    action: str,
    status: str,
    detail: str,
) -> BrowserActionLog:
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
) -> BrowserReasoningLog:
    return {
        "stepId": step_id,
        "summary": summary,
    }


def _build_step(
    *,
    step_id: str,
    action: BrowserStepAction,
    status: BrowserStepStatus,
    detail: str,
    selector: str = "",
    value: Any = "",
    field_name: str = "",
    required: bool = False,
) -> BrowserStep:
    return BrowserStep(
        step_id=step_id,
        action=action,
        status=status,
        detail=detail,
        selector=_normalize_selector(selector),
        value=value,
        field_name=field_name,
        required=required,
    )


def _map_fill_action_to_browser_steps(
    fill_action: FillAction,
    index: int,
) -> List[BrowserStep]:
    prefix = f"browser_{index}"
    selector = _normalize_selector(fill_action.selector)
    field_label = fill_action.field_name or fill_action.label

    if fill_action.status == "skipped":
        return [
            _build_step(
                step_id=f"{prefix}_skip",
                action="skip",
                status="skipped",
                detail=f"Skip field '{field_label}'. {fill_action.reason}",
                selector=selector,
                field_name=fill_action.field_name,
                required=fill_action.required,
            )
        ]

    if fill_action.status == "blocked":
        return [
            _build_step(
                step_id=f"{prefix}_blocked",
                action="blocked",
                status="blocked",
                detail=(
                    f"Cannot continue on field '{field_label}'. "
                    f"{fill_action.reason}"
                ),
                selector=selector,
                field_name=fill_action.field_name,
                required=fill_action.required,
            )
        ]

    steps: List[BrowserStep] = [
        _build_step(
            step_id=f"{prefix}_scroll",
            action="scroll_into_view",
            status="ready",
            detail=f"Scroll field '{field_label}' into view.",
            selector=selector,
            field_name=fill_action.field_name,
            required=fill_action.required,
        ),
        _build_step(
            step_id=f"{prefix}_find",
            action="find_element",
            status="ready",
            detail=f"Locate field '{field_label}'.",
            selector=selector,
            field_name=fill_action.field_name,
            required=fill_action.required,
        ),
    ]

    if fill_action.action in {"type_text", "type_email", "type_tel"}:
        steps.append(
            _build_step(
                step_id=f"{prefix}_type",
                action="type",
                status="ready",
                detail=f"Type value into '{field_label}'.",
                selector=selector,
                value=_safe_text(fill_action.value),
                field_name=fill_action.field_name,
                required=fill_action.required,
            )
        )
        return steps

    if fill_action.action == "upload_file":
        steps.append(
            _build_step(
                step_id=f"{prefix}_upload",
                action="upload_file",
                status="ready",
                detail=f"Upload file for '{field_label}'.",
                selector=selector,
                value=_safe_text(fill_action.value),
                field_name=fill_action.field_name,
                required=fill_action.required,
            )
        )
        return steps

    if fill_action.action == "set_checkbox":
        steps.append(
            _build_step(
                step_id=f"{prefix}_check",
                action="check",
                status="ready",
                detail=f"Set checkbox for '{field_label}'.",
                selector=selector,
                value=_bool_value(fill_action.value),
                field_name=fill_action.field_name,
                required=fill_action.required,
            )
        )
        return steps

    if fill_action.action == "select_option":
        steps.append(
            _build_step(
                step_id=f"{prefix}_select",
                action="select",
                status="ready",
                detail=f"Select option for '{field_label}'.",
                selector=selector,
                value=_safe_text(fill_action.value),
                field_name=fill_action.field_name,
                required=fill_action.required,
            )
        )
        return steps

    steps.append(
        _build_step(
            step_id=f"{prefix}_skip_unknown",
            action="skip",
            status="skipped",
            detail=(
                f"Skip unsupported field action '{fill_action.action}' "
                f"for '{field_label}'."
            ),
            selector=selector,
            field_name=fill_action.field_name,
            required=fill_action.required,
        )
    )
    return steps


def build_browser_steps(
    *,
    run_id: str,
    target_url: str,
    provider: str,
    mode: BrowserMode,
    transport: BrowserTransport,
    should_apply: bool,
    safe_stop_before_submit: bool,
    apply_button_selectors: Optional[List[str]] = None,
    fill_actions: Optional[List[FillAction]] = None,
) -> List[BrowserStep]:
    steps: List[BrowserStep] = []

    if mode == "live":
        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )
        steps.append(
            _build_step(
                step_id="session_launch_browser",
                action="launch_browser",
                status="ready",
                detail=launch_detail,
                selector="body",
                value=transport,
            )
        )

    steps.append(
        _build_step(
            step_id="session_open",
            action="open_page",
            status="ready",
            detail=(
                f"Open target application page for {provider} "
                f"using {transport} transport."
            ),
            selector=target_url,
            value=target_url,
        )
    )

    steps.append(
        _build_step(
            step_id="session_wait",
            action="wait_for_page",
            status="ready",
            detail="Wait for the page to stabilize.",
            selector="body",
        )
    )

    steps.append(
        _build_step(
            step_id="session_snapshot",
            action="capture_snapshot",
            status="ready",
            detail="Capture an initial snapshot of the visible page state.",
            selector="body",
        )
    )

    if not should_apply:
        steps.append(
            _build_step(
                step_id="session_skip_threshold",
                action="skip",
                status="skipped",
                detail=(
                    "Stop here because this role did not pass the "
                    "apply threshold."
                ),
                selector="body",
            )
        )
        return steps

    if apply_button_selectors:
        primary_selector = _normalize_selector(apply_button_selectors[0])

        steps.append(
            _build_step(
                step_id="apply_find",
                action="find_element",
                status="ready",
                detail="Find the provider-specific Apply entry point.",
                selector=primary_selector,
            )
        )

        if mode != "plan":
            steps.append(
                _build_step(
                    step_id="apply_click",
                    action="click",
                    status="ready",
                    detail="Click the provider-specific Apply button.",
                    selector=primary_selector,
                )
            )
            steps.append(
                _build_step(
                    step_id="apply_wait_after_click",
                    action="wait_for_page",
                    status="ready",
                    detail="Wait for the application form to load.",
                    selector="body",
                )
            )

    if mode == "plan":
        steps.append(
            _build_step(
                step_id="session_plan_only",
                action="skip",
                status="skipped",
                detail=(
                    "Plan mode only. Do not launch live browser "
                    "interactions."
                ),
                selector="body",
            )
        )
        return steps

    for index, fill_action in enumerate(fill_actions or [], start=1):
        steps.extend(_map_fill_action_to_browser_steps(fill_action, index))

    if safe_stop_before_submit:
        steps.append(
            _build_step(
                step_id="session_safe_stop",
                action="safe_stop",
                status="ready",
                detail=(
                    "Stop before final submit. Human review is required "
                    "before submitting the application."
                ),
                selector="button[type='submit']",
            )
        )
    else:
        steps.append(
            _build_step(
                step_id="session_submit_blocked",
                action="blocked",
                status="blocked",
                detail="Final submit is intentionally not automated by this layer.",
                selector="button[type='submit']",
            )
        )

    return steps


def browser_steps_to_dicts(steps: List[BrowserStep]) -> List[Dict[str, Any]]:
    return [
        {
            "step_id": step.step_id,
            "action": step.action,
            "status": step.status,
            "detail": step.detail,
            "selector": step.selector,
            "value": step.value,
            "field_name": step.field_name,
            "required": step.required,
        }
        for step in steps
    ]


def summarize_browser_steps(steps: List[BrowserStep]) -> Dict[str, Any]:
    ready_count = sum(1 for step in steps if step.status == "ready")
    skipped_count = sum(1 for step in steps if step.status == "skipped")
    blocked_count = sum(1 for step in steps if step.status == "blocked")
    completed_count = sum(1 for step in steps if step.status == "completed")

    return {
        "total_steps": len(steps),
        "ready_count": ready_count,
        "skipped_count": skipped_count,
        "blocked_count": blocked_count,
        "completed_count": completed_count,
        "can_continue": blocked_count == 0,
        "has_safe_stop": any(step.action == "safe_stop" for step in steps),
        "launches_browser": any(
            step.action == "launch_browser" for step in steps
        ),
    }


def _build_action_logs(steps: List[BrowserStep]) -> List[BrowserActionLog]:
    logs: List[BrowserActionLog] = []

    for step in steps:
        if step.status == "completed":
            log_status = "completed"
        elif step.status == "blocked":
            log_status = "blocked"
        elif step.status == "skipped":
            log_status = "skipped"
        else:
            log_status = "planned"

        logs.append(
            _make_action_log(
                step_id=step.step_id,
                action=step.action,
                status=log_status,
                detail=step.detail,
            )
        )

    return logs


def _build_reasoning_logs(steps: List[BrowserStep]) -> List[BrowserReasoningLog]:
    logs: List[BrowserReasoningLog] = []

    for step in steps:
        logs.append(
            _make_reasoning_log(
                step_id=step.step_id,
                summary=(
                    f"Browser step '{step.action}' exists because the "
                    f"apply flow needs: {step.detail}"
                ),
            )
        )

    return logs


def _coerce_runtime_steps(
    raw_steps: Any,
) -> Optional[List[BrowserStep]]:
    if not isinstance(raw_steps, list):
        return None

    coerced: List[BrowserStep] = []

    for index, raw_step in enumerate(raw_steps, start=1):
        if not isinstance(raw_step, dict):
            continue

        step_id = _safe_text(raw_step.get("id")) or f"runtime_{index}"
        action = _coerce_step_action(raw_step.get("action"))
        detail = _safe_text(raw_step.get("detail")) or "Runtime browser step."
        status = _coerce_step_status(raw_step.get("status"))

        coerced.append(
            _build_step(
                step_id=step_id,
                action=action,
                status=status,
                detail=detail,
                selector="body",
            )
        )

    return coerced or None


def _merge_logs(
    runtime_logs: Any,
    fallback_logs: List[Dict[str, str]],
    *,
    kind: Literal["action", "reasoning"],
) -> List[Any]:
    if not isinstance(runtime_logs, list):
        return fallback_logs

    if kind == "action":
        merged: List[BrowserActionLog] = []
        for index, item in enumerate(runtime_logs, start=1):
            if not isinstance(item, dict):
                continue
            merged.append(
                _make_action_log(
                    step_id=_safe_text(item.get("stepId")) or f"step_{index}",
                    action=_safe_text(item.get("action")) or "runtime",
                    status=_safe_text(item.get("status")) or "recorded",
                    detail=_safe_text(item.get("detail")) or "Runtime action log.",
                )
            )
        return merged or fallback_logs

    merged_reasoning: List[BrowserReasoningLog] = []
    for index, item in enumerate(runtime_logs, start=1):
        if not isinstance(item, dict):
            continue
        summary = _safe_text(item.get("summary"))
        if not summary:
            continue
        merged_reasoning.append(
            _make_reasoning_log(
                step_id=_safe_text(item.get("stepId")) or f"step_{index}",
                summary=summary,
            )
        )
    return merged_reasoning or fallback_logs


def build_browser_session_plan(
    *,
    run_id: str,
    target_url: str,
    provider: str,
    mode: BrowserMode,
    transport: BrowserTransport,
    should_apply: bool,
    safe_stop_before_submit: bool,
    apply_button_selectors: Optional[List[str]] = None,
    fill_actions: Optional[List[FillAction]] = None,
) -> Dict[str, Any]:
    steps = build_browser_steps(
        run_id=run_id,
        target_url=target_url,
        provider=provider,
        mode=mode,
        transport=transport,
        should_apply=should_apply,
        safe_stop_before_submit=safe_stop_before_submit,
        apply_button_selectors=apply_button_selectors,
        fill_actions=fill_actions,
    )

    summary = summarize_browser_steps(steps)
    launch_requested = bool(
        mode == "live"
        and should_apply
        and summary.get("launches_browser", False)
    )

    return {
        "steps": browser_steps_to_dicts(steps),
        "summary": summary,
        "transport": transport,
        "mode": mode,
        "safe_stop_before_submit": safe_stop_before_submit,
        "launch_requested": launch_requested,
        "runtime_bridge_required": bool(mode == "live" and should_apply),
        "visible_browser_expected": bool(mode == "live" and should_apply),
        "starting_url": target_url,
        "current_url": target_url if launch_requested else "",
        "browser_opened": False,
    }


def execute_browser_session(
    *,
    run_id: str,
    target_url: str,
    provider: str,
    mode: BrowserMode,
    transport: BrowserTransport,
    should_apply: bool,
    safe_stop_before_submit: bool,
    apply_button_selectors: Optional[List[str]] = None,
    fill_actions: Optional[List[FillAction]] = None,
    runtime_result: Optional[BrowserRuntimeResult] = None,
) -> BrowserExecutionResult:
    steps = build_browser_steps(
        run_id=run_id,
        target_url=target_url,
        provider=provider,
        mode=mode,
        transport=transport,
        should_apply=should_apply,
        safe_stop_before_submit=safe_stop_before_submit,
        apply_button_selectors=apply_button_selectors,
        fill_actions=fill_actions,
    )

    summary = summarize_browser_steps(steps)
    launch_requested = bool(
        mode == "live"
        and should_apply
        and summary.get("launches_browser", False)
    )
    runtime_bridge_required = bool(mode == "live" and should_apply)
    visible_browser_expected = bool(mode == "live" and should_apply)

    action_logs = _build_action_logs(steps)
    reasoning_logs = _build_reasoning_logs(steps)

    if mode == "plan":
        executed = False
        live_supported = False
        browser_opened = False
        current_url = ""
        browser_session_id = None
        browser_engine = "nova-act"
        message = (
            "Browser session built in plan mode only. "
            "No live browser was started."
        )
    elif mode == "demo":
        executed = False
        live_supported = False
        browser_opened = False
        current_url = ""
        browser_session_id = None
        browser_engine = "nova-act"
        message = (
            "Browser session built in demo mode. "
            "Steps are ready but not executed live."
        )
    else:
        executed = False
        live_supported = True
        browser_opened = False
        current_url = ""
        browser_session_id = None
        browser_engine = "nova-act"

        if transport == "api":
            message = (
                "Browser session is ready for live execution. "
                "The runtime bridge should open a visible browser window."
            )
        else:
            message = (
                "Browser session is ready for live execution. "
                "The workflow bridge should execute the visible browser flow."
            )

        if isinstance(runtime_result, dict):
            runtime_steps = _coerce_runtime_steps(
                runtime_result.get("executionSteps")
            )
            if runtime_steps:
                steps = runtime_steps
                summary = summarize_browser_steps(steps)

            executed = bool(runtime_result.get("executed", False))
            browser_opened = bool(runtime_result.get("browserOpened", False))
            current_url = (
                _safe_text(runtime_result.get("currentUrl")) or target_url
                if browser_opened
                else _safe_text(runtime_result.get("currentUrl"))
            )
            browser_session_id = (
                _safe_text(runtime_result.get("browserSessionId")) or None
            )
            browser_engine = (
                _safe_text(runtime_result.get("browserEngine")) or "nova-act"
            )
            runtime_message = _safe_text(runtime_result.get("message"))
            if runtime_message:
                message = runtime_message

            action_logs = _merge_logs(
                runtime_result.get("actionLogs"),
                action_logs,
                kind="action",
            )
            reasoning_logs = _merge_logs(
                runtime_result.get("reasoningLogs"),
                reasoning_logs,
                kind="reasoning",
            )

    return BrowserExecutionResult(
        steps=steps,
        summary=summary,
        transport=transport,
        mode=mode,
        executed=executed,
        safe_stop_before_submit=safe_stop_before_submit,
        live_supported=live_supported,
        launch_requested=launch_requested,
        runtime_bridge_required=runtime_bridge_required,
        visible_browser_expected=visible_browser_expected,
        provider=provider,
        target_url=target_url,
        current_url=current_url,
        browser_opened=browser_opened,
        browser_session_id=browser_session_id,
        browser_engine=browser_engine,
        action_logs=action_logs,
        reasoning_logs=reasoning_logs,
        message=message,
    )


def browser_execution_result_to_dict(
    result: BrowserExecutionResult,
) -> Dict[str, Any]:
    return {
        "steps": browser_steps_to_dicts(result.steps),
        "summary": result.summary,
        "transport": result.transport,
        "mode": result.mode,
        "executed": result.executed,
        "safe_stop_before_submit": result.safe_stop_before_submit,
        "live_supported": result.live_supported,
        "launch_requested": result.launch_requested,
        "runtime_bridge_required": result.runtime_bridge_required,
        "visible_browser_expected": result.visible_browser_expected,
        "provider": result.provider,
        "target_url": result.target_url,
        "current_url": result.current_url,
        "browser_opened": result.browser_opened,
        "browser_session_id": result.browser_session_id,
        "browser_engine": result.browser_engine,
        "action_logs": result.action_logs,
        "reasoning_logs": result.reasoning_logs,
        "message": result.message,
    }
    
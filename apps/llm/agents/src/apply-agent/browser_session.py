from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

from .form_filler import FillAction


BrowserTransport = Literal["workflow", "api"]
BrowserMode = Literal["demo", "plan", "live"]


BrowserStepAction = Literal[
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


BrowserStepStatus = Literal["ready", "skipped", "blocked"]


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

    if fill_action.status == "skipped":
        return [
            _build_step(
                step_id=f"{prefix}_skip",
                action="skip",
                status="skipped",
                detail=(
                    f"Skip field '{fill_action.field_name or fill_action.label}'. "
                    f"{fill_action.reason}"
                ),
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
                    f"Cannot continue on field "
                    f"'{fill_action.field_name or fill_action.label}'. "
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
            detail=(
                f"Scroll field '{fill_action.field_name or fill_action.label}' "
                f"into view."
            ),
            selector=selector,
            field_name=fill_action.field_name,
            required=fill_action.required,
        ),
        _build_step(
            step_id=f"{prefix}_find",
            action="find_element",
            status="ready",
            detail=(
                f"Locate field '{fill_action.field_name or fill_action.label}'."
            ),
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
                detail=(
                    f"Type value into '{fill_action.field_name or fill_action.label}'."
                ),
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
                detail=(
                    f"Upload file for '{fill_action.field_name or fill_action.label}'."
                ),
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
                detail=(
                    f"Set checkbox for '{fill_action.field_name or fill_action.label}'."
                ),
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
                detail=(
                    f"Select option for '{fill_action.field_name or fill_action.label}'."
                ),
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
                f"Skip unsupported field action '{fill_action.action}' for "
                f"'{fill_action.field_name or fill_action.label}'."
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

    steps.append(
        _build_step(
            step_id="session_open",
            action="open_page",
            status="ready",
            detail=f"Open target application page for {provider}.",
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
                    "Stop here because this role did not pass the apply threshold."
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
                detail="Plan mode only. Do not launch live browser interactions.",
                selector="body",
            )
        )
        return steps

    fill_actions = fill_actions or []

    for index, fill_action in enumerate(fill_actions, start=1):
        steps.extend(_map_fill_action_to_browser_steps(fill_action, index))

    if safe_stop_before_submit:
        steps.append(
            _build_step(
                step_id="session_safe_stop",
                action="safe_stop",
                status="ready",
                detail=(
                    "Stop before final submit. Human review is required before "
                    "submitting the application."
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
                detail=(
                    "Final submit is intentionally not automated by this layer."
                ),
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

    can_continue = blocked_count == 0

    return {
        "total_steps": len(steps),
        "ready_count": ready_count,
        "skipped_count": skipped_count,
        "blocked_count": blocked_count,
        "can_continue": can_continue,
    }


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

    return {
        "steps": browser_steps_to_dicts(steps),
        "summary": summarize_browser_steps(steps),
        "transport": transport,
        "mode": mode,
        "safe_stop_before_submit": safe_stop_before_submit,
    }
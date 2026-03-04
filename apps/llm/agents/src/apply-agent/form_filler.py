from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

from .field_mapper import FieldMappingResult


FillActionType = Literal[
    "type_text",
    "type_email",
    "type_tel",
    "upload_file",
    "set_checkbox",
    "select_option",
    "skip",
]

FillStatus = Literal["ready", "skipped", "blocked"]


@dataclass(frozen=True)
class FillAction:
    step_id: str
    action: FillActionType
    status: FillStatus
    selector: str
    field_name: str
    label: str
    field_type: str
    required: bool
    value: Any
    reason: str


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _normalize_key(value: str) -> str:
    normalized = _normalize_text(value).lower()
    normalized = normalized.replace("-", "_")
    normalized = normalized.replace(" ", "_")
    normalized = normalized.replace("/", "_")
    normalized = normalized.replace(".", "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def _stringify_value(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _resolve_action_type(field: FieldMappingResult) -> FillActionType:
    field_type = _normalize_key(field.field_type)
    field_name = _normalize_key(field.field_name)
    label = _normalize_key(field.label)
    combined = f"{field_name} {label}".strip()

    if field_type in {"file", "upload"}:
        return "upload_file"

    if field_type in {"checkbox", "boolean", "bool"}:
        return "set_checkbox"

    if field_type in {"select", "dropdown"}:
        return "select_option"

    if field_type in {"email"}:
        return "type_email"

    if field_type in {"tel", "phone"}:
        return "type_tel"

    if "email" in combined:
        return "type_email"

    if "phone" in combined or "mobile" in combined:
        return "type_tel"

    return "type_text"


def _build_skip_action(
    *,
    step_id: str,
    field: FieldMappingResult,
    reason: str,
    status: FillStatus = "skipped",
) -> FillAction:
    return FillAction(
        step_id=step_id,
        action="skip",
        status=status,
        selector=field.selector,
        field_name=field.field_name,
        label=field.label,
        field_type=field.field_type,
        required=field.required,
        value="",
        reason=reason,
    )


def _build_ready_action(
    *,
    step_id: str,
    field: FieldMappingResult,
    action: FillActionType,
    value: Any,
    reason: str,
) -> FillAction:
    return FillAction(
        step_id=step_id,
        action=action,
        status="ready",
        selector=field.selector,
        field_name=field.field_name,
        label=field.label,
        field_type=field.field_type,
        required=field.required,
        value=value,
        reason=reason,
    )


def _build_blocked_action(
    *,
    step_id: str,
    field: FieldMappingResult,
    action: FillActionType,
    reason: str,
) -> FillAction:
    return FillAction(
        step_id=step_id,
        action=action,
        status="blocked",
        selector=field.selector,
        field_name=field.field_name,
        label=field.label,
        field_type=field.field_type,
        required=field.required,
        value="",
        reason=reason,
    )


def _plan_single_field(step_id: str, field: FieldMappingResult) -> FillAction:
    action_type = _resolve_action_type(field)

    if not field.should_fill:
        if field.required:
            return _build_blocked_action(
                step_id=step_id,
                field=field,
                action=action_type,
                reason=(
                    "Required field has no mapped value from applicant profile."
                ),
            )

        return _build_skip_action(
            step_id=step_id,
            field=field,
            reason="Optional field has no mapped value, so it will be skipped.",
        )

    if action_type == "upload_file":
        file_path = _normalize_text(field.value)
        if not file_path:
            if field.required:
                return _build_blocked_action(
                    step_id=step_id,
                    field=field,
                    action=action_type,
                    reason="Required file field is missing a file path.",
                )

            return _build_skip_action(
                step_id=step_id,
                field=field,
                reason="Optional file field has no file path, so it will be skipped.",
            )

        return _build_ready_action(
            step_id=step_id,
            field=field,
            action=action_type,
            value=file_path,
            reason="Upload mapped file from applicant profile.",
        )

    if action_type == "set_checkbox":
        return _build_ready_action(
            step_id=step_id,
            field=field,
            action=action_type,
            value=bool(field.value),
            reason="Set checkbox using mapped boolean-style profile value.",
        )

    if action_type == "select_option":
        selected_value = _normalize_text(field.value)
        if not selected_value and field.required:
            return _build_blocked_action(
                step_id=step_id,
                field=field,
                action=action_type,
                reason="Required select field has no mapped option.",
            )

        if not selected_value:
            return _build_skip_action(
                step_id=step_id,
                field=field,
                reason="Optional select field has no mapped option, so it will be skipped.",
            )

        return _build_ready_action(
            step_id=step_id,
            field=field,
            action=action_type,
            value=selected_value,
            reason="Select mapped option from applicant profile.",
        )

    text_value = _normalize_text(_stringify_value(field.value))

    if not text_value and field.required:
        return _build_blocked_action(
            step_id=step_id,
            field=field,
            action=action_type,
            reason="Required text field has no mapped value.",
        )

    if not text_value:
        return _build_skip_action(
            step_id=step_id,
            field=field,
            reason="Optional text field has no mapped value, so it will be skipped.",
        )

    return _build_ready_action(
        step_id=step_id,
        field=field,
        action=action_type,
        value=text_value,
        reason="Fill field using mapped applicant profile value.",
    )


def build_fill_actions(
    mapped_fields: List[FieldMappingResult],
) -> List[FillAction]:
    actions: List[FillAction] = []

    for index, field in enumerate(mapped_fields, start=1):
        step_id = f"fill_{index}"
        action = _plan_single_field(step_id, field)
        actions.append(action)

    return actions


def fill_actions_to_dicts(actions: List[FillAction]) -> List[Dict[str, Any]]:
    return [
        {
            "step_id": action.step_id,
            "action": action.action,
            "status": action.status,
            "selector": action.selector,
            "field_name": action.field_name,
            "label": action.label,
            "field_type": action.field_type,
            "required": action.required,
            "value": action.value,
            "reason": action.reason,
        }
        for action in actions
    ]


def summarize_fill_actions(actions: List[FillAction]) -> Dict[str, Any]:
    ready_count = sum(1 for action in actions if action.status == "ready")
    skipped_count = sum(1 for action in actions if action.status == "skipped")
    blocked_count = sum(1 for action in actions if action.status == "blocked")

    blocked_required_fields = [
        action.field_name or action.label
        for action in actions
        if action.status == "blocked" and action.required
    ]

    return {
        "total_actions": len(actions),
        "ready_count": ready_count,
        "skipped_count": skipped_count,
        "blocked_count": blocked_count,
        "can_proceed": blocked_count == 0,
        "blocked_required_fields": blocked_required_fields,
    }


def build_fill_plan(
    mapped_fields: List[FieldMappingResult],
) -> Dict[str, Any]:
    actions = build_fill_actions(mapped_fields)
    summary = summarize_fill_actions(actions)

    return {
        "actions": fill_actions_to_dicts(actions),
        "summary": summary,
    }
from __future__ import annotations

from typing import Any, Dict, List, Optional


def _safe_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    return []


def _safe_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _count_required_fields(fields: List[Dict[str, Any]]) -> int:
    total = 0
    for field in fields:
        if isinstance(field, dict) and bool(field.get("required")):
            total += 1
    return total


def _count_required_mapped(mapped_fields: List[Dict[str, Any]]) -> int:
    total = 0
    for item in mapped_fields:
        if not isinstance(item, dict):
            continue
        if bool(item.get("required")) and bool(item.get("hasValue")):
            total += 1
    return total


def _count_fill_actions(
    fill_actions: List[Dict[str, Any]],
) -> Dict[str, int]:
    counts = {
        "total": 0,
        "ready": 0,
        "skipped": 0,
        "blocked": 0,
    }

    for action in fill_actions:
        if not isinstance(action, dict):
            continue

        counts["total"] += 1
        status = _safe_str(action.get("status")).lower()

        if status == "ready":
            counts["ready"] += 1
        elif status == "skipped":
            counts["skipped"] += 1
        elif status == "blocked":
            counts["blocked"] += 1

    return counts


def _safe_optional_dict(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, dict):
        return value
    return None



def _safe_optional_list(value: Any) -> Optional[List[Any]]:
    if isinstance(value, list):
        return value
    return None



def _prefer_transport_value(
    primary: Any,
    fallback: Any,
) -> Any:
    if isinstance(primary, str):
        if primary.strip():
            return primary.strip()
    elif primary is not None:
        return primary

    if isinstance(fallback, str):
        return fallback.strip()
    return fallback


def _derive_overall_status(
    *,
    should_apply: bool,
    mode: str,
    browser_summary: Dict[str, Any],
    fill_counts: Dict[str, int],
) -> str:
    if not should_apply:
        return "completed"

    if fill_counts.get("blocked", 0) > 0:
        return "failed"

    if not bool(browser_summary.get("can_continue", True)):
        return "failed"

    normalized_mode = _safe_str(mode).lower()

    if normalized_mode == "plan":
        return "planned"
    if normalized_mode == "live":
        return "running"
    return "queued"


def _build_human_summary(
    *,
    provider: str,
    mode: str,
    should_apply: bool,
    browser_summary: Dict[str, Any],
    fill_counts: Dict[str, int],
    role_title: str,
    company: str,
) -> str:
    role_part = role_title or "target role"
    company_part = company or "target company"
    provider_part = provider or "unknown"

    if not should_apply:
        return (
            f"Skipped {provider_part} apply flow for {role_part} at "
            f"{company_part} because the job did not pass the threshold."
        )

    if fill_counts.get("blocked", 0) > 0:
        return (
            f"{provider_part} apply flow for {role_part} at {company_part} "
            f"has blocked fields that need manual review."
        )

    if not bool(browser_summary.get("can_continue", True)):
        return (
            f"{provider_part} browser plan for {role_part} at {company_part} "
            f"contains blocked steps and should be reviewed manually."
        )

    if mode == "plan":
        return (
            f"{provider_part} apply plan is ready for {role_part} at "
            f"{company_part}. No live browser was launched."
        )

    if mode == "live":
        return (
            f"{provider_part} apply flow is prepared for live execution for "
            f"{role_part} at {company_part}."
        )

    return (
        f"{provider_part} apply flow is prepared in demo mode for "
        f"{role_part} at {company_part}."
    )


def build_execution_report(
    *,
    run_id: str,
    provider: str,
    mode: str,
    target_url: str,
    company: Optional[str],
    role_title: Optional[str],
    should_apply: bool,
    safe_stop_before_submit: bool,
    transport: str,
    runner_meta: Optional[Dict[str, Any]] = None,
    provider_result: Optional[Dict[str, Any]] = None,
    profile_result: Optional[Dict[str, Any]] = None,
    field_mapping_result: Optional[Dict[str, Any]] = None,
    form_fill_result: Optional[Dict[str, Any]] = None,
    browser_session_result: Optional[Dict[str, Any]] = None,
    transport_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    provider_result = _safe_dict(provider_result)
    profile_result = _safe_dict(profile_result)
    field_mapping_result = _safe_dict(field_mapping_result)
    form_fill_result = _safe_dict(form_fill_result)
    browser_session_result = _safe_dict(browser_session_result)
    runner_meta = _safe_dict(runner_meta)
    transport_result = _safe_dict(transport_result)

    visible_fields = _safe_list(provider_result.get("visibleFields"))
    provider_selectors = _safe_list(provider_result.get("selectors"))
    provider_planned_steps = _safe_list(provider_result.get("plannedSteps"))

    profile_data = _safe_dict(profile_result.get("profile"))
    profile_missing = _safe_list(profile_result.get("missingRequiredKeys"))

    mapped_fields = _safe_list(field_mapping_result.get("mappedFields"))
    unmapped_fields = _safe_list(field_mapping_result.get("unmappedFields"))

    fill_actions = _safe_list(form_fill_result.get("fillActions"))
    browser_steps = _safe_list(browser_session_result.get("steps"))
    browser_summary = _safe_dict(browser_session_result.get("summary"))

    transport_execution_steps = _safe_optional_list(
        transport_result.get("executionSteps")
    )
    transport_action_logs = _safe_optional_list(
        transport_result.get("actionLogs")
    )
    transport_reasoning_logs = _safe_optional_list(
        transport_result.get("reasoningLogs")
    )
    transport_runner = _safe_optional_dict(transport_result.get("runner"))

    required_field_count = _count_required_fields(visible_fields)
    required_mapped_count = _count_required_mapped(mapped_fields)
    fill_counts = _count_fill_actions(fill_actions)

    derived_status = _derive_overall_status(
        should_apply=should_apply,
        mode=mode,
        browser_summary=browser_summary,
        fill_counts=fill_counts,
    )

    overall_status = _safe_str(transport_result.get("status")) or derived_status

    if "executed" in transport_result:
        executed = bool(transport_result.get("executed"))
    else:
        executed = (
            should_apply
            and mode == "live"
            and overall_status == "running"
        )

    human_summary = _build_human_summary(
        provider=provider,
        mode=mode,
        should_apply=should_apply,
        browser_summary=browser_summary,
        fill_counts=fill_counts,
        role_title=_safe_str(role_title),
        company=_safe_str(company),
    )

    report = {
        "ok": bool(transport_result.get("ok", overall_status != "failed")),
        "runId": run_id,
        "provider": provider,
        "mode": mode,
        "transport": transport,
        "status": overall_status,
        "executed": executed,
        "safeStopBeforeSubmit": safe_stop_before_submit,
        "targetUrl": target_url,
        "company": company,
        "roleTitle": role_title,
        "runner": transport_runner or runner_meta,
        "visibleFields": visible_fields,
        "selectors": provider_selectors,
        "plannedSteps": provider_planned_steps,
        "profile": {
            "loaded": bool(profile_result.get("loaded", False)),
            "source": _safe_str(profile_result.get("source")),
            "profile": profile_data,
            "missingRequiredKeys": profile_missing,
        },
        "mapping": {
            "mappedFields": mapped_fields,
            "unmappedFields": unmapped_fields,
            "requiredFieldCount": required_field_count,
            "requiredMappedCount": required_mapped_count,
        },
        "fill": {
            "fillActions": fill_actions,
            "counts": fill_counts,
        },
        "browser": {
            "steps": browser_steps,
            "summary": browser_summary,
        },
        "transportResult": {
            "status": overall_status,
            "executed": executed,
            "executionSteps": transport_execution_steps,
            "actionLogs": transport_action_logs,
            "reasoningLogs": transport_reasoning_logs,
            "runner": transport_runner,
            "transportSummary": _safe_str(
                transport_result.get("transportSummary")
            ),
            "message": _safe_str(transport_result.get("message")),
        },
        "message": _prefer_transport_value(
            transport_result.get("message"),
            human_summary,
        ),
    }

    return report


def build_python_response_from_report(
    report: Dict[str, Any],
) -> Dict[str, Any]:
    browser = _safe_dict(report.get("browser"))
    fill = _safe_dict(report.get("fill"))
    transport_result = _safe_dict(report.get("transportResult"))

    browser_steps = _safe_list(browser.get("steps"))
    fill_actions = _safe_list(fill.get("fillActions"))

    execution_steps: List[Dict[str, Any]] = _safe_list(
        transport_result.get("executionSteps")
    )

    response = {
        "ok": bool(report.get("ok", False)),
        "runId": _safe_str(report.get("runId")),
        "provider": _safe_str(report.get("provider")) or "unknown",
        "mode": _safe_str(report.get("mode")) or "demo",
        "status": _safe_str(transport_result.get("status"))
        or _safe_str(report.get("status"))
        or "failed",
        "executed": bool(
            transport_result.get("executed", report.get("executed", False))
        ),
        "safeStopBeforeSubmit": bool(report.get("safeStopBeforeSubmit", True)),
        "visibleFields": _safe_list(report.get("visibleFields")),
        "executionSteps": execution_steps,
        "message": _safe_str(
            transport_result.get("message") or report.get("message")
        ),
        "runner": _safe_dict(
            transport_result.get("runner") or report.get("runner")
        ),
        "targetUrl": _safe_str(report.get("targetUrl")),
        "company": report.get("company"),
        "roleTitle": report.get("roleTitle"),
        "selectors": _safe_list(report.get("selectors")),
        "plannedSteps": _safe_list(report.get("plannedSteps")),
        "profile": _safe_dict(report.get("profile")),
        "mapping": _safe_dict(report.get("mapping")),
        "fill": {
            "fillActions": fill_actions,
            "counts": _safe_dict(fill.get("counts")),
        },
        "browser": {
            "summary": _safe_dict(_safe_dict(report.get("browser")).get("summary")),
        },
        "actionLogs": _safe_list(transport_result.get("actionLogs")),
        "reasoningLogs": _safe_list(
            transport_result.get("reasoningLogs")
        ),
        "transportSummary": _safe_str(
            transport_result.get("transportSummary")
        ),
        "transportResult": transport_result,
    }

    return response

from __future__ import annotations

import json
import sys
from typing import Any, Dict, Literal, Optional, TypedDict, cast

from .browser_session import build_browser_session
from .execution_report import (
    build_execution_report,
    build_python_response_from_report,
)
from .field_mapper import map_profile_to_fields
from .form_filler import build_form_fill_actions
from .profile_loader import load_profile_for_provider
from .providers.base import ProviderAdapter, get_provider_adapter
from .transport_executor import execute_transport_with_adapter


Provider = Literal["greenhouse", "workday", "ashby", "unknown"]
Mode = Literal["plan", "demo", "live"]
Transport = Literal["workflow", "api"]


class NormalizedPayload(TypedDict):
    runId: str
    targetUrl: str
    company: Optional[str]
    roleTitle: Optional[str]
    provider: Provider
    mode: Mode
    transport: Transport
    shouldApply: bool
    safeStopBeforeSubmit: bool


class ErrorResult(TypedDict, total=False):
    ok: bool
    error: str
    details: str


def _as_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _as_bool(value: Any, default: bool = False) -> bool:
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


def _normalize_provider(value: Any) -> Provider:
    provider = _as_str(value, "unknown").lower()

    if provider == "greenhouse":
        return "greenhouse"
    if provider == "workday":
        return "workday"
    if provider == "ashby":
        return "ashby"

    return "unknown"


def _normalize_mode(value: Any) -> Mode:
    mode = _as_str(value, "demo").lower()

    if mode == "plan":
        return "plan"
    if mode == "live":
        return "live"

    return "demo"


def _normalize_transport(value: Any) -> Transport:
    transport = _as_str(value, "workflow").lower()

    if transport == "api":
        return "api"

    return "workflow"


def _detect_provider_from_url(target_url: str) -> Provider:
    lowered = target_url.lower()

    if "greenhouse.io" in lowered:
        return "greenhouse"
    if "ashbyhq.com" in lowered:
        return "ashby"
    if "myworkdayjobs.com" in lowered or "workday" in lowered:
        return "workday"

    return "unknown"


def _normalize_payload(payload: Dict[str, Any]) -> NormalizedPayload:
    run_id = _as_str(payload.get("runId"))
    target_url = _as_str(payload.get("targetUrl"))
    company = _as_str(payload.get("company")) or None
    role_title = _as_str(payload.get("roleTitle")) or None

    provider_from_payload = _normalize_provider(payload.get("provider"))
    provider = (
        provider_from_payload
        if provider_from_payload != "unknown"
        else _detect_provider_from_url(target_url)
    )

    return {
        "runId": run_id,
        "targetUrl": target_url,
        "company": company,
        "roleTitle": role_title,
        "provider": provider,
        "mode": _normalize_mode(payload.get("mode")),
        "transport": _normalize_transport(payload.get("transport")),
        "shouldApply": _as_bool(payload.get("shouldApply"), False),
        "safeStopBeforeSubmit": _as_bool(
            payload.get("safeStopBeforeSubmit"),
            True,
        ),
    }


def _validate_payload(normalized: NormalizedPayload) -> None:
    if not normalized["runId"]:
        raise ValueError("runId is required.")

    if not normalized["targetUrl"]:
        raise ValueError("targetUrl is required.")


def _build_runner_meta(
    provider: Provider,
    transport: Transport,
    adapter: ProviderAdapter,
) -> Dict[str, Any]:
    return {
        "engine": "nova-act",
        "transport": transport,
        "adapter": adapter.adapter_name,
        "provider": provider,
    }


def _build_provider_result(
    normalized: NormalizedPayload,
    adapter: ProviderAdapter,
) -> Dict[str, Any]:
    selectors = adapter.selectors()
    planned_steps = adapter.build_plan_steps(
        company=normalized["company"],
        role_title=normalized["roleTitle"],
        should_apply=normalized["shouldApply"],
        safe_stop=normalized["safeStopBeforeSubmit"],
    )
    visible_fields = adapter.visible_fields()

    return {
        "provider": normalized["provider"],
        "safeStopBeforeSubmit": normalized["safeStopBeforeSubmit"],
        "selectors": selectors,
        "plannedSteps": planned_steps,
        "visibleFields": visible_fields,
    }


def _build_browser_session_summary(
    browser_session_result: Dict[str, Any],
) -> Optional[str]:
    message = browser_session_result.get("message")
    if isinstance(message, str) and message.strip():
        return message.strip()

    summary = browser_session_result.get("summary")
    if isinstance(summary, dict):
        total_steps = summary.get("total_steps")
        if isinstance(total_steps, int):
            return f"Browser session prepared with {total_steps} steps."

    return None


def _augment_response(
    response: Dict[str, Any],
    normalized: NormalizedPayload,
    provider_result: Dict[str, Any],
    transport_result: Dict[str, Any],
    browser_session_result: Dict[str, Any],
    profile_result: Dict[str, Any],
    field_mapping_result: Dict[str, Any],
    form_fill_result: Dict[str, Any],
) -> Dict[str, Any]:
    if "status" in transport_result:
        response["status"] = transport_result["status"]

    if "executed" in transport_result:
        response["executed"] = transport_result["executed"]

    if "executionSteps" in transport_result:
        response["executionSteps"] = transport_result["executionSteps"]

    if "message" in transport_result and transport_result.get("message"):
        response["message"] = transport_result["message"]

    if "runner" in transport_result:
        response["runner"] = transport_result["runner"]

    if "actionLogs" in transport_result:
        response["actionLogs"] = transport_result["actionLogs"]

    if "reasoningLogs" in transport_result:
        response["reasoningLogs"] = transport_result["reasoningLogs"]

    if "transportSummary" in transport_result:
        response["transportSummary"] = transport_result["transportSummary"]

    response["browserSession"] = browser_session_result
    response["profile"] = profile_result
    response["fieldMapping"] = field_mapping_result
    response["formFill"] = form_fill_result

    response["targetUrl"] = normalized["targetUrl"]
    response["company"] = normalized["company"]
    response["roleTitle"] = normalized["roleTitle"]
    response["selectors"] = provider_result["selectors"]
    response["plannedSteps"] = provider_result["plannedSteps"]
    response["visibleFields"] = provider_result["visibleFields"]

    return response


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _normalize_payload(payload)
    _validate_payload(normalized)

    adapter = get_provider_adapter(normalized["provider"])

    provider_result = _build_provider_result(
        normalized=normalized,
        adapter=adapter,
    )

    profile_result = load_profile_for_provider(
        provider=normalized["provider"],
        company=normalized["company"],
        role_title=normalized["roleTitle"],
    )

    field_mapping_result = map_profile_to_fields(
        visible_fields=provider_result["visibleFields"],
        profile_result=profile_result,
        provider=normalized["provider"],
    )

    form_fill_result = build_form_fill_actions(
        mapped_fields=field_mapping_result["mappedFields"],
        should_apply=normalized["shouldApply"],
        safe_stop_before_submit=normalized["safeStopBeforeSubmit"],
        mode=normalized["mode"],
    )

    browser_session_result = build_browser_session(
        run_id=normalized["runId"],
        target_url=normalized["targetUrl"],
        provider=normalized["provider"],
        mode=normalized["mode"],
        transport=normalized["transport"],
        should_apply=normalized["shouldApply"],
        safe_stop_before_submit=normalized["safeStopBeforeSubmit"],
        selectors=provider_result["selectors"],
        planned_steps=provider_result["plannedSteps"],
        fill_actions=form_fill_result["fillActions"],
        company=normalized["company"],
        role_title=normalized["roleTitle"],
        adapter_name=adapter.adapter_name,
    )

    browser_session_summary = _build_browser_session_summary(
        browser_session_result
    )

    fill_actions = form_fill_result.get("fillActions", [])
    filled_field_count = 0
    if isinstance(fill_actions, list):
        filled_field_count = sum(
            1
            for action in fill_actions
            if isinstance(action, dict)
            and action.get("status") == "ready"
        )

    visible_fields = provider_result.get("visibleFields", [])
    detected_field_count = len(visible_fields) if isinstance(
        visible_fields,
        list,
    ) else 0

    runtime_bridge_result = None
    if normalized["mode"] == "live" and normalized["shouldApply"]:
        if browser_session_result.get("runtime_bridge_required"):
            runtime_bridge_result = cast(
                Optional[Dict[str, Any]],
                browser_session_result.get("runtimeBridgeResult"),
            )

    transport_result = execute_transport_with_adapter(
        run_id=normalized["runId"],
        target_url=normalized["targetUrl"],
        provider=normalized["provider"],
        mode=normalized["mode"],
        transport=normalized["transport"],
        should_apply=normalized["shouldApply"],
        safe_stop_before_submit=normalized["safeStopBeforeSubmit"],
        company=normalized["company"],
        role_title=normalized["roleTitle"],
        adapter=adapter,
        runtime_bridge_result=runtime_bridge_result,
        browser_session_summary=browser_session_summary,
        filled_field_count=filled_field_count,
        detected_field_count=detected_field_count,
    )

    runner_meta = _build_runner_meta(
        provider=normalized["provider"],
        transport=normalized["transport"],
        adapter=adapter,
    )

    report = build_execution_report(
        run_id=normalized["runId"],
        provider=normalized["provider"],
        mode=normalized["mode"],
        target_url=normalized["targetUrl"],
        company=normalized["company"],
        role_title=normalized["roleTitle"],
        should_apply=normalized["shouldApply"],
        safe_stop_before_submit=normalized["safeStopBeforeSubmit"],
        transport=normalized["transport"],
        runner_meta=runner_meta,
        provider_result=provider_result,
        profile_result=profile_result,
        field_mapping_result=field_mapping_result,
        form_fill_result=form_fill_result,
        browser_session_result=browser_session_result,
        transport_result=transport_result,
    )

    response = build_python_response_from_report(report)

    return _augment_response(
        response=response,
        normalized=normalized,
        provider_result=provider_result,
        transport_result=transport_result,
        browser_session_result=browser_session_result,
        profile_result=profile_result,
        field_mapping_result=field_mapping_result,
        form_fill_result=form_fill_result,
    )


def _read_stdin_payload() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()

    if not raw:
        raise ValueError("No JSON payload received by Python runner.")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Top-level JSON payload must be an object.")

    return parsed


def _print_json(data: Dict[str, Any]) -> None:
    print(json.dumps(data, ensure_ascii=False))


def _print_error_and_exit(error: str, details: str = "") -> None:
    result: ErrorResult = {
        "ok": False,
        "error": error,
    }

    if details:
        result["details"] = details

    _print_json(result)
    sys.exit(1)


def main() -> None:
    try:
        payload = _read_stdin_payload()
    except Exception as exc:  # noqa: BLE001
        _print_error_and_exit(
            "Failed to read Python runner payload.",
            str(exc),
        )
        return

    try:
        result = run(payload)
        _print_json(result)
    except Exception as exc:  # noqa: BLE001
        _print_error_and_exit(
            "Unhandled error in Python Nova runner.",
            str(exc),
        )


if __name__ == "__main__":
    main()
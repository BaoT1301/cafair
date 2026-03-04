from __future__ import annotations

import json
import sys
from typing import Any, Dict, Literal, Optional, TypedDict

from .browser_session import build_browser_session
from .execution_report import (
    build_execution_report,
    build_python_response_from_report,
)
from .field_mapper import map_profile_to_fields
from .form_filler import build_form_fill_actions
from .profile_loader import load_profile_for_provider
from .providers.base import ProviderAdapter, get_provider_adapter


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
    return str(value)


def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y"}:
            return True
        if lowered in {"false", "0", "no", "n"}:
            return False

    if isinstance(value, (int, float)):
        return bool(value)

    return default


def _normalize_provider(value: Any) -> Provider:
    provider = _as_str(value, "unknown").strip().lower()

    if provider == "greenhouse":
        return "greenhouse"
    if provider == "workday":
        return "workday"
    if provider == "ashby":
        return "ashby"

    return "unknown"


def _normalize_mode(value: Any) -> Mode:
    mode = _as_str(value, "demo").strip().lower()

    if mode == "plan":
        return "plan"
    if mode == "live":
        return "live"

    return "demo"


def _normalize_transport(value: Any) -> Transport:
    transport = _as_str(value, "workflow").strip().lower()

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
    run_id = _as_str(payload.get("runId"), "").strip()
    target_url = _as_str(payload.get("targetUrl"), "").strip()
    company = _as_str(payload.get("company"), "").strip() or None
    role_title = _as_str(payload.get("roleTitle"), "").strip() or None

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


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _normalize_payload(payload)
    _validate_payload(normalized)

    adapter = get_provider_adapter(normalized["provider"])

    provider_result = {
        "provider": normalized["provider"],
        "safeStopBeforeSubmit": normalized["safeStopBeforeSubmit"],
        "selectors": adapter.selectors(),
        "plannedSteps": adapter.build_plan_steps(
            company=normalized["company"],
            role_title=normalized["roleTitle"],
            should_apply=normalized["shouldApply"],
            safe_stop=normalized["safeStopBeforeSubmit"],
        ),
        "visibleFields": adapter.visible_fields(),
    }

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
    )

    return build_python_response_from_report(report)


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


def _print_error_and_exit(error: str, details: str = "") -> None:
    result: ErrorResult = {
        "ok": False,
        "error": error,
    }

    if details:
        result["details"] = details

    print(json.dumps(result))
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
        print(json.dumps(result))
    except Exception as exc:  # noqa: BLE001
        _print_error_and_exit(
            "Unhandled error in Python Nova runner.",
            str(exc),
        )


if __name__ == "__main__":
    main()
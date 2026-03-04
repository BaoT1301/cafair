from __future__ import annotations

import json
import sys
from typing import Any, Dict, Literal, Optional, TypedDict

from .browser_session import build_browser_session_plan
from .execution_report import (
    build_execution_report,
    build_python_response_from_report,
)
from .providers.base import ProviderAdapter, get_provider_adapter
from .transport_executor import execute_transport_with_adapter

try:
    from . import field_mapper as field_mapper_module
except ImportError:
    import field_mapper as field_mapper_module  # type: ignore

try:
    from . import form_filler as form_filler_module
except ImportError:
    import form_filler as form_filler_module  # type: ignore

try:
    from . import profile_loader as profile_loader_module
except ImportError:
    import profile_loader as profile_loader_module  # type: ignore


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


def _normalize_profile_result(result: Any) -> Dict[str, Any]:
    if isinstance(result, dict):
        if "profile" in result and isinstance(result.get("profile"), dict):
            return result
        return {
            "profile": result,
            "summary": {
                "loaded": True,
                "source": "direct_dict",
            },
        }

    return {
        "profile": {},
        "summary": {
            "loaded": False,
            "source": "empty_fallback",
        },
    }


def _load_profile_result(
    normalized: NormalizedPayload,
) -> Dict[str, Any]:
    loader = getattr(profile_loader_module, "load_profile_for_provider", None)
    if callable(loader):
        return _normalize_profile_result(
            loader(
                provider=normalized["provider"],
                company=normalized["company"],
                role_title=normalized["roleTitle"],
            )
        )

    loader = getattr(profile_loader_module, "load_applicant_profile_dict", None)
    if callable(loader):
        return _normalize_profile_result(loader())

    loader = getattr(profile_loader_module, "load_applicant_profile", None)
    if callable(loader):
        return _normalize_profile_result(loader())

    return {
        "profile": {},
        "summary": {
            "loaded": False,
            "source": "missing_loader_fallback",
        },
    }


def _normalize_field_mapping_result(result: Any) -> Dict[str, Any]:
    if not isinstance(result, dict):
        return {
            "mappedFields": [],
            "results": [],
            "summary": {
                "total": 0,
            },
        }

    mapped_fields = result.get("mappedFields")
    if not isinstance(mapped_fields, list):
        mapped_fields = []

    results = result.get("results")
    if not isinstance(results, list):
        results = mapped_fields

    normalized: Dict[str, Any] = dict(result)
    normalized["mappedFields"] = mapped_fields
    normalized["results"] = results

    if "summary" not in normalized or not isinstance(normalized.get("summary"), dict):
        normalized["summary"] = {
            "total": len(results),
        }

    return normalized


def _map_fields(
    normalized: NormalizedPayload,
    provider_result: Dict[str, Any],
    profile_result: Dict[str, Any],
) -> Dict[str, Any]:
    visible_fields = provider_result["visibleFields"]
    profile = profile_result.get("profile")
    if not isinstance(profile, dict):
        profile = {}

    mapper = getattr(field_mapper_module, "map_visible_fields_to_profile", None)
    if not callable(mapper):
        raise RuntimeError(
            "field_mapper.py is missing map_visible_fields_to_profile."
        )

    try:
        result = mapper(
            visible_fields=visible_fields,
            profile=profile,
            provider=normalized["provider"],
        )
    except TypeError:
        result = mapper(
            visible_fields=visible_fields,
            profile=profile,
        )

    return _normalize_field_mapping_result(result)


def _normalize_form_fill_result(result: Any) -> Dict[str, Any]:
    if not isinstance(result, dict):
        return {
            "fillActions": [],
            "actions": [],
            "summary": {
                "total": 0,
                "ready": 0,
            },
        }

    fill_actions = result.get("fillActions")
    if not isinstance(fill_actions, list):
        fill_actions = []

    actions = result.get("actions")
    if not isinstance(actions, list):
        actions = fill_actions

    normalized: Dict[str, Any] = dict(result)
    normalized["fillActions"] = fill_actions
    normalized["actions"] = actions

    if "summary" not in normalized or not isinstance(normalized.get("summary"), dict):
        ready_count = 0
        for action in fill_actions:
            if isinstance(action, dict) and action.get("status") == "ready":
                ready_count += 1
        normalized["summary"] = {
            "total": len(fill_actions),
            "ready": ready_count,
        }

    return normalized


def _build_form_fill_result(
    normalized: NormalizedPayload,
    field_mapping_result: Dict[str, Any],
) -> Dict[str, Any]:
    mapped_fields = field_mapping_result.get("mappedFields", [])
    if not isinstance(mapped_fields, list):
        mapped_fields = []

    legacy_builder = getattr(form_filler_module, "build_form_fill_actions", None)
    if callable(legacy_builder):
        return _normalize_form_fill_result(
            legacy_builder(
                mapped_fields=mapped_fields,
                should_apply=normalized["shouldApply"],
                safe_stop_before_submit=normalized["safeStopBeforeSubmit"],
                mode=normalized["mode"],
            )
        )

    build_fill_actions = getattr(form_filler_module, "build_fill_actions", None)
    if not callable(build_fill_actions):
        raise RuntimeError(
            "form_filler.py is missing build_fill_actions."
        )

    fill_actions = build_fill_actions(mapped_fields)

    build_fill_plan = getattr(form_filler_module, "build_fill_plan", None)
    if callable(build_fill_plan):
        try:
            plan_result = build_fill_plan(actions=fill_actions)
        except TypeError:
            plan_result = build_fill_plan(fill_actions)

        normalized_plan = _normalize_form_fill_result(plan_result)
        if not normalized_plan["fillActions"]:
            normalized_plan["fillActions"] = fill_actions
        if not normalized_plan["actions"]:
            normalized_plan["actions"] = fill_actions
        return normalized_plan

    return _normalize_form_fill_result(
        {
            "fillActions": fill_actions,
            "actions": fill_actions,
        }
    )


def _count_ready_fill_actions(form_fill_result: Dict[str, Any]) -> int:
    fill_actions = form_fill_result.get("fillActions", [])
    if not isinstance(fill_actions, list):
        return 0

    count = 0
    for action in fill_actions:
        if isinstance(action, dict) and action.get("status") == "ready":
            count += 1
    return count


def _count_detected_fields(provider_result: Dict[str, Any]) -> int:
    visible_fields = provider_result.get("visibleFields", [])
    if not isinstance(visible_fields, list):
        return 0
    return len(visible_fields)


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
    if transport_result.get("message"):
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

    # Convenience top-level fields for downstream callers.
    # These mirror the enriched values produced by profile_loader -> field_mapper -> form_filler.
    profile_dict = profile_result.get("profile")
    response["applicantProfile"] = profile_dict if isinstance(profile_dict, dict) else {}

    mapped_fields = field_mapping_result.get("mappedFields")
    response["mappedFields"] = mapped_fields if isinstance(mapped_fields, list) else []

    fill_actions = form_fill_result.get("fillActions")
    response["fillActions"] = fill_actions if isinstance(fill_actions, list) else []

    profile_summary = profile_result.get("summary")
    response["profileSummary"] = (
        profile_summary if isinstance(profile_summary, dict) else {}
    )

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

    profile_result = _load_profile_result(normalized)

    field_mapping_result = _map_fields(
        normalized=normalized,
        provider_result=provider_result,
        profile_result=profile_result,
    )

    form_fill_result = _build_form_fill_result(
        normalized=normalized,
        field_mapping_result=field_mapping_result,
    )

    browser_session_result = build_browser_session_plan(
        run_id=normalized["runId"],
        target_url=normalized["targetUrl"],
        provider=normalized["provider"],
        mode=normalized["mode"],
        transport=normalized["transport"],
        should_apply=normalized["shouldApply"],
        safe_stop_before_submit=normalized["safeStopBeforeSubmit"],
        apply_button_selectors=provider_result["selectors"],
        fill_actions=form_fill_result["fillActions"],
    )

    browser_session_summary = _build_browser_session_summary(
        browser_session_result
    )

    filled_field_count = _count_ready_fill_actions(form_fill_result)
    detected_field_count = _count_detected_fields(provider_result)

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
        runtime_bridge_result=None,
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
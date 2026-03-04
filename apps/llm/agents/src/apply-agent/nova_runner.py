from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Literal, Optional, TypedDict

from .providers.base import ProviderAdapter
from .providers.base import get_provider_adapter
from .transport_executor import execute_transport_with_adapter


Provider = Literal["greenhouse", "workday", "ashby", "unknown"]
Mode = Literal["plan", "demo", "live"]
Transport = Literal["workflow", "api"]


class VisibleField(TypedDict):
    name: str
    label: str
    type: str
    required: bool
    selector: str


class ExecutionStep(TypedDict):
    id: str
    action: str
    detail: str


class RunnerMeta(TypedDict):
    engine: str
    transport: str
    adapter: str
    provider: str


class PlanResult(TypedDict):
    provider: Provider
    safeStopBeforeSubmit: bool
    selectors: List[str]
    steps: List[str]


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


class RunnerResult(TypedDict):
    ok: bool
    runId: str
    provider: Provider
    mode: Mode
    status: str
    executed: bool
    safeStopBeforeSubmit: bool
    visibleFields: List[VisibleField]
    executionSteps: List[ExecutionStep]
    message: str
    runner: RunnerMeta
    targetUrl: str
    company: Optional[str]
    roleTitle: Optional[str]
    selectors: List[str]
    plannedSteps: List[str]


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
    run_id = _as_str(payload.get("runId"), "")
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


def _build_runner_meta(
    provider: Provider,
    transport: Transport,
    adapter: ProviderAdapter,
) -> RunnerMeta:
    return {
        "engine": "nova-act",
        "transport": transport,
        "adapter": adapter.adapter_name,
        "provider": provider,
    }


def _build_plan(
    normalized: NormalizedPayload,
    adapter: ProviderAdapter,
) -> PlanResult:
    return {
        "provider": normalized["provider"],
        "safeStopBeforeSubmit": normalized["safeStopBeforeSubmit"],
        "selectors": adapter.selectors(),
        "steps": adapter.build_plan_steps(
            company=normalized["company"],
            role_title=normalized["roleTitle"],
            should_apply=normalized["shouldApply"],
            safe_stop=normalized["safeStopBeforeSubmit"],
        ),
    }


def run(payload: Dict[str, Any]) -> RunnerResult:
    normalized = _normalize_payload(payload)
    adapter = get_provider_adapter(normalized["provider"])

    plan = _build_plan(normalized, adapter)
    visible_fields = adapter.visible_fields()
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
    )
    runner = _build_runner_meta(
        provider=normalized["provider"],
        transport=normalized["transport"],
        adapter=adapter,
    )

    return {
        "ok": True,
        "runId": normalized["runId"],
        "provider": normalized["provider"],
        "mode": normalized["mode"],
        "status": transport_result["status"],
        "executed": transport_result["executed"],
        "safeStopBeforeSubmit": normalized["safeStopBeforeSubmit"],
        "visibleFields": visible_fields,
        "executionSteps": transport_result["executionSteps"],
        "message": transport_result["message"],
        "runner": runner,
        "targetUrl": normalized["targetUrl"],
        "company": normalized["company"],
        "roleTitle": normalized["roleTitle"],
        "selectors": plan["selectors"],
        "plannedSteps": plan["steps"],
    }


def main() -> None:
    raw = sys.stdin.read().strip()

    if not raw:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "No JSON payload received by Python runner.",
                }
            )
        )
        sys.exit(1)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Invalid JSON payload.",
                    "details": str(exc),
                }
            )
        )
        sys.exit(1)

    try:
        result = run(payload)
        print(json.dumps(result))
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Unhandled error in Python Nova runner.",
                    "details": str(exc),
                }
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
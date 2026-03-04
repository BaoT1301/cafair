from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Literal, Optional, TypedDict


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
) -> RunnerMeta:
    adapter_map = {
        "greenhouse": "greenhouse-form-adapter",
        "ashby": "ashby-form-adapter",
        "workday": "workday-form-adapter",
        "unknown": "generic-form-adapter",
    }

    return {
        "engine": "nova-act",
        "transport": transport,
        "adapter": adapter_map.get(provider, "generic-form-adapter"),
        "provider": provider,
    }



def _greenhouse_selectors() -> List[str]:
    return [
        "button",
        "a[href*='application']",
        "button[aria-label*='Apply']",
        "button[data-mapped='true']",
        "form",
        "input",
        "input[type='email']",
        "input[type='file']",
        "textarea",
    ]



def _ashby_selectors() -> List[str]:
    return [
        "button",
        "a",
        "form",
        "input",
        "input[type='email']",
        "input[type='file']",
        "textarea",
        "[data-testid]",
    ]



def _workday_selectors() -> List[str]:
    return [
        "a[data-automation-id='applyManually']",
        "button[data-automation-id='applyManually']",
        "button[data-automation-id]",
        "button",
        "form",
        "input",
        "input[type='email']",
        "input[type='tel']",
        "input[type='file']",
        "textarea",
    ]



def _generic_selectors() -> List[str]:
    return [
        "button",
        "a",
        "form",
        "input",
        "textarea",
        "input[type='file']",
    ]



def _build_visible_fields(provider: Provider) -> List[VisibleField]:
    fields: List[VisibleField] = [
        {
            "name": "first_name",
            "label": "First Name",
            "type": "text",
            "required": True,
            "selector": "input",
        },
        {
            "name": "last_name",
            "label": "Last Name",
            "type": "text",
            "required": True,
            "selector": "input",
        },
        {
            "name": "email",
            "label": "Email",
            "type": "email",
            "required": True,
            "selector": "input[type='email']",
        },
        {
            "name": "resume",
            "label": "Resume",
            "type": "file",
            "required": True,
            "selector": "input[type='file']",
        },
    ]

    if provider == "greenhouse":
        fields.append(
            {
                "name": "cover_letter",
                "label": "Cover Letter",
                "type": "textarea",
                "required": False,
                "selector": "textarea",
            }
        )
    elif provider == "ashby":
        fields.extend(
            [
                {
                    "name": "phone",
                    "label": "Phone",
                    "type": "tel",
                    "required": False,
                    "selector": "input[type='tel']",
                },
                {
                    "name": "linkedin",
                    "label": "LinkedIn",
                    "type": "text",
                    "required": False,
                    "selector": "input",
                },
            ]
        )
    elif provider == "workday":
        fields.append(
            {
                "name": "phone",
                "label": "Phone",
                "type": "tel",
                "required": True,
                "selector": "input[type='tel']",
            }
        )

    return fields



def _skip_steps(provider_name: str, role: str, org: str) -> List[str]:
    return [
        f"Open the {provider_name} job page for {role} at {org}.",
        "Confirm the page is reachable and still references the intended role.",
        "Stop because this role did not pass the apply threshold.",
        "Return a skip recommendation instead of continuing.",
    ]



def _build_greenhouse_plan(
    company: Optional[str],
    role_title: Optional[str],
    should_apply: bool,
    safe_stop: bool,
) -> PlanResult:
    role = role_title or "target role"
    org = company or "target company"

    if not should_apply:
        steps = _skip_steps("Greenhouse", role, org)
    else:
        steps = [
            f"Open the Greenhouse job page for {role} at {org}.",
            "Wait for the page to stabilize and confirm the role is still open.",
            "Look for 'Autofill with Greenhouse' or MyGreenhouse Quick Apply first.",
            "If Quick Apply is present, prefer it before standard manual apply.",
            (
                "If MyGreenhouse sign-in, email code verification, CAPTCHA, "
                "or human authentication appears, pause and return control."
            ),
            "If Quick Apply is not available, fall back to the standard Apply flow.",
            "Upload the resume as early as possible to trigger autofill.",
            "Capture visible applicant fields and fill missing required values only.",
            "Resolve validation errors, then review the final form state.",
            (
                "Stop before final submit."
                if safe_stop
                else "Final submit may proceed only if explicitly allowed."
            ),
        ]

    return {
        "provider": "greenhouse",
        "safeStopBeforeSubmit": safe_stop,
        "selectors": _greenhouse_selectors(),
        "steps": steps,
    }



def _build_ashby_plan(
    company: Optional[str],
    role_title: Optional[str],
    should_apply: bool,
    safe_stop: bool,
) -> PlanResult:
    role = role_title or "target role"
    org = company or "target company"

    if not should_apply:
        steps = _skip_steps("Ashby", role, org)
    else:
        steps = [
            f"Open the Ashby job page for {role} at {org}.",
            "Wait for the page to stabilize and confirm the role is still open.",
            "Click the primary Apply button.",
            "Look for the resume upload control immediately after entering the form.",
            "Upload the resume first to maximize autofill of candidate details.",
            "Wait for autofill to complete before editing fields.",
            "Fill missing required fields only.",
            "Handle optional cover letter, links, or portfolio fields only if data is available.",
            "Capture any optional survey questions but do not block on non-required items.",
            (
                "Stop before final submit."
                if safe_stop
                else "Final submit may proceed only if explicitly allowed."
            ),
        ]

    return {
        "provider": "ashby",
        "safeStopBeforeSubmit": safe_stop,
        "selectors": _ashby_selectors(),
        "steps": steps,
    }



def _build_workday_plan(
    company: Optional[str],
    role_title: Optional[str],
    should_apply: bool,
    safe_stop: bool,
) -> PlanResult:
    role = role_title or "target role"
    org = company or "target company"

    if not should_apply:
        steps = _skip_steps("Workday", role, org)
    else:
        steps = [
            f"Open the Workday job page for {role} at {org}.",
            "Wait for the page to stabilize and confirm the role is still open.",
            "Prefer guest apply or 'Apply Manually' over account creation when possible.",
            "Upload the resume early if the workflow allows it.",
            "Treat the application as a multi-step form and validate page by page.",
            "Capture visible required fields and resolve validation before moving forward.",
            (
                "Stop before final submit."
                if safe_stop
                else "Final submit may proceed only if explicitly allowed."
            ),
        ]

    return {
        "provider": "workday",
        "safeStopBeforeSubmit": safe_stop,
        "selectors": _workday_selectors(),
        "steps": steps,
    }



def _build_generic_plan(
    company: Optional[str],
    role_title: Optional[str],
    should_apply: bool,
    safe_stop: bool,
) -> PlanResult:
    role = role_title or "target role"
    org = company or "target company"

    if not should_apply:
        steps = _skip_steps("job", role, org)
    else:
        steps = [
            f"Open the job page for {role} at {org}.",
            "Wait for the page to stabilize.",
            "Find the primary Apply button or application form.",
            "Upload the resume if a file field is present.",
            "Fill required fields only.",
            (
                "Stop before final submit."
                if safe_stop
                else "Final submit may proceed only if explicitly allowed."
            ),
        ]

    return {
        "provider": "unknown",
        "safeStopBeforeSubmit": safe_stop,
        "selectors": _generic_selectors(),
        "steps": steps,
    }



def _build_plan(normalized: NormalizedPayload) -> PlanResult:
    provider = normalized["provider"]

    if provider == "greenhouse":
        return _build_greenhouse_plan(
            company=normalized["company"],
            role_title=normalized["roleTitle"],
            should_apply=normalized["shouldApply"],
            safe_stop=normalized["safeStopBeforeSubmit"],
        )

    if provider == "ashby":
        return _build_ashby_plan(
            company=normalized["company"],
            role_title=normalized["roleTitle"],
            should_apply=normalized["shouldApply"],
            safe_stop=normalized["safeStopBeforeSubmit"],
        )

    if provider == "workday":
        return _build_workday_plan(
            company=normalized["company"],
            role_title=normalized["roleTitle"],
            should_apply=normalized["shouldApply"],
            safe_stop=normalized["safeStopBeforeSubmit"],
        )

    return _build_generic_plan(
        company=normalized["company"],
        role_title=normalized["roleTitle"],
        should_apply=normalized["shouldApply"],
        safe_stop=normalized["safeStopBeforeSubmit"],
    )



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



def _build_execution_steps(
    normalized: NormalizedPayload,
) -> List[ExecutionStep]:
    provider = normalized["provider"]
    transport = normalized["transport"]
    mode = normalized["mode"]
    should_apply = normalized["shouldApply"]
    target_url = normalized["targetUrl"]
    safe_stop = normalized["safeStopBeforeSubmit"]

    steps: List[ExecutionStep] = [
        {
            "id": "step_1",
            "action": "initialize",
            "detail": f"Initialize Python Nova runner for {provider}.",
        },
        {
            "id": "step_2",
            "action": "navigate",
            "detail": f"Prepare browser navigation for {target_url}.",
        },
    ]

    if not should_apply:
        steps.append(
            {
                "id": "step_3",
                "action": "skip",
                "detail": "Stop because the job did not meet the apply threshold.",
            }
        )
        return steps

    if mode == "plan":
        steps.append(
            {
                "id": "step_3",
                "action": "plan_only",
                "detail": "Return execution plan only. No live browser launched.",
            }
        )
        return steps

    if mode == "demo":
        steps.extend(
            [
                {
                    "id": "step_3",
                    "action": "simulate_open",
                    "detail": "Simulate opening the application page.",
                },
                {
                    "id": "step_4",
                    "action": "simulate_detect",
                    "detail": (
                        "Simulate detecting provider-specific apply controls "
                        "and visible fields."
                    ),
                },
                {
                    "id": "step_5",
                    "action": "simulate_fill",
                    "detail": "Simulate prefilling candidate fields.",
                },
                {
                    "id": "step_6",
                    "action": "safe_stop",
                    "detail": (
                        "Stop before final submit in safe mode."
                        if safe_stop
                        else "Safe stop disabled for demo flow."
                    ),
                },
            ]
        )
        return steps

    launch_detail = (
        "Launch API-driven Nova Act browser automation."
        if transport == "api"
        else "Launch workflow-driven Nova Act browser automation."
    )

    steps.extend(
        [
            {
                "id": "step_3",
                "action": "launch_browser",
                "detail": launch_detail,
            },
            {
                "id": "step_4",
                "action": "detect_provider_flow",
                "detail": (
                    "Execute provider-specific application flow logic for "
                    f"{provider}."
                ),
            },
            {
                "id": "step_5",
                "action": "prefill",
                "detail": "Prefill visible application fields.",
            },
            {
                "id": "step_6",
                "action": "safe_stop",
                "detail": (
                    "Stop before final submit in safe mode."
                    if safe_stop
                    else "Safe stop disabled; final submit may be allowed."
                ),
            },
        ]
    )

    return steps



def _build_message(normalized: NormalizedPayload) -> str:
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

    return (
        "Python Nova runner prepared successfully. "
        f"Live execution is set to {transport} transport for {provider}."
    )



def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _normalize_payload(payload)
    plan = _build_plan(normalized)
    visible_fields = _build_visible_fields(normalized["provider"])
    execution_steps = _build_execution_steps(normalized)
    status = _resolve_status(
        should_apply=normalized["shouldApply"],
        mode=normalized["mode"],
    )
    runner = _build_runner_meta(
        provider=normalized["provider"],
        transport=normalized["transport"],
    )

    return {
        "ok": True,
        "runId": normalized["runId"],
        "provider": normalized["provider"],
        "mode": normalized["mode"],
        "status": status,
        "executed": bool(
            normalized["mode"] == "live" and normalized["shouldApply"]
        ),
        "safeStopBeforeSubmit": normalized["safeStopBeforeSubmit"],
        "visibleFields": visible_fields,
        "executionSteps": execution_steps,
        "message": _build_message(normalized),
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
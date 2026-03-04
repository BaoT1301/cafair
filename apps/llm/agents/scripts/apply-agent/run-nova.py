import json
import sys
from typing import Any, Dict, List, Literal, Optional, TypedDict


Provider = Literal["greenhouse", "workday", "ashby", "unknown"]
RunnerMode = Literal["plan", "demo", "live"]
RunnerTransport = Literal["workflow", "api", "auto"]
RunnerStatus = Literal["planned", "queued", "running", "completed", "failed"]


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


class RunnerMetadata(TypedDict):
    engine: str
    transport: RunnerTransport
    adapter: str
    provider: Provider


class Payload(TypedDict, total=False):
    runId: str
    targetUrl: str
    provider: Provider
    mode: RunnerMode
    transport: RunnerTransport
    shouldApply: bool
    safeStopBeforeSubmit: bool
    company: Optional[str]
    roleTitle: Optional[str]
    selectors: List[str]
    plannedSteps: List[str]


class Result(TypedDict, total=False):
    ok: bool
    runId: str
    provider: Provider
    mode: RunnerMode
    status: RunnerStatus
    executed: bool
    safeStopBeforeSubmit: bool
    visibleFields: List[VisibleField]
    executionSteps: List[ExecutionStep]
    message: str
    runner: RunnerMetadata
    targetUrl: str
    company: Optional[str]
    roleTitle: Optional[str]
    selectors: List[str]
    plannedSteps: List[str]
    error: str
    details: str


def as_provider(value: Any) -> Provider:
    text = str(value or "unknown").strip().lower()
    if text == "greenhouse":
        return "greenhouse"
    if text == "workday":
        return "workday"
    if text == "ashby":
        return "ashby"
    return "unknown"


def as_mode(value: Any) -> RunnerMode:
    text = str(value or "demo").strip().lower()
    if text == "plan":
        return "plan"
    if text == "live":
        return "live"
    return "demo"


def as_transport(value: Any) -> RunnerTransport:
    text = str(value or "auto").strip().lower()
    if text == "workflow":
        return "workflow"
    if text == "api":
        return "api"
    return "auto"


def as_string(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text or fallback


def as_bool(value: Any, fallback: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return fallback

    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    return fallback


def as_string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []

    items: List[str] = []
    for item in value:
        text = as_string(item)
        if text:
            items.append(text)
    return items


def resolve_adapter(provider: Provider) -> str:
    if provider == "greenhouse":
        return "greenhouse-form-adapter"
    if provider == "workday":
        return "workday-form-adapter"
    if provider == "ashby":
        return "ashby-form-adapter"
    return "generic-form-adapter"


def build_visible_fields(provider: Provider) -> List[VisibleField]:
    common_fields: List[VisibleField] = [
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
        common_fields.append(
            {
                "name": "cover_letter",
                "label": "Cover Letter",
                "type": "textarea",
                "required": False,
                "selector": "textarea",
            }
        )
    elif provider == "workday":
        common_fields.append(
            {
                "name": "phone",
                "label": "Phone",
                "type": "tel",
                "required": True,
                "selector": "input[type='tel']",
            }
        )
    elif provider == "ashby":
        common_fields.append(
            {
                "name": "linkedin",
                "label": "LinkedIn",
                "type": "text",
                "required": False,
                "selector": "input",
            }
        )

    return common_fields


def build_execution_steps(payload: Payload) -> List[ExecutionStep]:
    provider = as_provider(payload.get("provider"))
    mode = as_mode(payload.get("mode"))
    transport = as_transport(payload.get("transport"))
    should_apply = as_bool(payload.get("shouldApply"), False)
    target_url = as_string(payload.get("targetUrl"))

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
                    "action": "simulate_fill",
                    "detail": "Simulate prefilling candidate fields.",
                },
                {
                    "id": "step_5",
                    "action": "safe_stop",
                    "detail": "Stop before final submit in safe mode.",
                },
            ]
        )
        return steps

    launch_detail = "Launch live browser automation bridge."
    if transport == "workflow":
        launch_detail = "Launch workflow-driven Nova Act browser automation."
    elif transport == "api":
        launch_detail = "Launch API-driven Nova Act browser automation."
    elif transport == "auto":
        launch_detail = "Launch auto-selected Nova Act browser automation bridge."

    steps.extend(
        [
            {
                "id": "step_3",
                "action": "launch_browser",
                "detail": launch_detail,
            },
            {
                "id": "step_4",
                "action": "prefill",
                "detail": "Prefill visible application fields.",
            },
            {
                "id": "step_5",
                "action": "safe_stop",
                "detail": "Stop before final submit in safe mode.",
            },
        ]
    )
    return steps


def resolve_status(payload: Payload) -> RunnerStatus:
    should_apply = as_bool(payload.get("shouldApply"), False)
    mode = as_mode(payload.get("mode"))

    if not should_apply:
        return "completed"
    if mode == "plan":
        return "planned"
    if mode == "live":
        return "running"
    return "queued"


def build_message(payload: Payload) -> str:
    should_apply = as_bool(payload.get("shouldApply"), False)
    mode = as_mode(payload.get("mode"))
    transport = as_transport(payload.get("transport"))

    if not should_apply:
        return "Python Nova runner skipped because threshold did not pass."

    if mode == "plan":
        return "Python Nova runner prepared successfully."

    if mode == "demo":
        return "Python Nova runner prepared successfully."

    if transport == "workflow":
        return (
            "Python Nova runner prepared successfully. "
            "Live execution is set to workflow transport."
        )

    if transport == "api":
        return (
            "Python Nova runner prepared successfully. "
            "Live execution is set to API transport."
        )

    return (
        "Python Nova runner prepared successfully. "
        "Live execution will use auto transport selection."
    )


def build_runner_metadata(payload: Payload) -> RunnerMetadata:
    provider = as_provider(payload.get("provider"))
    transport = as_transport(payload.get("transport"))

    return {
        "engine": "nova-act",
        "transport": transport,
        "adapter": resolve_adapter(provider),
        "provider": provider,
    }


def build_success_result(payload: Payload) -> Result:
    provider = as_provider(payload.get("provider"))
    mode = as_mode(payload.get("mode"))
    should_apply = as_bool(payload.get("shouldApply"), False)

    target_url = as_string(payload.get("targetUrl"))
    company = payload.get("company")
    role_title = payload.get("roleTitle")
    selectors = as_string_list(payload.get("selectors"))
    planned_steps = as_string_list(payload.get("plannedSteps"))

    return {
        "ok": True,
        "runId": as_string(payload.get("runId")),
        "provider": provider,
        "mode": mode,
        "status": resolve_status(payload),
        "executed": bool(mode == "live" and should_apply),
        "safeStopBeforeSubmit": as_bool(
            payload.get("safeStopBeforeSubmit"),
            True,
        ),
        "visibleFields": build_visible_fields(provider),
        "executionSteps": build_execution_steps(payload),
        "message": build_message(payload),
        "runner": build_runner_metadata(payload),
        "targetUrl": target_url,
        "company": company if isinstance(company, str) or company is None else None,
        "roleTitle": (
            role_title
            if isinstance(role_title, str) or role_title is None
            else None
        ),
        "selectors": selectors,
        "plannedSteps": planned_steps,
    }


def print_error_and_exit(error: str, details: Optional[str] = None) -> None:
    result: Result = {
        "ok": False,
        "error": error,
    }
    if details:
        result["details"] = details

    print(json.dumps(result))
    sys.exit(1)


def main() -> None:
    raw = sys.stdin.read().strip()
    if not raw:
        print_error_and_exit("No JSON payload received by Python runner.")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print_error_and_exit("Invalid JSON payload.", str(exc))

    if not isinstance(payload, dict):
        print_error_and_exit("Payload must be a JSON object.")

    typed_payload: Payload = payload
    result = build_success_result(typed_payload)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
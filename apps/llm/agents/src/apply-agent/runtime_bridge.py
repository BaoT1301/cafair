from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, Optional, TypedDict


class RuntimeBridgeRunner(TypedDict, total=False):
    engine: str
    transport: str
    adapter: str
    provider: str


class RuntimeBridgeActionLog(TypedDict, total=False):
    stepId: str
    action: str
    status: str
    detail: str


class RuntimeBridgeReasoningLog(TypedDict, total=False):
    stepId: str
    summary: str


class RuntimeBridgeSuccess(TypedDict, total=False):
    ok: bool
    status: str
    executed: bool
    executionSteps: list[Dict[str, Any]]
    message: str
    runner: RuntimeBridgeRunner
    actionLogs: list[RuntimeBridgeActionLog]
    reasoningLogs: list[RuntimeBridgeReasoningLog]
    transportSummary: str
    provider: str
    mode: str
    runId: str
    targetUrl: str
    company: str
    roleTitle: str
    safeStopBeforeSubmit: bool
    visibleFields: list[Dict[str, Any]]
    selectors: list[str]
    plannedSteps: list[str]
    browserSession: Dict[str, Any]
    fieldFillPlan: list[Dict[str, Any]]
    result: Dict[str, Any]


class RuntimeBridgeError(TypedDict, total=False):
    ok: bool
    error: str
    details: str


RuntimeBridgeResponse = RuntimeBridgeSuccess | RuntimeBridgeError


def load_browser_session_executor() -> tuple[Any, Any]:
    try:
        from .browser_session import (
            browser_execution_result_to_dict,
            execute_browser_session,
        )
    except ImportError:
        from browser_session import (  # type: ignore
            browser_execution_result_to_dict,
            execute_browser_session,
        )

    return execute_browser_session, browser_execution_result_to_dict


def _build_nova_instruction(
    payload: Dict[str, Any],
    browser_session_result: Dict[str, Any],
) -> str:
    target_url = _safe_string(payload.get("targetUrl"))
    provider = _safe_string(payload.get("provider"), "unknown")
    company = _safe_string(payload.get("company"), "target company")
    role_title = _safe_string(payload.get("roleTitle"), "target role")
    safe_stop = False

    email = "npnallstar@gmail.com"
    manual_resume_link = (
        "https://drive.google.com/file/d/1wKb7hlbshHesim7XOc5pAx5dTjCptCdy/view?usp=sharing"
    )
    cover_letter_text = (
        "Hi there!\n"
        "I am writing because I am genuinely obsessed with the idea of rebuilding business processes as "
        "\"AI-native\" rather than just slapping AI on top of old workflows. When I saw that is exactly "
        "what the Enterprise AI team at Flagship Pioneering is doing, I knew I had to reach out.\n"
        "I love building things that solve real problems. Recently, I built a tool using DeepSeek and "
        "a RAG pipeline to turn natural language into SQL queries so staff could get real-time reports "
        "without needing to know how to code. I’ve also architected event-driven systems on the cloud "
        "that boosted efficiency by 80%. Whether it’s writing Python scripts, deploying on AWS, or using "
        "tools like Claude and Gemini to automate a manual mess, I am happiest when I’m making a process "
        "faster and smarter.\n"
        "I am currently finishing my Master’s in Computer Science at George Mason University. While I "
        "have a strong technical background, I’m most excited about the \"builder\" aspect of this "
        "role—figuring out which tool fits the job and making sure it actually works reliably in the "
        "real world.\n"
        "I am ready to be in Cambridge full-time this June to help the team invent new ways of working. "
        "I’d love to show you how my experience in AI and automation can help Flagship Pioneering "
        "continue to transform human health.\n"
        "Best,\n"
        "Lam Anh Truong"
    )

    planned_steps = payload.get("plannedSteps")
    if not isinstance(planned_steps, list):
        planned_steps = []

    browser_steps = browser_session_result.get("steps")
    if not isinstance(browser_steps, list):
        browser_steps = []

    lines: list[str] = [
        "You are an apply-agent browser runner using the Nova Act SDK.",
        "Act like a thoughtful, careful, and serious applicant who genuinely wants to complete this application successfully.",
        "Your goal is not to stop early. Your goal is to finish the application as completely and accurately as possible.",
        "Move deliberately, read labels carefully, and make reasonable field-by-field decisions.",
        "Open and interact only with the target application flow requested.",
        "Keep actions visible, concise, and grounded in what is actually on screen.",
        "Do not rush past fields. Review each section before moving on.",
        "If more fields are hidden below, scroll to reveal them and continue.",
        "If a section looks incomplete, stay with it until all clearly required items in that section are handled.",
        f"Target URL: {target_url}",
        f"Provider: {provider}",
        f"Company: {company}",
        f"Role: {role_title}",
        "",
        "Candidate identity and fixed values:",
        "- Full name: Lam Anh Truong",
        "- Email: npnallstar@gmail.com",
        "- Phone: 5514049519",
        f"- Manual resume link: {manual_resume_link}",
        "- Use the provided cover letter text exactly when a cover letter text area is present.",
        "",
        "High-level behavior rules:",
        "1. Start by opening the target application page and waiting for it to fully stabilize.",
        "2. Read the visible layout carefully before clicking anything.",
        "3. Follow the provider-specific application path in a natural order.",
        "4. Work section by section from top to bottom.",
        "5. Scroll whenever necessary to reveal the next required fields.",
        "6. Continue until the full application is completed, not just the first visible section.",
        "7. Treat the task like a real applicant trying to finish the form successfully.",
        "",
        "Field completion rules:",
        "1. For email fields, always type exactly: npnallstar@gmail.com",
        "2. For phone fields, always type exactly: 5514049519",
        "3. For name fields, use Lam Anh for first name and Truong for last name unless the form asks for full name in one field.",
        "4. For cover letter textareas, paste the full cover letter provided below.",
        "5. For resume-related text inputs, use the manual resume link exactly.",
        "6. For dropdowns, radios, and checkboxes, choose the most reasonable truthful option that helps complete the application based on the provided candidate information and visible context.",
        "7. If a field is optional and not clearly useful, it may be skipped after confirming it is optional.",
        "8. If a field is required, do not move on until you have made a best effort to complete it.",
        "",
        "Resume handling rules:",
        "- If a manual resume field appears, prefer that path first.",
        "- This includes labels or controls like: Enter manually, Resume link, Resume URL, Portfolio, Website, Link, or similar text-entry alternatives.",
        f"- When such a field appears, type this exact URL: {manual_resume_link}",
        "- If both a manual text field and a file upload option are visible, prefer the manual text field first.",
        "- Only use the file upload control if the application truly requires a file and there is no usable manual text-entry path.",
        "- If a file upload is unavoidable, interact with the file input directly rather than getting stuck clicking unrelated UI repeatedly.",
        "",
        "Form navigation rules:",
        "- After finishing a section, scroll down to reveal the next section.",
        "- If the page changes after clicking Apply, wait for the form to fully load, then resume filling from the top of the form.",
        "- If validation errors appear, read them and fix them before proceeding.",
        "- If a field autofills, verify it looks correct before moving on.",
        "- If the page contains multiple required sections, continue through every section until the final action area is reached.",
        "- Avoid looping on the same failed action. If one method fails, choose the next most reasonable visible method.",
        "",
        "Completion and submit rules:",
        "- Do not stop after partial completion.",
        "- Continue scrolling and filling until you reach the final submit control.",
        "- Before submitting, do a quick final pass over the visible section to confirm no obvious required fields are empty.",
        "- Then click the final submit or send application button to complete the application.",
        "- After submission, pause on the confirmation page or confirmation state so the outcome is visible.",
        "",
        "Candidate-specific fill shortcuts:",
        "- Email fields: always type npnallstar@gmail.com",
        "- Phone fields: always type 5514049519",
        "- For manual resume, portfolio, website, link, or enter-manually text fields: always type the Google Drive resume link",
        "- Prefer typed manual fields over opening the OS file picker whenever possible",
        "- Keep scrolling until the entire form is covered and completed",
        "- Do not stop early; finish the application and submit it",
        "",
        "Cover letter text to paste exactly if needed:",
        cover_letter_text,
    ]

    if planned_steps:
        lines.append("")
        lines.append("Provider-specific plan guidance:")
        lines.append(
            "Use these provider-specific hints as guidance, but still adapt to the actual on-screen form if it differs."
        )
        for step in planned_steps:
            if isinstance(step, str) and step.strip():
                lines.append(f"- {step.strip()}")

    if browser_steps:
        lines.append("")
        lines.append("Browser session execution guide:")
        lines.append(
            "These are the concrete browser-session steps already prepared for you. Follow them in spirit while still responding to the actual page state."
        )
        for step in browser_steps:
            if not isinstance(step, dict):
                continue
            detail = _safe_string(step.get("detail"))
            if detail:
                lines.append(f"- {detail}")

    lines.extend(
        [
            "",
            "Final instruction:",
            "Behave like a thoughtful applicant who wants to finish the application fully and correctly.",
            "Read each field label before acting, make steady progress downward through the page, recover from small UI issues, and keep going until the application is submitted and the result is visible.",
        ]
    )

    return "\n".join(lines)

def run_local_nova_act_browser(
    payload: Dict[str, Any],
    browser_session_result: Dict[str, Any],
) -> Dict[str, Any]:
    api_key = _safe_string(os.getenv("NOVA_ACT_API"))
    if not api_key:
        raise RuntimeError(
            "NOVA_ACT_API is required for live local Nova Act browser execution."
        )

    try:
        from nova_act import NovaAct
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "nova_act is not installed. Install it first, e.g. `pip install nova-act`."
        ) from exc

    target_url = _safe_string(payload.get("targetUrl"))
    provider = _safe_string(payload.get("provider"), "unknown")
    transport = _safe_string(payload.get("transport"), "api")
    adapter = _safe_string(payload.get("adapterName"), "provider-adapter")

    instruction = _build_nova_instruction(payload, browser_session_result)

    nova = NovaAct(
        starting_page=target_url,
        headless=False,
        nova_act_api_key=api_key,
    )

    action_logs: list[RuntimeBridgeActionLog] = [
        {
            "stepId": "step_1",
            "action": "launch_browser",
            "status": "started",
            "detail": f"Launching visible Nova Act browser at {target_url}.",
        }
    ]
    reasoning_logs: list[RuntimeBridgeReasoningLog] = [
        {
            "stepId": "step_1",
            "summary": (
                "Live API mode requested a real SDK browser session, so the "
                "runtime bridge launched Nova Act directly."
            ),
        }
    ]

    execution_steps: list[Dict[str, Any]] = [
        {
            "id": "step_1",
            "action": "launch_browser",
            "detail": f"Launch visible Nova Act browser for {provider}.",
        },
        {
            "id": "step_2",
            "action": "navigate",
            "detail": f"Open {target_url} in the Nova Act browser session.",
        },
        {
            "id": "step_3",
            "action": "act",
            "detail": "Run provider-aware apply instruction through Nova Act.",
        },
    ]

    nova.start()
    act_result = nova.act(instruction)

    action_logs.append(
        {
            "stepId": "step_2",
            "action": "act",
            "status": "completed",
            "detail": "Nova Act executed the live browser instruction.",
        }
    )
    reasoning_logs.append(
        {
            "stepId": "step_2",
            "summary": (
                "The bridge handed off the planned apply steps to Nova Act and "
                "captured the SDK result for upper layers."
            ),
        }
    )

    return {
        "ok": True,
        "status": "running",
        "executed": True,
        "executionSteps": execution_steps,
        "message": (
            "Runtime bridge launched a real visible Nova Act browser session "
            "and executed the apply instruction."
        ),
        "runner": {
            "engine": "nova-act",
            "transport": transport,
            "adapter": adapter,
            "provider": provider,
        },
        "actionLogs": action_logs,
        "reasoningLogs": reasoning_logs,
        "transportSummary": (
            "Runtime bridge used the local Nova Act SDK to open a visible "
            "browser and run the apply-agent instruction."
        ),
        "provider": provider,
        "mode": _safe_string(payload.get("mode"), "live"),
        "runId": _safe_string(payload.get("runId")),
        "targetUrl": target_url,
        "company": _safe_string(payload.get("company")),
        "roleTitle": _safe_string(payload.get("roleTitle")),
        "safeStopBeforeSubmit": False,
        "visibleFields": payload.get("visibleFields", []),
        "selectors": _safe_list_of_strings(payload.get("selectors")),
        "plannedSteps": _safe_list_of_strings(payload.get("plannedSteps")),
        "browserSession": browser_session_result,
        "fieldFillPlan": payload.get("fieldFillPlan", []),
        "result": {
            "instruction": instruction,
            "actResult": act_result,
        },
    }


def _safe_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _safe_bool(value: Any, default: bool = False) -> bool:
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


def _safe_list_of_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    output: list[str] = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
            if text:
                output.append(text)

    return output


def _extract_browser_session_payload(
    payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    browser_session = payload.get("browserSession")
    if isinstance(browser_session, dict):
        return browser_session

    nested_payload = payload.get("payload")
    if isinstance(nested_payload, dict):
        nested_browser_session = nested_payload.get("browserSession")
        if isinstance(nested_browser_session, dict):
            return nested_browser_session

    return None


def _build_bridge_result_from_browser_session(
    payload: Dict[str, Any],
    browser_session_result: Dict[str, Any],
) -> Dict[str, Any]:
    summary = browser_session_result.get("summary")
    if not isinstance(summary, dict):
        summary = {}

    browser_opened = bool(browser_session_result.get("browser_opened", False))
    steps = browser_session_result.get("steps")
    if not isinstance(steps, list):
        steps = []

    action_logs = browser_session_result.get("action_logs")
    if not isinstance(action_logs, list):
        action_logs = []

    reasoning_logs = browser_session_result.get("reasoning_logs")
    if not isinstance(reasoning_logs, list):
        reasoning_logs = []

    if browser_opened:
        status = "running"
        executed = True
        message = (
            "Runtime bridge launched a real browser session through the "
            "browser_session layer."
        )
    else:
        status = "planned"
        executed = False
        message = (
            "Runtime bridge prepared browser execution steps, but no live "
            "browser window was opened yet."
        )

    provider = _safe_string(payload.get("provider"), "unknown")
    transport = _safe_string(payload.get("transport"), "workflow")
    adapter = _safe_string(payload.get("adapterName"), "provider-adapter")

    return {
        "ok": True,
        "status": status,
        "executed": executed,
        "executionSteps": steps,
        "message": message,
        "runner": {
            "engine": _safe_string(
                browser_session_result.get("browser_engine"),
                "nova-act",
            ),
            "transport": transport,
            "adapter": adapter,
            "provider": provider,
        },
        "actionLogs": action_logs,
        "reasoningLogs": reasoning_logs,
        "transportSummary": (
            "Runtime bridge delegated execution to browser_session and "
            f"prepared {len(steps)} browser steps."
        ),
        "provider": provider,
        "mode": _safe_string(payload.get("mode"), "demo"),
        "runId": _safe_string(payload.get("runId")),
        "targetUrl": _safe_string(payload.get("targetUrl")),
        "company": _safe_string(payload.get("company")),
        "roleTitle": _safe_string(payload.get("roleTitle")),
        "safeStopBeforeSubmit": _safe_bool(
            payload.get("safeStopBeforeSubmit"),
            True,
        ),
        "visibleFields": payload.get("visibleFields", []),
        "selectors": _safe_list_of_strings(payload.get("selectors")),
        "plannedSteps": _safe_list_of_strings(payload.get("plannedSteps")),
        "browserSession": browser_session_result,
        "fieldFillPlan": payload.get("fieldFillPlan", []),
    }


def normalize_bridge_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Runtime bridge payload must be a dictionary.")

    nested_payload = payload.get("payload")
    if isinstance(nested_payload, dict):
        return nested_payload

    return payload


def parse_json_input(raw: str) -> Dict[str, Any]:
    payload = raw.strip()

    if not payload:
        raise ValueError("No JSON payload received.")

    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Top-level JSON payload must be an object.")

    return parsed


def read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read()
    return parse_json_input(raw)


def run_runtime_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized_payload = normalize_bridge_payload(payload)

    existing_browser_session = _extract_browser_session_payload(payload)
    if existing_browser_session is not None:
        browser_session_result = existing_browser_session
    else:
        execute_browser_session, browser_execution_result_to_dict = (
            load_browser_session_executor()
        )

        browser_result = execute_browser_session(
            run_id=_safe_string(normalized_payload.get("runId")),
            target_url=_safe_string(normalized_payload.get("targetUrl")),
            provider=_safe_string(
                normalized_payload.get("provider"),
                "unknown",
            ),
            mode=_safe_string(normalized_payload.get("mode"), "demo"),
            transport=_safe_string(
                normalized_payload.get("transport"),
                "workflow",
            ),
            should_apply=_safe_bool(
                normalized_payload.get("shouldApply"),
                False,
            ),
            safe_stop_before_submit=_safe_bool(
                normalized_payload.get("safeStopBeforeSubmit"),
                True,
            ),
            apply_button_selectors=_safe_list_of_strings(
                normalized_payload.get("selectors")
            ),
            fill_actions=normalized_payload.get("fillActions"),
        )

        browser_session_result = browser_execution_result_to_dict(browser_result)

    mode = _safe_string(normalized_payload.get("mode"), "demo")
    transport = _safe_string(normalized_payload.get("transport"), "workflow")
    should_apply = _safe_bool(normalized_payload.get("shouldApply"), False)
    has_nova_api = bool(_safe_string(os.getenv("NOVA_ACT_API")))

    should_launch_live_sdk = (
        mode == "live"
        and transport == "api"
        and should_apply
        and has_nova_api
        and bool(browser_session_result.get("launch_requested"))
    )

    if should_launch_live_sdk:
        return run_local_nova_act_browser(
            normalized_payload,
            browser_session_result,
        )

    return _build_bridge_result_from_browser_session(
        normalized_payload,
        browser_session_result,
    )


def _copy_string_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, str) and value.strip():
        target[key] = value.strip()  # type: ignore[literal-required]


def _copy_bool_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, bool):
        target[key] = value  # type: ignore[literal-required]


def _copy_list_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, list):
        target[key] = value  # type: ignore[literal-required]


def _copy_dict_field(
    source: Dict[str, Any],
    target: RuntimeBridgeSuccess,
    key: str,
) -> None:
    value = source.get(key)
    if isinstance(value, dict):
        target[key] = value  # type: ignore[literal-required]


def build_success_result(result: Dict[str, Any]) -> RuntimeBridgeSuccess:
    response: RuntimeBridgeSuccess = {
        "ok": True,
        "result": result,
    }

    _copy_string_field(result, response, "status")
    _copy_bool_field(result, response, "executed")
    _copy_list_field(result, response, "executionSteps")
    _copy_string_field(result, response, "message")
    _copy_dict_field(result, response, "runner")
    _copy_list_field(result, response, "actionLogs")
    _copy_list_field(result, response, "reasoningLogs")
    _copy_string_field(result, response, "transportSummary")

    _copy_string_field(result, response, "provider")
    _copy_string_field(result, response, "mode")
    _copy_string_field(result, response, "runId")
    _copy_string_field(result, response, "targetUrl")
    _copy_string_field(result, response, "company")
    _copy_string_field(result, response, "roleTitle")

    _copy_bool_field(result, response, "safeStopBeforeSubmit")

    _copy_list_field(result, response, "visibleFields")
    _copy_list_field(result, response, "selectors")
    _copy_list_field(result, response, "plannedSteps")
    _copy_list_field(result, response, "fieldFillPlan")

    _copy_dict_field(result, response, "browserSession")
    _copy_dict_field(result, response, "result")

    return response


def build_error_result(
    error: str,
    details: Optional[str] = None,
) -> RuntimeBridgeError:
    response: RuntimeBridgeError = {
        "ok": False,
        "error": error,
    }

    if details:
        response["details"] = details

    return response


def print_json(data: RuntimeBridgeResponse) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> None:
    try:
        payload = read_stdin_json()
    except Exception as exc:  # noqa: BLE001
        print(f"[runtime_bridge] input error: {exc}", file=sys.stderr)
        print_json(
            build_error_result(
                "Failed to read runtime bridge input.",
                str(exc),
            )
        )
        sys.exit(1)
        return

    try:
        result = run_runtime_bridge(payload)
    except Exception as exc:  # noqa: BLE001
        print(f"[runtime_bridge] execution error: {exc}", file=sys.stderr)
        print_json(
            build_error_result(
                "Runtime bridge execution failed.",
                str(exc),
            )
        )
        sys.exit(1)
        return

    print_json(build_success_result(result))


if __name__ == "__main__":
    main()
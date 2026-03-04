from __future__ import annotations

from typing import List

from .base import BaseProviderAdapter, ExecutionStep, VisibleField


class AshbyProviderAdapter(BaseProviderAdapter):
    provider_name = "ashby"
    adapter_name = "ashby-form-adapter"

    def build_visible_fields(self) -> List[VisibleField]:
        fields = super().build_visible_fields()

        fields.extend(
            [
                VisibleField(
                    name="resume_link",
                    label="Resume Link / Enter manually",
                    field_type="text",
                    required=False,
                    selector=(
                        "input[name*='resumeLink'], input[id*='resumeLink'], "
                        "input[name*='resume_link'], input[id*='resume_link'], "
                        "input[placeholder*='Resume' i], input[aria-label*='Resume' i], "
                        "input[name*='link'], input[id*='link'], input"
                    ),
                ),
                VisibleField(
                    name="portfolio_link",
                    label="Portfolio / Website / Link",
                    field_type="text",
                    required=False,
                    selector=(
                        "input[name*='portfolio'], input[id*='portfolio'], "
                        "input[name*='website'], input[id*='website'], "
                        "input[placeholder*='portfolio' i], input[placeholder*='website' i], input"
                    ),
                ),
                VisibleField(
                    name="phone",
                    label="Phone",
                    field_type="tel",
                    required=False,
                    selector="input[type='tel']",
                ),
                VisibleField(
                    name="linkedin",
                    label="LinkedIn",
                    field_type="text",
                    required=False,
                    selector=(
                        "input[name*='linkedin'], "
                        "input[id*='linkedin'], input"
                    ),
                ),
                VisibleField(
                    name="website",
                    label="Website / Portfolio",
                    field_type="text",
                    required=False,
                    selector=(
                        "input[name*='website'], "
                        "input[name*='portfolio'], input"
                    ),
                ),
                VisibleField(
                    name="cover_letter",
                    label="Cover Letter",
                    field_type="textarea",
                    required=False,
                    selector="textarea",
                ),
                VisibleField(
                    name="work_authorization",
                    label="Work Authorization",
                    field_type="select",
                    required=False,
                    selector="select",
                ),
            ]
        )

        return fields

    def build_plan_steps(
        self,
        *,
        company: str | None,
        role_title: str | None,
        should_apply: bool,
        safe_stop: bool,
    ) -> List[ExecutionStep]:
        role_text = role_title or "target role"
        company_text = company or "target company"

        if not should_apply:
            return [
                ExecutionStep(
                    step_id="step_1",
                    action="initialize",
                    detail="Initialize Python Nova runner for ashby.",
                ),
                ExecutionStep(
                    step_id="step_2",
                    action="skip",
                    detail=(
                        f"Skip {role_text} at {company_text} because the "
                        "job did not meet the apply threshold."
                    ),
                ),
            ]

        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail="Initialize Python Nova runner for ashby.",
            ),
            ExecutionStep(
                step_id="step_2",
                action="inspect_apply_entry",
                detail=(
                    f"Inspect the Ashby careers page for {role_text} at "
                    f"{company_text} and locate the main Apply button or "
                    "inline application form entry point."
                ),
            ),
            ExecutionStep(
                step_id="step_3",
                action="inspect_resume_autofill",
                detail=(
                    "First, look for manual resume/portfolio URL fields (e.g., "
                    "'Resume Link', 'Enter manually', 'Website', 'Portfolio'). "
                    "Prefer pasting a resume URL into a text field when available. "
                    "Only use file upload if no manual URL/text field exists."
                ),
            ),
            ExecutionStep(
                step_id="step_4",
                action="inspect_required_fields",
                detail=(
                    "Identify required fields, optional portfolio links, and "
                    "any additional application questions or surveys."
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="plan_only",
                detail=(
                    "Return the Ashby execution plan only. "
                    "No live browser session is launched."
                ),
            ),
        ]

    def build_demo_steps(
        self,
        *,
        company: str | None,
        role_title: str | None,
        should_apply: bool,
        safe_stop: bool,
    ) -> List[ExecutionStep]:
        role_text = role_title or "target role"
        company_text = company or "target company"

        if not should_apply:
            return [
                ExecutionStep(
                    step_id="step_1",
                    action="initialize",
                    detail="Initialize Python Nova runner for ashby.",
                ),
                ExecutionStep(
                    step_id="step_2",
                    action="skip",
                    detail=(
                        f"Skip {role_text} at {company_text} because the "
                        "job did not meet the apply threshold."
                    ),
                ),
            ]

        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail="Initialize Python Nova runner for ashby.",
            ),
            ExecutionStep(
                step_id="step_2",
                action="simulate_open",
                detail=(
                    f"Simulate opening the Ashby Apply flow for {role_text} "
                    f"at {company_text}."
                ),
            ),
            ExecutionStep(
                step_id="step_3",
                action="simulate_resume_upload",
                detail=(
                    "Simulate checking for a manual resume/portfolio URL field first. "
                    "If present, simulate pasting the resume link. "
                    "Only simulate file upload if no manual URL/text field exists."
                ),
            ),
            ExecutionStep(
                step_id="step_4",
                action="simulate_prefill",
                detail=(
                    "Simulate reviewing autofilled name, email, and "
                    "experience fields, then patch any missing required "
                    "values."
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="simulate_questions",
                detail=(
                    "Simulate filling remaining required fields and handle "
                    "optional surveys conservatively."
                ),
            ),
            ExecutionStep(
                step_id="step_6",
                action="safe_stop",
                detail=(
                    "Stop before final submit in safe mode."
                    if safe_stop
                    else "Safe stop disabled for demo flow."
                ),
            ),
        ]

    def build_live_steps(
        self,
        *,
        company: str | None,
        role_title: str | None,
        should_apply: bool,
        safe_stop: bool,
        transport: str,
    ) -> List[ExecutionStep]:
        role_text = role_title or "target role"
        company_text = company or "target company"

        if not should_apply:
            return [
                ExecutionStep(
                    step_id="step_1",
                    action="initialize",
                    detail="Initialize Python Nova runner for ashby.",
                ),
                ExecutionStep(
                    step_id="step_2",
                    action="skip",
                    detail=(
                        f"Skip {role_text} at {company_text} because the "
                        "job did not meet the apply threshold."
                    ),
                ),
            ]

        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )

        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail="Initialize Python Nova runner for ashby.",
            ),
            ExecutionStep(
                step_id="step_2",
                action="launch_browser",
                detail=launch_detail,
            ),
            ExecutionStep(
                step_id="step_3",
                action="open_apply",
                detail=(
                    f"Open the Ashby Apply flow for {role_text} at "
                    f"{company_text} from the careers page or the inline "
                    "application entry point."
                ),
            ),
            ExecutionStep(
                step_id="step_4",
                action="upload_resume",
                detail=(
                    "Prefer manual resume/portfolio URL fields when present: "
                    "paste the resume link into 'Resume Link'/'Enter manually' style inputs. "
                    "Only use OS file upload if there is no manual URL/text field."
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="review_autofill",
                detail=(
                    "Review autofilled fields for accuracy and fill any "
                    "missing required values such as phone or work "
                    "authorization."
                ),
            ),
            ExecutionStep(
                step_id="step_6",
                action="answer_questions",
                detail=(
                    "Complete additional required questions, attachments, and "
                    "optional survey inputs conservatively."
                ),
            ),
            ExecutionStep(
                step_id="step_7",
                action="safe_stop",
                detail=(
                    "Stop before final submit in safe mode."
                    if safe_stop
                    else "Safe stop disabled; final submit may be allowed."
                ),
            ),
        ]
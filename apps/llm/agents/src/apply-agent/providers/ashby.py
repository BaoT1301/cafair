from __future__ import annotations

from typing import List

from .base import (
    BaseProviderAdapter,
    ExecutionStep,
    ProviderContext,
    VisibleField,
)


class AshbyProviderAdapter(BaseProviderAdapter):
    provider_name = "ashby"
    adapter_name = "ashby-form-adapter"

    def build_visible_fields(self, context: ProviderContext) -> List[VisibleField]:
        fields = super().build_visible_fields(context)

        fields.extend(
            [
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
                    selector="input[name*='linkedin'], input[id*='linkedin'], input",
                ),
                VisibleField(
                    name="website",
                    label="Website / Portfolio",
                    field_type="text",
                    required=False,
                    selector="input[name*='website'], input[name*='portfolio'], input",
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

    def build_execution_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        if not context.should_apply:
            return self._build_skip_steps(context)

        if context.mode == "plan":
            return self._build_plan_steps(context)

        if context.mode == "demo":
            return self._build_demo_steps(context)

        return self._build_live_steps(context)

    def _build_skip_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail=(
                    "Initialize Python Nova runner for ashby "
                    f"using {context.transport} transport."
                ),
            ),
            ExecutionStep(
                step_id="step_2",
                action="navigate",
                detail=f"Prepare browser navigation for {context.target_url}.",
            ),
            ExecutionStep(
                step_id="step_3",
                action="skip",
                detail=(
                    "Stop because the job did not meet the apply threshold. "
                    "Do not open the Ashby application flow."
                ),
            ),
        ]

    def _build_plan_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail=(
                    "Initialize Python Nova runner for ashby "
                    f"using {context.transport} transport."
                ),
            ),
            ExecutionStep(
                step_id="step_2",
                action="navigate",
                detail=f"Prepare browser navigation for {context.target_url}.",
            ),
            ExecutionStep(
                step_id="step_3",
                action="inspect_apply_entry",
                detail=(
                    "Inspect the Ashby careers page and locate the main "
                    "Apply button or inline application form entry point."
                ),
            ),
            ExecutionStep(
                step_id="step_4",
                action="inspect_resume_autofill",
                detail=(
                    "Plan to upload the resume first because Ashby commonly "
                    "uses resume upload to autofill candidate details."
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="inspect_required_fields",
                detail=(
                    "Identify required fields, optional portfolio links, and "
                    "any additional application questions or surveys."
                ),
            ),
            ExecutionStep(
                step_id="step_6",
                action="plan_only",
                detail=(
                    "Return the Ashby execution plan only. "
                    "No live browser session is launched."
                ),
            ),
        ]

    def _build_demo_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail=(
                    "Initialize Python Nova runner for ashby "
                    f"using {context.transport} transport."
                ),
            ),
            ExecutionStep(
                step_id="step_2",
                action="navigate",
                detail=f"Prepare browser navigation for {context.target_url}.",
            ),
            ExecutionStep(
                step_id="step_3",
                action="simulate_open",
                detail=(
                    "Simulate opening the Ashby Apply flow from the job page."
                ),
            ),
            ExecutionStep(
                step_id="step_4",
                action="simulate_resume_upload",
                detail=(
                    "Simulate uploading the resume first to trigger Ashby "
                    "autofill for core applicant details."
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="simulate_prefill",
                detail=(
                    "Simulate reviewing autofilled name, email, and experience "
                    "fields, then patch any missing required values."
                ),
            ),
            ExecutionStep(
                step_id="step_6",
                action="simulate_questions",
                detail=(
                    "Simulate filling remaining required fields and handle "
                    "optional surveys conservatively."
                ),
            ),
            ExecutionStep(
                step_id="step_7",
                action="safe_stop",
                detail="Stop before final submit in safe mode.",
            ),
        ]

    def _build_live_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if context.transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )

        return [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail=(
                    "Initialize Python Nova runner for ashby "
                    f"using {context.transport} transport."
                ),
            ),
            ExecutionStep(
                step_id="step_2",
                action="navigate",
                detail=f"Prepare browser navigation for {context.target_url}.",
            ),
            ExecutionStep(
                step_id="step_3",
                action="launch_browser",
                detail=launch_detail,
            ),
            ExecutionStep(
                step_id="step_4",
                action="open_apply",
                detail=(
                    "Open the Ashby Apply flow from the careers page or the "
                    "inline application entry point."
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="upload_resume",
                detail=(
                    "Upload the resume first so Ashby can autofill applicant "
                    "details when available."
                ),
            ),
            ExecutionStep(
                step_id="step_6",
                action="review_autofill",
                detail=(
                    "Review autofilled fields for accuracy and fill any missing "
                    "required values such as phone or work authorization."
                ),
            ),
            ExecutionStep(
                step_id="step_7",
                action="answer_questions",
                detail=(
                    "Complete additional required questions, attachments, and "
                    "optional survey inputs conservatively."
                ),
            ),
            ExecutionStep(
                step_id="step_8",
                action="safe_stop",
                detail="Stop before final submit in safe mode.",
            ),
        ]
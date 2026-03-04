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
                    selector="input",
                ),
                VisibleField(
                    name="website",
                    label="Website / Portfolio",
                    field_type="text",
                    required=False,
                    selector="input",
                ),
                VisibleField(
                    name="cover_letter",
                    label="Cover Letter",
                    field_type="textarea",
                    required=False,
                    selector="textarea",
                ),
            ]
        )

        return fields

    def build_execution_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        steps: List[ExecutionStep] = [
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
                detail=(
                    f"Prepare browser navigation for {context.target_url}."
                ),
            ),
        ]

        if not context.should_apply:
            steps.append(
                ExecutionStep(
                    step_id="step_3",
                    action="skip",
                    detail=(
                        "Stop because the job did not meet the apply threshold."
                    ),
                )
            )
            return steps

        if context.mode == "plan":
            steps.extend(
                [
                    ExecutionStep(
                        step_id="step_3",
                        action="inspect_apply_entry",
                        detail=(
                            "Plan Ashby flow by locating the Apply button and "
                            "the resume upload entry point."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="plan_only",
                        detail=(
                            "Return execution plan only. "
                            "No live browser launched."
                        ),
                    ),
                ]
            )
            return steps

        if context.mode == "demo":
            steps.extend(
                [
                    ExecutionStep(
                        step_id="step_3",
                        action="simulate_open",
                        detail="Simulate opening the Ashby application page.",
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="simulate_resume_upload",
                        detail=(
                            "Simulate uploading the resume first to trigger "
                            "Ashby autofill."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_5",
                        action="simulate_required_fields",
                        detail=(
                            "Simulate filling remaining required fields and "
                            "optional survey inputs."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_6",
                        action="safe_stop",
                        detail="Stop before final submit in safe mode.",
                    ),
                ]
            )
            return steps

        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if context.transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )

        steps.extend(
            [
                ExecutionStep(
                    step_id="step_3",
                    action="launch_browser",
                    detail=launch_detail,
                ),
                ExecutionStep(
                    step_id="step_4",
                    action="open_apply",
                    detail=(
                        "Open the Ashby Apply flow from the careers page."
                    ),
                ),
                ExecutionStep(
                    step_id="step_5",
                    action="upload_resume",
                    detail=(
                        "Upload the resume first so Ashby can autofill "
                        "candidate details."
                    ),
                ),
                ExecutionStep(
                    step_id="step_6",
                    action="review_required_fields",
                    detail=(
                        "Fill remaining required fields and handle optional "
                        "survey questions conservatively."
                    ),
                ),
                ExecutionStep(
                    step_id="step_7",
                    action="safe_stop",
                    detail="Stop before final submit in safe mode.",
                ),
            ]
        )
        return steps
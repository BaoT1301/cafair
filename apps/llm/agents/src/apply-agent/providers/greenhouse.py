from __future__ import annotations

from typing import List

from .base import (
    BaseProviderAdapter,
    ExecutionStep,
    ProviderContext,
    VisibleField,
)


class GreenhouseProviderAdapter(BaseProviderAdapter):
    provider_name = "greenhouse"
    adapter_name = "greenhouse-form-adapter"

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
                    name="cover_letter",
                    label="Cover Letter",
                    field_type="textarea",
                    required=False,
                    selector="textarea",
                ),
                VisibleField(
                    name="linkedin",
                    label="LinkedIn",
                    field_type="text",
                    required=False,
                    selector="input",
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
                    "Initialize Python Nova runner for greenhouse "
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
                            "Check for either standard Apply button or "
                            "Autofill with Greenhouse / Quick Apply entry."
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
                        detail="Simulate opening the Greenhouse job page.",
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="simulate_quick_apply_check",
                        detail=(
                            "Simulate checking whether MyGreenhouse Quick Apply "
                            "is available."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_5",
                        action="simulate_fill",
                        detail=(
                            "Simulate prefilling standard applicant fields "
                            "or Quick Apply autofill."
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
                    action="detect_quick_apply",
                    detail=(
                        "Detect whether Autofill with Greenhouse / "
                        "MyGreenhouse Quick Apply is present."
                    ),
                ),
                ExecutionStep(
                    step_id="step_5",
                    action="branch_apply_flow",
                    detail=(
                        "Use Quick Apply when available; otherwise open the "
                        "standard Greenhouse application form."
                    ),
                ),
                ExecutionStep(
                    step_id="step_6",
                    action="prefill",
                    detail=(
                        "Prefill visible Greenhouse applicant fields, "
                        "including resume and optional cover letter."
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
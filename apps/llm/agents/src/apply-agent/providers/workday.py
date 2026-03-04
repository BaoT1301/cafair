from __future__ import annotations

from typing import List

from .base import (
    BaseProviderAdapter,
    ExecutionStep,
    ProviderContext,
    VisibleField,
)


class WorkdayProviderAdapter(BaseProviderAdapter):
    provider_name = "workday"
    adapter_name = "workday-form-adapter"

    def build_visible_fields(
        self,
        context: ProviderContext,
    ) -> List[VisibleField]:
        fields = super().build_visible_fields(context)

        fields.extend(
            [
                VisibleField(
                    name="phone",
                    label="Phone",
                    field_type="tel",
                    required=True,
                    selector="input[type='tel']",
                ),
                VisibleField(
                    name="address_line_1",
                    label="Address Line 1",
                    field_type="text",
                    required=False,
                    selector="input",
                ),
                VisibleField(
                    name="city",
                    label="City",
                    field_type="text",
                    required=False,
                    selector="input",
                ),
                VisibleField(
                    name="state",
                    label="State / Region",
                    field_type="text",
                    required=False,
                    selector="input",
                ),
                VisibleField(
                    name="postal_code",
                    label="Postal Code",
                    field_type="text",
                    required=False,
                    selector="input",
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
                    "Initialize Python Nova runner for workday "
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
                            "Locate the Workday Apply / Apply Manually entry "
                            "point and detect guest-apply vs sign-in flow."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="inspect_multi_step_form",
                        detail=(
                            "Plan the likely multi-step Workday flow, including "
                            "account, profile, experience, and review screens."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_5",
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
                        detail="Simulate opening the Workday application page.",
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="simulate_guest_apply_check",
                        detail=(
                            "Simulate checking whether guest apply is available "
                            "or whether sign-in is required."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_5",
                        action="simulate_multi_step_navigation",
                        detail=(
                            "Simulate stepping through the multi-page Workday "
                            "application flow."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_6",
                        action="simulate_fill",
                        detail=(
                            "Simulate prefilling candidate profile, resume, "
                            "contact, and basic application fields."
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
                        "Open the Workday apply flow using the Apply or "
                        "Apply Manually button."
                    ),
                ),
                ExecutionStep(
                    step_id="step_5",
                    action="resolve_auth_branch",
                    detail=(
                        "Choose guest apply when available; otherwise stop at "
                        "the sign-in or account creation checkpoint."
                    ),
                ),
                ExecutionStep(
                    step_id="step_6",
                    action="upload_resume",
                    detail=(
                        "Upload the resume early if a resume import step is "
                        "present in the Workday flow."
                    ),
                ),
                ExecutionStep(
                    step_id="step_7",
                    action="prefill_profile",
                    detail=(
                        "Prefill visible Workday fields across profile, "
                        "experience, and contact sections."
                    ),
                ),
                ExecutionStep(
                    step_id="step_8",
                    action="safe_stop",
                    detail="Stop before final submit in safe mode.",
                ),
            ]
        )
        return steps
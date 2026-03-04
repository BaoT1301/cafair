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
                    name="address_line_2",
                    label="Address Line 2",
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
                    name="country",
                    label="Country",
                    field_type="text",
                    required=False,
                    selector="select",
                ),
                VisibleField(
                    name="linkedin",
                    label="LinkedIn",
                    field_type="text",
                    required=False,
                    selector="input",
                ),
                VisibleField(
                    name="work_authorization",
                    label="Work Authorization",
                    field_type="text",
                    required=False,
                    selector="select",
                ),
                VisibleField(
                    name="sponsorship_required",
                    label="Requires Sponsorship",
                    field_type="checkbox",
                    required=False,
                    selector="input[type='checkbox']",
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
            steps.extend(
                [
                    ExecutionStep(
                        step_id="step_3",
                        action="skip",
                        detail=(
                            "Stop because the job did not meet the apply "
                            "threshold."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="return_skip_result",
                        detail=(
                            "Return a skip recommendation without launching "
                            "browser automation."
                        ),
                    ),
                ]
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
                            "point and identify guest-apply vs sign-in flow."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="inspect_resume_import",
                        detail=(
                            "Check whether Workday offers resume upload or "
                            "resume parsing early in the flow."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_5",
                        action="inspect_multi_step_form",
                        detail=(
                            "Plan the likely multi-step Workday flow across "
                            "account, profile, experience, disclosures, and "
                            "review screens."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_6",
                        action="inspect_required_questions",
                        detail=(
                            "Identify likely required questions such as work "
                            "authorization, sponsorship, address, and resume "
                            "requirements."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_7",
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
                            "Simulate checking whether guest apply is "
                            "available or whether sign-in is required."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_5",
                        action="simulate_resume_upload",
                        detail=(
                            "Simulate uploading the resume to trigger any "
                            "Workday autofill or parsing flow."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_6",
                        action="simulate_multi_step_navigation",
                        detail=(
                            "Simulate stepping through the multi-page Workday "
                            "application flow."
                        ),
                    ),
                    ExecutionStep(
                        step_id="step_7",
                        action="simulate_fill",
                        detail=(
                            "Simulate prefilling candidate profile, resume, "
                            "contact, disclosures, and basic application "
                            "fields."
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
                    action="review_resume_parse",
                    detail=(
                        "Review any parsed Workday profile data before "
                        "continuing to the next step."
                    ),
                ),
                ExecutionStep(
                    step_id="step_8",
                    action="prefill_profile",
                    detail=(
                        "Prefill visible Workday fields across profile, "
                        "experience, contact, and disclosures sections."
                    ),
                ),
                ExecutionStep(
                    step_id="step_9",
                    action="review_answers",
                    detail=(
                        "Review required answers such as authorization, "
                        "sponsorship, and location details before final review."
                    ),
                ),
                ExecutionStep(
                    step_id="step_10",
                    action="safe_stop",
                    detail="Stop before final submit in safe mode.",
                ),
            ]
        )
        return steps
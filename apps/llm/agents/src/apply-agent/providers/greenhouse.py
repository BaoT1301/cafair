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
                    placeholder="(555) 555-5555",
                ),
                VisibleField(
                    name="cover_letter",
                    label="Cover Letter",
                    field_type="textarea",
                    required=False,
                    selector="textarea",
                    placeholder="Optional cover letter or brief note",
                ),
                VisibleField(
                    name="linkedin",
                    label="LinkedIn",
                    field_type="text",
                    required=False,
                    selector=(
                        "input[name*='linkedin'], "
                        "input[placeholder*='LinkedIn'], "
                        "input"
                    ),
                    placeholder="https://www.linkedin.com/in/...",
                ),
                VisibleField(
                    name="website",
                    label="Website / Portfolio",
                    field_type="text",
                    required=False,
                    selector=(
                        "input[name*='website'], "
                        "input[name*='portfolio'], "
                        "input"
                    ),
                    placeholder="https://...",
                ),
            ]
        )

        return fields

    def build_plan_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        return [
            ExecutionStep(
                step_id="step_3",
                action="inspect_apply_entry",
                detail=(
                    "Check for either the standard Apply button or "
                    "the Autofill with Greenhouse / MyGreenhouse Quick Apply entry."
                ),
                selector="button, a[href*='application']",
            ),
            ExecutionStep(
                step_id="step_4",
                action="inspect_quick_apply",
                detail=(
                    "Inspect whether Greenhouse Quick Apply can autofill "
                    "the form through a saved MyGreenhouse profile."
                ),
                selector=(
                    "button[aria-label*='Autofill'], "
                    "button:has-text('Autofill with Greenhouse'), "
                    "button"
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="capture_fields",
                detail=(
                    "Identify standard Greenhouse applicant fields such as "
                    "name, email, resume, phone, and optional links."
                ),
                selector="form, input, textarea, input[type='file']",
            ),
            ExecutionStep(
                step_id="step_6",
                action="plan_only",
                detail="Return execution plan only. No live browser launched.",
            ),
        ]

    def build_demo_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        return [
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
                    "is available for this posting."
                ),
                selector=(
                    "button[aria-label*='Autofill'], "
                    "button:has-text('Autofill with Greenhouse'), "
                    "button"
                ),
            ),
            ExecutionStep(
                step_id="step_5",
                action="simulate_branch_apply_flow",
                detail=(
                    "Simulate branching between Quick Apply autofill and "
                    "the regular Greenhouse application form."
                ),
            ),
            ExecutionStep(
                step_id="step_6",
                action="simulate_fill",
                detail=(
                    "Simulate prefilling standard applicant fields, "
                    "resume upload, and optional cover letter input."
                ),
                selector="form, input, textarea, input[type='file']",
            ),
            ExecutionStep(
                step_id="step_7",
                action="safe_stop",
                detail="Stop before final submit in safe mode.",
            ),
        ]

    def build_live_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if context.transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )

        return [
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
                    "MyGreenhouse Quick Apply is present on the page."
                ),
                selector=(
                    "button[aria-label*='Autofill'], "
                    "button:has-text('Autofill with Greenhouse'), "
                    "button"
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
                action="capture_fields",
                detail=(
                    "Capture visible applicant inputs before writing any data."
                ),
                selector="form, input, textarea, input[type='file']",
            ),
            ExecutionStep(
                step_id="step_7",
                action="prefill",
                detail=(
                    "Prefill visible Greenhouse applicant fields, including "
                    "resume upload and optional cover letter."
                ),
                selector="form, input, textarea, input[type='file']",
            ),
            ExecutionStep(
                step_id="step_8",
                action="validate_required_fields",
                detail=(
                    "Validate required fields and confirm no required input "
                    "is still missing before submit."
                ),
            ),
            ExecutionStep(
                step_id="step_9",
                action="safe_stop",
                detail="Stop before final submit in safe mode.",
            ),
        ]
# Path: apps/llm/agents/src/apply-agent/providers/greenhouse.py

from __future__ import annotations

from typing import Any, List, Optional

from .base import BaseProviderAdapter, VisibleField


class GreenhouseProviderAdapter(BaseProviderAdapter):
    provider_name = "greenhouse"
    adapter_name = "greenhouse-form-adapter"

    def build_visible_fields(
        self,
        context: Optional[Any] = None,
    ) -> List[VisibleField]:
        fields = super().build_visible_fields(context)

        fields.append(
            VisibleField(
                name="cover_letter",
                label="Cover Letter",
                type="textarea",
                required=False,
                selector="textarea",
            )
        )

        return fields

    def build_plan_steps(
        self,
        *,
        company: Optional[str],
        role_title: Optional[str],
        should_apply: bool,
        safe_stop: bool,
    ) -> List[str]:
        role_label = role_title or "target role"
        company_label = company or "target company"

        if not should_apply:
            return [
                f"Open the job page for {role_label} at {company_label}.",
                "Wait for the page to stabilize.",
                "Verify the application page is reachable.",
                "Stop because this job did not meet the apply threshold.",
                "Return a skip recommendation instead of continuing.",
            ]

        return [
            f"Open the job page for {role_label} at {company_label}.",
            "Wait for the page to stabilize.",
            "Verify the application page is reachable.",
            "Find the Greenhouse Apply button.",
            "Open the application form.",
            "Capture visible applicant fields.",
            "Return plan only without launching live browser automation.",
        ]

    def build_demo_steps(
        self,
        *,
        company: Optional[str],
        role_title: Optional[str],
        should_apply: bool,
        safe_stop: bool,
    ) -> List[str]:
        role_label = role_title or "target role"
        company_label = company or "target company"

        if not should_apply:
            return [
                f"Open the job page for {role_label} at {company_label}.",
                "Stop because this job did not meet the apply threshold.",
            ]

        steps = [
            f"Open the job page for {role_label} at {company_label}.",
            "Wait for the page to stabilize.",
            "Verify the application page is reachable.",
            "Simulate clicking the Greenhouse Apply button.",
            "Simulate opening the application form.",
            "Simulate detecting visible applicant fields.",
            "Simulate prefilling saved candidate data.",
        ]

        if safe_stop:
            steps.append("Stop before final submit unless safe stop is disabled.")
        else:
            steps.append(
                "Safe stop disabled; do not submit automatically (still blocked)."
            )

        return steps

    def build_live_steps(
        self,
        *,
        company: Optional[str],
        role_title: Optional[str],
        should_apply: bool,
        safe_stop: bool,
        transport: str = "api",
        target_url: Optional[str] = None,
    ) -> List[str]:
        role_label = role_title or "target role"
        company_label = company or "target company"

        if not should_apply:
            return [
                f"Open the job page for {role_label} at {company_label}.",
                "Stop because this job did not meet the apply threshold.",
            ]

        steps = [
            f"Open the job page for {role_label} at {company_label}.",
            "Wait for the page to stabilize.",
            "Verify the application page is reachable.",
            "Find the Greenhouse Apply button.",
            "Open the application form.",
            "Capture visible applicant fields.",
            "Launch live browser automation.",
            "Prefill saved candidate data.",
        ]

        if safe_stop:
            steps.append("Stop before final submit unless safe stop is disabled.")
        else:
            steps.append(
                "Safe stop disabled; final submit is still blocked by design."
            )

        return steps

    def selectors(self) -> List[str]:
        return [
            "a[href*='application']",
            "button",
            "form",
            "input",
            "textarea",
            "input[type='file']",
        ]

    def visible_fields(self) -> List[dict]:
        fields = self.build_visible_fields(None)
        return [
            {
                "name": f.name,
                "label": f.label,
                "type": f.type,
                "required": bool(f.required),
                "selector": f.selector,
            }
            for f in fields
        ]
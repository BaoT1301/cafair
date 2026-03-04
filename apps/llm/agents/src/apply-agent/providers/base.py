from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional


ProviderName = Literal["greenhouse", "ashby", "workday", "unknown"]
RunnerMode = Literal["plan", "demo", "live"]


@dataclass
class ProviderContext:
    run_id: str
    provider: ProviderName
    mode: RunnerMode
    target_url: str
    should_apply: bool
    safe_stop_before_submit: bool = True
    company: Optional[str] = None
    role_title: Optional[str] = None
    selectors: List[str] = field(default_factory=list)
    planned_steps: List[str] = field(default_factory=list)
    transport: str = "workflow"


@dataclass
class VisibleField:
    name: str
    label: str
    field_type: str
    required: bool
    selector: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "type": self.field_type,
            "required": self.required,
            "selector": self.selector,
        }


@dataclass
class ExecutionStep:
    step_id: str
    action: str
    detail: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "id": self.step_id,
            "action": self.action,
            "detail": self.detail,
        }


class BaseProviderAdapter:
    provider_name: ProviderName = "unknown"
    adapter_name: str = "base-form-adapter"

    def build_visible_fields(self, context: ProviderContext) -> List[VisibleField]:
        return [
            VisibleField(
                name="first_name",
                label="First Name",
                field_type="text",
                required=True,
                selector="input",
            ),
            VisibleField(
                name="last_name",
                label="Last Name",
                field_type="text",
                required=True,
                selector="input",
            ),
            VisibleField(
                name="email",
                label="Email",
                field_type="email",
                required=True,
                selector="input[type='email']",
            ),
            VisibleField(
                name="resume",
                label="Resume",
                field_type="file",
                required=True,
                selector="input[type='file']",
            ),
        ]

    def build_execution_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        base_steps: List[ExecutionStep] = [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail=(
                    f"Initialize Python Nova runner for {self.provider_name} "
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
            base_steps.append(
                ExecutionStep(
                    step_id="step_3",
                    action="skip",
                    detail=(
                        "Stop because the job did not meet the apply threshold."
                    ),
                )
            )
            return base_steps

        if context.mode == "plan":
            base_steps.append(
                ExecutionStep(
                    step_id="step_3",
                    action="plan_only",
                    detail=(
                        "Return execution plan only. "
                        "No live browser launched."
                    ),
                )
            )
            return base_steps

        if context.mode == "demo":
            base_steps.extend(
                [
                    ExecutionStep(
                        step_id="step_3",
                        action="simulate_open",
                        detail="Simulate opening the application page.",
                    ),
                    ExecutionStep(
                        step_id="step_4",
                        action="simulate_fill",
                        detail="Simulate prefilling candidate fields.",
                    ),
                    ExecutionStep(
                        step_id="step_5",
                        action="safe_stop",
                        detail="Stop before final submit in safe mode.",
                    ),
                ]
            )
            return base_steps

        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if context.transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )

        base_steps.extend(
            [
                ExecutionStep(
                    step_id="step_3",
                    action="launch_browser",
                    detail=launch_detail,
                ),
                ExecutionStep(
                    step_id="step_4",
                    action="prefill",
                    detail="Prefill visible application fields.",
                ),
                ExecutionStep(
                    step_id="step_5",
                    action="safe_stop",
                    detail="Stop before final submit in safe mode.",
                ),
            ]
        )
        return base_steps

    def resolve_status(self, context: ProviderContext) -> str:
        if not context.should_apply:
            return "completed"
        if context.mode == "plan":
            return "planned"
        if context.mode == "live":
            return "running"
        return "queued"

    def build_message(self, context: ProviderContext) -> str:
        if not context.should_apply:
            return (
                "Python Nova runner skipped because threshold did not pass."
            )

        if context.mode == "live":
            return (
                "Python Nova runner prepared successfully. "
                f"Live execution is set to {context.transport} transport."
            )

        return "Python Nova runner prepared successfully."

    def to_result(self, context: ProviderContext) -> Dict[str, Any]:
        visible_fields = [
            field.to_dict() for field in self.build_visible_fields(context)
        ]
        execution_steps = [
            step.to_dict() for step in self.build_execution_steps(context)
        ]

        return {
            "ok": True,
            "runId": context.run_id,
            "provider": self.provider_name,
            "mode": context.mode,
            "status": self.resolve_status(context),
            "executed": bool(
                context.mode == "live" and context.should_apply
            ),
            "safeStopBeforeSubmit": context.safe_stop_before_submit,
            "visibleFields": visible_fields,
            "executionSteps": execution_steps,
            "message": self.build_message(context),
            "runner": {
                "engine": "nova-act",
                "transport": context.transport,
                "adapter": self.adapter_name,
                "provider": self.provider_name,
            },
            "targetUrl": context.target_url,
            "company": context.company,
            "roleTitle": context.role_title,
            "selectors": context.selectors,
            "plannedSteps": context.planned_steps,
        }
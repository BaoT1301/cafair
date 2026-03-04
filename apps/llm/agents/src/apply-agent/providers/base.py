from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional


ProviderName = Literal["greenhouse", "ashby", "workday", "unknown"]
RunnerMode = Literal["plan", "demo", "live"]
RunnerStatus = Literal["planned", "queued", "running", "completed", "failed"]


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

    def normalized_transport(self) -> str:
        transport = (self.transport or "workflow").strip().lower()
        if transport in {"api", "workflow"}:
            return transport
        return "workflow"


@dataclass
class VisibleField:
    name: str
    label: str
    field_type: str
    required: bool
    selector: str
    placeholder: Optional[str] = None
    options: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "name": self.name,
            "label": self.label,
            "type": self.field_type,
            "required": self.required,
            "selector": self.selector,
        }
        if self.placeholder:
            data["placeholder"] = self.placeholder
        if self.options:
            data["options"] = list(self.options)
        return data


@dataclass
class ExecutionStep:
    step_id: str
    action: str
    detail: str
    selector: Optional[str] = None

    def to_dict(self) -> Dict[str, str]:
        data: Dict[str, str] = {
            "id": self.step_id,
            "action": self.action,
            "detail": self.detail,
        }
        if self.selector:
            data["selector"] = self.selector
        return data


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
                selector="input[name='first_name'], input",
                placeholder="First name",
            ),
            VisibleField(
                name="last_name",
                label="Last Name",
                field_type="text",
                required=True,
                selector="input[name='last_name'], input",
                placeholder="Last name",
            ),
            VisibleField(
                name="email",
                label="Email",
                field_type="email",
                required=True,
                selector="input[type='email']",
                placeholder="name@example.com",
            ),
            VisibleField(
                name="resume",
                label="Resume",
                field_type="file",
                required=True,
                selector="input[type='file']",
            ),
        ]

    def get_primary_apply_selector(self, context: ProviderContext) -> Optional[str]:
        if context.selectors:
            return context.selectors[0]
        return None

    def build_common_start_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        primary_selector = self.get_primary_apply_selector(context)
        transport = context.normalized_transport()

        steps: List[ExecutionStep] = [
            ExecutionStep(
                step_id="step_1",
                action="initialize",
                detail=(
                    f"Initialize Python Nova runner for {self.provider_name} "
                    f"using {transport} transport."
                ),
            ),
            ExecutionStep(
                step_id="step_2",
                action="navigate",
                detail=f"Prepare browser navigation for {context.target_url}.",
            ),
        ]

        if primary_selector:
            steps.append(
                ExecutionStep(
                    step_id="step_3",
                    action="find_apply_entry",
                    detail="Resolve the primary application entry point.",
                    selector=primary_selector,
                )
            )

        return steps

    def build_skip_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        steps = self.build_common_start_steps(context)
        next_index = len(steps) + 1
        steps.append(
            ExecutionStep(
                step_id=f"step_{next_index}",
                action="skip",
                detail="Stop because the job did not meet the apply threshold.",
            )
        )
        return steps

    def build_plan_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        steps = self.build_common_start_steps(context)
        next_index = len(steps) + 1
        steps.append(
            ExecutionStep(
                step_id=f"step_{next_index}",
                action="plan_only",
                detail="Return execution plan only. No live browser launched.",
            )
        )
        return steps

    def build_demo_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        steps = self.build_common_start_steps(context)
        next_index = len(steps) + 1

        steps.extend(
            [
                ExecutionStep(
                    step_id=f"step_{next_index}",
                    action="simulate_open",
                    detail="Simulate opening the application page.",
                ),
                ExecutionStep(
                    step_id=f"step_{next_index + 1}",
                    action="simulate_fill",
                    detail="Simulate prefilling candidate fields.",
                ),
                ExecutionStep(
                    step_id=f"step_{next_index + 2}",
                    action="safe_stop",
                    detail="Stop before final submit in safe mode.",
                ),
            ]
        )
        return steps

    def build_live_steps(self, context: ProviderContext) -> List[ExecutionStep]:
        steps = self.build_common_start_steps(context)
        next_index = len(steps) + 1
        transport = context.normalized_transport()

        launch_detail = (
            "Launch API-driven Nova Act browser automation."
            if transport == "api"
            else "Launch workflow-driven Nova Act browser automation."
        )

        steps.extend(
            [
                ExecutionStep(
                    step_id=f"step_{next_index}",
                    action="launch_browser",
                    detail=launch_detail,
                ),
                ExecutionStep(
                    step_id=f"step_{next_index + 1}",
                    action="prefill",
                    detail="Prefill visible application fields.",
                ),
                ExecutionStep(
                    step_id=f"step_{next_index + 2}",
                    action="safe_stop",
                    detail="Stop before final submit in safe mode.",
                ),
            ]
        )
        return steps

    def build_execution_steps(
        self,
        context: ProviderContext,
    ) -> List[ExecutionStep]:
        if not context.should_apply:
            return self.build_skip_steps(context)
        if context.mode == "plan":
            return self.build_plan_steps(context)
        if context.mode == "demo":
            return self.build_demo_steps(context)
        return self.build_live_steps(context)

    def resolve_status(self, context: ProviderContext) -> RunnerStatus:
        if not context.should_apply:
            return "completed"
        if context.mode == "plan":
            return "planned"
        if context.mode == "live":
            return "running"
        return "queued"

    def build_message(self, context: ProviderContext) -> str:
        if not context.should_apply:
            return "Python Nova runner skipped because threshold did not pass."

        if context.mode == "plan":
            return (
                "Python Nova runner prepared successfully. "
                "Plan mode returned provider instructions only."
            )

        if context.mode == "demo":
            return (
                "Python Nova runner prepared successfully. "
                "Demo mode is simulating browser actions only."
            )

        return (
            "Python Nova runner prepared successfully. "
            f"Live execution is set to {context.normalized_transport()} transport."
        )

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
            "executed": bool(context.mode == "live" and context.should_apply),
            "safeStopBeforeSubmit": context.safe_stop_before_submit,
            "visibleFields": visible_fields,
            "executionSteps": execution_steps,
            "message": self.build_message(context),
            "runner": {
                "engine": "nova-act",
                "transport": context.normalized_transport(),
                "adapter": self.adapter_name,
                "provider": self.provider_name,
            },
            "targetUrl": context.target_url,
            "company": context.company,
            "roleTitle": context.role_title,
            "selectors": list(context.selectors),
            "plannedSteps": list(context.planned_steps),
        }
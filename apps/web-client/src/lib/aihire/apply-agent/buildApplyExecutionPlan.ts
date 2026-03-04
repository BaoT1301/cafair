// Path: apps/web-client/src/lib/aihire/apply-agent/buildApplyExecutionPlan.ts

import type { ApplicationProvider } from "@/lib/aihire/apply-agent/detectApplicationProvider";

type BuildApplyExecutionPlanInput = {
  targetUrl: string;
  provider: ApplicationProvider;
  company: string | null;
  roleTitle: string | null;
  shouldApply: boolean;
  mode: "demo" | "plan" | "live";
};

type ApplyExecutionPlan = {
  provider: ApplicationProvider;
  safeStopBeforeSubmit: boolean;
  selectors: string[];
  steps: string[];
};

function buildCommonSteps(
  input: BuildApplyExecutionPlanInput,
): string[] {
  const role = input.roleTitle || "target role";
  const company = input.company || "target company";

  const steps: string[] = [
    `Open the job page for ${role} at ${company}.`,
    "Wait for the page to stabilize.",
    "Verify the role is still open and the application page is reachable.",
  ];

  if (!input.shouldApply) {
    steps.push(
      "Stop because this job did not meet the apply threshold.",
      "Return a skip recommendation instead of continuing.",
    );
  }

  return steps;
}

export function buildApplyExecutionPlan(
  input: BuildApplyExecutionPlanInput,
): ApplyExecutionPlan {
  const steps = buildCommonSteps(input);

  if (input.shouldApply) {
    if (input.provider === "greenhouse") {
      steps.push(
        "Find the Greenhouse Apply button.",
        "Open the application form.",
        "Capture standard applicant fields.",
        "Prefill saved candidate data.",
        "Stop before final submit.",
      );
    } else if (input.provider === "workday") {
      steps.push(
        "Find the Workday Apply button.",
        "Handle guest apply or sign-in branch.",
        "Step through the multi-page form.",
        "Prefill saved candidate data.",
        "Stop before final submit.",
      );
    } else if (input.provider === "ashby") {
      steps.push(
        "Find the Ashby application form.",
        "Capture visible applicant fields.",
        "Prefill saved candidate data.",
        "Stop before final submit.",
      );
    } else {
      steps.push(
        "Use generic apply-button detection.",
        "Capture visible form fields.",
        "Stop before final submit.",
      );
    }
  }

  const selectorsByProvider: Record<ApplicationProvider, string[]> = {
    greenhouse: [
      "a[href*='application']",
      "button",
      "form",
      "input",
      "textarea",
      "input[type='file']",
    ],
    workday: [
      "a[data-automation-id='applyManually']",
      "button[data-automation-id='applyManually']",
      "button",
      "form",
      "input",
      "textarea",
      "input[type='file']",
    ],
    ashby: [
      "form",
      "button",
      "input",
      "textarea",
      "input[type='file']",
    ],
    unknown: [
      "a",
      "button",
      "form",
      "input",
      "textarea",
      "select",
      "input[type='file']",
    ],
  };

  return {
    provider: input.provider,
    safeStopBeforeSubmit: true,
    selectors: selectorsByProvider[input.provider],
    steps,
  };
}
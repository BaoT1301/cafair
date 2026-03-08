// agents/scripts/run-local.ts

import { runTriage } from "../src/agents/triage";
import type { TriageRequest } from "../src/types";

function sampleRequest(): TriageRequest {
  return {
    candidateId: "cand_001",
    candidateName: "Alex Nguyen",
    fair: {
      fairId: "fair_2026_online_vt",
      boothId: "booth_adi",
      timestampISO: new Date().toISOString(),
    },
    role: {
      roleId: "role_adi_ml_intern",
      roleName: "ML Intern (NLP)",
      jobDescriptionText:
        "Looking for Python, ML fundamentals, NLP experience, and ability to ship projects.",
      mustHaveKeywords: ["python", "machine learning", "nlp"],
      niceToHaveKeywords: ["pytorch", "aws", "docker", "llm", "retrieval"],
      thresholds: { recruiterNow: 0.72, quickScreen: 0.45 },
    },
    artifacts: {
      resumeText: `
        Alex Nguyen — 2025/2026
        Built an NLP project using Python and PyTorch.
        Implemented retrieval for a QA chatbot and shipped a demo.
        Used AWS S3 and Docker in a team project.
      `,
      transcriptText: `
        During the online career fair, I discussed my experience shipping an LLM retrieval demo.
      `,
    },
  };
}

function main() {
  const req = sampleRequest();
  const res = runTriage(req);
  console.log("=== TRIAGE RESULT ===");
  console.log(JSON.stringify(res, null, 2));
}

main();
// agents/scripts/run-microscreen-local.ts

import { runMicroScreen } from "../src/agents/microscreen";
function main() {
  const res = runMicroScreen({
    candidateId: "cand_003",
    roleId: "role_adi_ml_intern",
    roleName: "ML Intern (NLP)",
    mustHaveKeywords: ["python", "nlp", "machine learning"],
    questions: [
      "Tell me about a project you shipped.",
      "How did you evaluate your model?",
      "What are you looking for in this role?",
    ],
    responseTranscriptText: `
      I built and shipped a small NLP retrieval demo in Python.
      For evaluation, I measured top-k accuracy and did manual error analysis.
      I deployed it with Docker and tested latency. The impact was faster FAQ resolution for users.
    `,
  });

  console.log("=== MICROSCREEN RESULT ===");
  console.log(JSON.stringify(res, null, 2));
}

main();
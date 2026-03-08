// agents/scripts/run-verify-local.ts

import { runVerify } from "../src/agents/verify";

function main() {
  const res = runVerify({
    candidateId: "cand_002",
    roleId: "role_adi_ml_intern",
    roleName: "ML Intern (NLP)",
    mustHaveKeywords: ["python", "nlp", "machine learning"],
    artifacts: {
      resumeText: `
        Class of 2026.
        10 years experience in machine learning.
        Skills: Python, NLP.
      `,
      transcriptText: `
        I have 2 years of ML experience. I’m graduating 2026.
      `,
      essayText: `
        I am writing to express my interest in this role. Thank you for your consideration. In conclusion...
      `,
    },
  });

  console.log("=== VERIFY RESULT ===");
  console.log(JSON.stringify(res, null, 2));
}

main();
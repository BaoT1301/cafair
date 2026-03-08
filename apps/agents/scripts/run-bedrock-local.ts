// Path: agents/scripts/run-bedrock-local.ts

import { listFoundationModels } from "../src/adapters/bedrock";
import { runBedrockCandidateScreen } from "../src/agents/bedrockScreen";

async function main() {
  const models = await listFoundationModels();
  console.log("=== BEDROCK MODELS (first 10) ===");
  console.log(models.slice(0, 10));

  const result = await runBedrockCandidateScreen({
    candidateId: "cand_np_001",
    name: "Nguyen Phan Nguyen",
    roleTitle: "AI Music Engineer",
    companyName: "AI Hire AI",
    roleRequirements: ["PyTorch", "full-stack", "real-time systems"],
    resumeText: `
Developed real-time AI music transcription engine processing audio with <100ms latency.
Built React-based music visualization dashboard used by 10K+ users.
3 years ML + web dev. Strong PyTorch and full-stack experience.
    `.trim(),
  });

  console.log("=== BEDROCK SCREEN RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
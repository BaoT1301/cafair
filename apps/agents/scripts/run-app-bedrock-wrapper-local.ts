import { getBedrockScreen } from "../../../web-client/src/server/aihire/bedrock";

async function main() {
  const res = await getBedrockScreen({
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
    transcriptText: "",
    notes: "",
  });

  console.log("=== APP WRAPPER RESULT ===");
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
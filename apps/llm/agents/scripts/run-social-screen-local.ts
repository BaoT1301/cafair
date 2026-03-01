// Path: apps/llm/agents/scripts/run-social-screen-local.ts

import { runSocialScreen } from "../src/agents/socialScreen";

async function main() {
  const result = await runSocialScreen({
    candidateId: "cand_np_001",
    name: "Nguyen Phan Nguyen",
    roleTitle: "AI Music Engineer",
    school: "Georgia Tech",
    githubUrl: "https://github.com/ngstephen1",
    linkedinUrl: "https://www.linkedin.com/in/nguyenpn1/",
    resumeText: [
      "Developed real-time AI music transcription engine processing audio with <100ms latency.",
      "Built React-based music visualization dashboard used by 10K+ users.",
      "3 years of ML and web development experience with strong PyTorch and full-stack skills.",
      "Open-source work includes TypeScript UI components and Python ML projects.",
    ].join(" "),
    googleSummary: [
      "Public web references suggest active engineering presence.",
      "Hackathon-related and developer-profile results appear consistent with technical background.",
      "No obvious negative public signal in this local demo input.",
    ].join(" "),
  });

  console.log("=== SOCIAL SCREEN RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
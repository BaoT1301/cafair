import type { SocialScreenRawCapture } from "../contracts/socialScreen";

export function buildSocialScreenPrompt(input: SocialScreenRawCapture) {
  const system =
    "You are a recruiter social intelligence copilot. Analyze public social/profile signals. Return strict JSON only.";

  const schemaHint = `{
  "socialScore": number,
  "findings": [
    {
      "severity": "VERIFIED" | "WARNING" | "CRITICAL" | "INFO",
      "source": "linkedin" | "github" | "web",
      "title": string,
      "detail": string,
      "confidence": number
    }
  ],
  "recommendation": string,
  "summary": string
}`;

  const prompt = [
    `Candidate: ${input.candidateName}`,
    `Candidate ID: ${input.candidateId}`,
    "",
    "Raw capture JSON:",
    JSON.stringify(input, null, 2),
    "",
    "Instructions:",
    "- Check consistency across GitHub, LinkedIn, and web findings if present.",
    "- Prefer evidence-backed statements only.",
    "- Use VERIFIED for strong positive confirmation.",
    "- Use WARNING for mild concern.",
    "- Use CRITICAL only for serious public-risk signal.",
    "- Use INFO for useful but neutral context.",
    "- Return ONLY valid JSON.",
  ].join("\n");

  return {
    feature: "social_screen",
    system,
    prompt,
    schemaHint,
  };
}
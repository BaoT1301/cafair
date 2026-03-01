// Path: apps/llm/agents/scripts/run-social-screen-local.ts

import { runSocialScreenService } from "../src/services/socialScreenService";

async function main() {
  const result = await runSocialScreenService({
    candidateId: "cand_np_001",
    name: "Nguyen Phan Nguyen",
    roleTitle: "AI Music Engineer",
    school: "Georgia Tech",
    resumeText:
      "Developed real-time AI music transcription engine with <100ms latency. Built React-based music visualization dashboard used by 10K+ users. 3 years of ML and web development experience with strong PyTorch and full-stack skills.",

    linkedin: {
      url: "https://www.linkedin.com/in/nguyenpn1/",
      headline: "AI Music Engineer",
      currentCompany: "Independent / Project-based",
      school: "Georgia Tech",
      skills: ["PyTorch", "React", "TypeScript", "Python", "Full-stack"],
      experiences: [
        {
          title: "AI Music Engineer",
          company: "Independent",
          start: "2024",
          end: "Present",
          description: "Built AI music and real-time audio systems.",
        },
      ],
    },

    github: {
      url: "https://github.com/ngstephen1",
      username: "ngstephen1",
      displayName: "Nguyen Phan Nguyen",
      bio: "Software engineer building tools and ML products",
      followers: 89,
      following: 124,
      contributionsLastYear: 847,
      pinnedRepos: [
        {
          name: "react-travel-ui",
          description: "Component library for travel apps",
          language: "TypeScript",
          stars: 67,
        },
        {
          name: "ai-booking-engine",
          description: "ML-powered recommendation system",
          language: "Python",
          stars: 45,
        },
      ],
      topLanguages: ["TypeScript", "Python", "JavaScript", "Go"],
    },

    web: {
      queries: [
        "Nguyen Phan Nguyen developer",
        "Nguyen Phan Nguyen hackathon",
      ],
      results: [
        {
          title: "Conference talk found",
          snippet: "Built scalable apps and presented at a university tech event.",
          source: "google",
        },
        {
          title: "Hackathon winner",
          snippet: "Placed in a student hackathon with an AI project.",
          source: "google",
        },
      ],
    },

    useBedrock: true,
  });

  console.log("=== SOCIAL SCREEN RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
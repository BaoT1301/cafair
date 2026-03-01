import { runSocialScreen } from "../src/agents/socialScreen";

async function main() {
  const result = await runSocialScreen({
    candidateId: "cand_np_001",
    candidateName: "Nguyen Phan Nguyen",
    github: {
      url: "https://github.com/ngstephen1",
      username: "ngstephen1",
      displayName: "Nguyen Phan Nguyen",
      bio: "Software engineer building tools for travel industry",
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
          description: "ML-powered hotel recommendation system",
          language: "Python",
          stars: 45,
        },
      ],
      topLanguages: ["TypeScript", "Python", "JavaScript", "Go"],
    },
    web: {
      queries: [
        "Nguyen Phan Nguyen Virginia Tech developer",
        "Nguyen Phan Nguyen hackathon",
      ],
      results: [
        {
          title: "Stephen Nguyen - Software Engineer | LinkedIn",
          snippet: "Software Engineer at Marriott International. Virginia Tech CS '23.",
          source: "google",
        },
        {
          title: "HokieHacks 2023 Winners",
          snippet: "1st place - AI travel recommendation engine.",
          source: "google",
        },
      ],
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
import { db } from "./index";
import { candidates, events, jobRoles, evidence } from "@/services/recruiter/schema";

// ─── Derived seed content ─────────────────────────────────
// These exist so the candidate-facing app has real data to work with. Emails
// let a signed-in candidate claim a profile; evidence bodies are what match
// scoring actually reads. Derived rather than hand-written so 24 rows stay
// consistent and survive edits to names or roles.

// Accepts both the literal seed objects and rows read back from Drizzle, which
// widen every optional column to `| null`.
type SeedCandidate = {
  name: string;
  school?: string | null;
  role?: string | null;
  fitScore?: number | null;
  strengths?: string[] | null;
  gaps?: string[] | null;
};

const SCHOOL_DOMAIN: Record<string, string> = {
  "George Mason University": "gmu.edu",
  "Virginia Tech": "vt.edu",
  "Stanford University": "stanford.edu",
  "MIT": "mit.edu",
  "Princeton": "princeton.edu",
  "Carnegie Mellon": "cmu.edu",
  "Cornell": "cornell.edu",
  "UIUC": "illinois.edu",
  "Johns Hopkins": "jhu.edu",
  "Howard University": "howard.edu",
  "Penn State": "psu.edu",
  "University of Maryland": "umd.edu",
  "Parsons": "newschool.edu",
};

const ROLE_SKILLS: Record<string, string[]> = {
  swe: ["TypeScript", "React", "Git", "REST APIs", "Data Structures", "Next.js", "PostgreSQL"],
  ml: ["Python", "PyTorch", "Machine Learning", "Statistics", "NumPy", "Transformers"],
  ds: ["Python", "SQL", "Pandas", "Statistics", "Data Visualization", "A/B Testing"],
  de: ["Python", "SQL", "ETL", "Data Modeling", "Airflow", "Spark"],
  robotics: ["C++", "ROS", "Control Systems", "Linux", "Embedded Systems", "Computer Vision"],
  design: ["Figma", "User Research", "Prototyping", "Design Systems", "Wireframing", "Accessibility"],
};

function roleFamily(role?: string | null): keyof typeof ROLE_SKILLS {
  const r = (role ?? "").toLowerCase();
  if (r.includes("ml") || r.includes("machine")) return "ml";
  if (r.includes("data scien")) return "ds";
  if (r.includes("data eng")) return "de";
  if (r.includes("robot")) return "robotics";
  if (r.includes("design")) return "design";
  return "swe";
}

const seenEmails = new Set<string>();

function deriveEmail(name: string, school?: string | null): string {
  const parts = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/);
  const first = parts[0] ?? "student";
  const last = parts[parts.length - 1] ?? "candidate";
  const domain = (school && SCHOOL_DOMAIN[school]) ?? "example.edu";
  let email = `${first}.${last}@${domain}`;
  let n = 2;
  while (seenEmails.has(email)) email = `${first}.${last}${n++}@${domain}`;
  seenEmails.add(email);
  return email;
}

function deriveSummary(c: SeedCandidate): string {
  const s = (c.strengths ?? []).slice(0, 2);
  const g = (c.gaps ?? [])[0];
  const strengthText = s.length ? s.join(" and ").replace(/\.$/, "") : "solid fundamentals";
  const gapText = g
    ? ` The main open question is ${g.charAt(0).toLowerCase()}${g.slice(1).replace(/\.$/, "")}.`
    : "";
  return `${c.name} is a ${c.school ?? "university"} candidate tracking toward ${c.role ?? "an internship"}. The assessment picked up ${strengthText}.${gapText} Overall fit scored ${c.fitScore ?? 0}/100 against the published requirements.`;
}

function deriveResume(c: SeedCandidate): string {
  const skills = ROLE_SKILLS[roleFamily(c.role)];
  return [
    `${c.name} — ${c.school ?? "University"}`,
    `Target role: ${c.role ?? "Software Engineer Intern"}`,
    ``,
    `EXPERIENCE`,
    `Built and shipped projects using ${skills.slice(0, 4).join(", ")}. Worked in a small team using ${skills[4]} and ${skills[5]}, taking features from design through review to release.`,
    ``,
    `SKILLS`,
    skills.join(", "),
    ``,
    `HIGHLIGHTS`,
    (c.strengths ?? []).join(". ") || "Consistent academic record with hands-on project work.",
  ].join("\n");
}

const deriveScreenNote = (c: SeedCandidate) =>
  `Micro-screen notes — ${c.name}\n\nWalked through a recent project end to end and explained the tradeoffs behind the design without prompting. Answered follow-up questions directly, and said "I don't know" once rather than guessing.`;

const deriveEssay = (c: SeedCandidate) =>
  `Short essay — ${c.name}\n\nOn why this role: wants to work where the feedback loop between building something and seeing people use it is short. Cites a project rewritten twice after user feedback as the most instructive experience.`;

const deriveCodeSignals = (c: SeedCandidate) =>
  `Code signals — ${c.name}\n\nPublic repositories show consistent commit history over 8+ months rather than a burst before applications opened. Commit messages are descriptive. Tests present on the two largest projects.`;

async function seed() {
  console.log("Seeding database...");

  // ─── Event ─────────────────────────────────────────────
  const [event] = await db.insert(events).values({
    userId: "seed",
    name: "Tech Talent Expo 2026",
    date: new Date("2026-03-16"),
    location: "George Mason University",
    status: "live",
    recruiterCount: 5,
    candidateCount: 15,
  }).returning();

  console.log("✓ Event created");

  // ─── Job Roles ─────────────────────────────────────────
  // `mustHaveSkills` / `niceToHaveSkills` / `jobDescription` are load-bearing,
  // not decoration: candidate-side match scoring, `scoreCandidate` and
  // `generateRoleAlignment` all read them. Leaving them null makes every role
  // score identically and gives the LLM nothing to score against.
  const roles = await db.insert(jobRoles).values([
    {
      userId: "seed", eventId: event.id, title: "SWE Intern", department: "Engineering",
      targetHires: 6, offersNeeded: 12, offersSent: 3, offersAccepted: 1, status: "at_risk",
      mustHaveSkills: ["TypeScript", "React", "Git", "REST APIs", "Data Structures"],
      niceToHaveSkills: ["Next.js", "PostgreSQL", "Docker", "Unit Testing"],
      jobDescription: "Build and ship user-facing features across our web stack. You'll work in TypeScript and React alongside a senior engineer, take a feature from ticket to production, and participate in code review. We care far more about how you reason through a problem than which frameworks you've already used.",
    },
    {
      userId: "seed", eventId: event.id, title: "ML Engineer Intern", department: "AI/ML",
      targetHires: 4, offersNeeded: 8, offersSent: 2, offersAccepted: 1, status: "on_track",
      mustHaveSkills: ["Python", "PyTorch", "Machine Learning", "Statistics", "NumPy"],
      niceToHaveSkills: ["Transformers", "MLOps", "Hugging Face", "Model Evaluation"],
      jobDescription: "Train, evaluate and deploy models that run in production. You'll own an experiment end to end — data prep, training loop, offline evaluation, and shipping behind a feature flag. Strong fundamentals in statistics and a habit of measuring things properly matter more than leaderboard scores.",
    },
    {
      userId: "seed", eventId: event.id, title: "Data Science Intern", department: "Analytics",
      targetHires: 3, offersNeeded: 6, offersSent: 1, offersAccepted: 0, status: "at_risk",
      mustHaveSkills: ["Python", "SQL", "Pandas", "Statistics", "Data Visualization"],
      niceToHaveSkills: ["A/B Testing", "scikit-learn", "Tableau", "Causal Inference"],
      jobDescription: "Turn messy product data into decisions people actually act on. You'll write SQL against our warehouse, build analyses in Python, and present findings to non-technical stakeholders. The best work here is a clear answer to a question someone was afraid to ask.",
    },
    {
      userId: "seed", eventId: event.id, title: "Data Engineer Intern", department: "Infrastructure",
      targetHires: 2, offersNeeded: 4, offersSent: 1, offersAccepted: 1, status: "on_track",
      mustHaveSkills: ["Python", "SQL", "ETL", "Data Modeling", "Airflow"],
      niceToHaveSkills: ["Spark", "Kafka", "dbt", "AWS"],
      jobDescription: "Build the pipelines everything else depends on. You'll design schemas, write ingestion jobs, and make our warehouse something people trust. Expect to spend real time on data quality and idempotency — the unglamorous parts that make the rest work.",
    },
    {
      userId: "seed", eventId: event.id, title: "Robotics Engineer Intern", department: "Hardware",
      targetHires: 1, offersNeeded: 2, offersSent: 0, offersAccepted: 0, status: "at_risk",
      mustHaveSkills: ["C++", "ROS", "Control Systems", "Linux", "Embedded Systems"],
      niceToHaveSkills: ["Python", "SLAM", "Computer Vision", "CAD"],
      jobDescription: "Work on perception and control for our mobile platform. You'll write C++ against ROS, test in simulation, and then find out what actually happens on hardware. Comfort with debugging on real robots — and patience when they misbehave — goes a long way.",
    },
    {
      userId: "seed", eventId: event.id, title: "Product Design Intern", department: "Design",
      targetHires: 2, offersNeeded: 4, offersSent: 1, offersAccepted: 0, status: "on_track",
      mustHaveSkills: ["Figma", "User Research", "Prototyping", "Design Systems", "Wireframing"],
      niceToHaveSkills: ["Usability Testing", "Motion Design", "HTML/CSS", "Accessibility"],
      jobDescription: "Own the design of a feature from problem framing through shipped UI. You'll run lightweight research, prototype in Figma, and work directly with engineers through implementation. We want to see how you narrow an ambiguous problem, not just the final pixels.",
    },
  ]).returning();

  console.log("✓ Roles created");

  // ─── Candidates ────────────────────────────────────────
  const sweRole = roles.find(r => r.title === "SWE Intern")!;
  const mlRole = roles.find(r => r.title === "ML Engineer Intern")!;
  const dsRole = roles.find(r => r.title === "Data Science Intern")!;
  const designRole = roles.find(r => r.title === "Product Design Intern")!;

  const candidateSeed = [
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Lam Anh Truong", school: "George Mason University", role: "Head of AWS Cloud",
      fitScore: 95, riskLevel: "low", stage: "offer", lane: "recruiter_now",
      verified: true, strengths: ["Cloud architecture", "AWS expertise", "Leadership"],
      gaps: ["Frontend experience"], nextAction: "Extend senior engineer offer",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: mlRole.id,
      name: "Aisha Patel", school: "Stanford University", role: "ML Engineer Intern",
      fitScore: 94, riskLevel: "low", stage: "interview", lane: "recruiter_now",
      verified: true, strengths: ["PyTorch", "Python", "Research background"],
      gaps: ["Production ML experience"], nextAction: "Schedule final interview",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: mlRole.id,
      name: "Khoi Nguyen", school: "George Mason University", role: "CS PhD Student",
      fitScore: 93, riskLevel: "low", stage: "interview", lane: "recruiter_now",
      verified: true, strengths: ["Research depth", "NLP", "Publications"],
      gaps: ["Industry experience"], nextAction: "Final round with research team",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Emily Zhang", school: "Princeton", role: "SWE Intern",
      fitScore: 92, riskLevel: "low", stage: "interview", lane: "recruiter_now",
      verified: true, strengths: ["System design", "Distributed systems", "Java"],
      gaps: ["Frontend skills"], nextAction: "Prepare interview panel",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Jordan Kim", school: "MIT", role: "SWE Intern",
      fitScore: 91, riskLevel: "low", stage: "screen", lane: "recruiter_now",
      verified: false, strengths: ["React", "TypeScript", "Full-stack"],
      gaps: ["System design depth"], nextAction: "Begin micro-screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: designRole.id,
      name: "Mai Thanh Tran", school: "George Mason University", role: "Chief Design Officer",
      fitScore: 91, riskLevel: "low", stage: "interview", lane: "recruiter_now",
      verified: true, strengths: ["UI/UX", "Figma", "User research"],
      gaps: ["Engineering collaboration"], nextAction: "Executive interview with CPO",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "David Okafor", school: "Cornell University", role: "SWE Intern",
      fitScore: 90, riskLevel: "low", stage: "offer", lane: "recruiter_now",
      verified: true, strengths: ["Backend", "APIs", "Go"],
      gaps: ["Cloud experience"], nextAction: "Await response",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: mlRole.id,
      name: "Nguyen Phan Nguyen", school: "Virginia Tech", role: "AI Music Engineer",
      fitScore: 90, riskLevel: "low", stage: "screen", lane: "quick_screen",
      verified: false, strengths: ["Python", "Music production", "Creative AI"],
      gaps: ["Traditional ML depth"], nextAction: "Schedule technical screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: dsRole.id,
      name: "Bao Tran", school: "George Mason University", role: "Data Magician",
      fitScore: 89, riskLevel: "low", stage: "screen", lane: "quick_screen",
      verified: false, strengths: ["Python", "SQL", "Data pipelines"],
      gaps: ["ML modeling", "Statistics depth"], nextAction: "Schedule final interview",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: dsRole.id,
      name: "Lucia Fernandez", school: "Carnegie Mellon", role: "Data Science Intern",
      fitScore: 88, riskLevel: "low", stage: "fair", lane: "quick_screen",
      verified: true, strengths: ["Analytics portfolio", "Business acumen"],
      gaps: ["Limited ML depth", "No internship experience"], nextAction: "Invite to priority lane",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Que Anh Truong", school: "Virginia Tech", role: "Robotics Engineer Intern",
      fitScore: 88, riskLevel: "low", stage: "screen", lane: "recruiter_now",
      verified: false, strengths: ["Robotics", "C++", "Hardware integration"],
      gaps: ["Software architecture"], nextAction: "Technical deep-dive",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: mlRole.id,
      name: "Raj Krishnamurthy", school: "UIUC", role: "ML Engineer Intern",
      fitScore: 87, riskLevel: "low", stage: "screen", lane: "quick_screen",
      verified: true, strengths: ["TensorFlow", "Computer vision", "Research"],
      gaps: ["Production deployment"], nextAction: "Schedule technical screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: designRole.id,
      name: "Trang Cao", school: "Virginia Tech", role: "Graphic Designer",
      fitScore: 86, riskLevel: "low", stage: "interview", lane: "recruiter_now",
      verified: false, strengths: ["Visual design", "Brand identity", "Figma"],
      gaps: ["Motion design"], nextAction: "Design challenge assignment",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Tue Tran Minh", school: "George Mason University", role: "Software Engineer Intern",
      fitScore: 84, riskLevel: "medium", stage: "interview", lane: "quick_screen",
      verified: false, strengths: ["Frontend", "React", "UI development"],
      gaps: ["Backend experience", "System design"], nextAction: "Review interview feedback",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: dsRole.id,
      name: "Duc Anh Nguyen", school: "George Mason University", role: "Data Analyst Intern",
      fitScore: 79, riskLevel: "medium", stage: "fair", lane: "redirect",
      verified: false, strengths: ["Excel", "SQL", "Data visualization"],
      gaps: ["Python", "ML knowledge", "Statistics"], nextAction: "Redirect to analyst role",
      ownerId: "seed",
    },
    // ── Mock candidate for full workflow testing ──
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Hai Lam", school: "George Mason University", role: "Software Engineer Intern",
      fitScore: 72, riskLevel: "medium", stage: "screen", lane: "quick_screen",
      verified: false,
      strengths: [
        "Strong problem-solving fundamentals",
        "Solid TypeScript and React skills",
        "Fast learner — completed 3 side projects this semester",
      ],
      gaps: [
        "Limited system design exposure",
        "No prior internship experience",
        "Backend and API design depth below bar",
      ],
      summary:
        "Hai Lam is a junior at GMU with a solid frontend foundation and strong project initiative. " +
        "AI scoring flagged limited backend depth and no prior internship experience as risks. " +
        "However, the quality of side projects and demonstrated learning velocity suggest potential " +
        "beyond the raw score. Recruiter override may be warranted if role has mentorship bandwidth.",
      nextAction: "Complete phone screen; evaluate override if score doesn't reflect true potential",
      ownerId: "seed",
    },

    // ── Fresh applicants — just arrived at the career fair (stage: fair) ──
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Marcus Webb", school: "University of Maryland", role: "Software Engineer Intern",
      fitScore: 83, riskLevel: "low", stage: "fair", lane: "quick_screen",
      verified: false, strengths: ["Node.js", "AWS", "REST APIs"],
      gaps: ["No ML experience", "Limited frontend"], nextAction: "Queue for quick screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: mlRole.id,
      name: "Priya Suresh", school: "Johns Hopkins University", role: "ML Engineer Intern",
      fitScore: 81, riskLevel: "low", stage: "fair", lane: "quick_screen",
      verified: false, strengths: ["Python", "Scikit-learn", "Data analysis"],
      gaps: ["No deep learning experience", "Limited prod exposure"], nextAction: "Queue for quick screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Tyler Brooks", school: "Virginia Tech", role: "Software Engineer Intern",
      fitScore: 78, riskLevel: "low", stage: "fair", lane: "quick_screen",
      verified: false, strengths: ["Java", "Spring Boot", "OOP"],
      gaps: ["No cloud experience", "Weak on modern JS stack"], nextAction: "Queue for quick screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: dsRole.id,
      name: "Nadia Osei", school: "Howard University", role: "Data Science Intern",
      fitScore: 76, riskLevel: "medium", stage: "fair", lane: "quick_screen",
      verified: false, strengths: ["R", "Tableau", "Statistics"],
      gaps: ["No Python", "Limited SQL", "No ML models in prod"], nextAction: "Queue for quick screen",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Sean Callahan", school: "Penn State University", role: "Software Engineer Intern",
      fitScore: 74, riskLevel: "medium", stage: "fair", lane: "redirect",
      verified: false, strengths: ["C++", "Algorithms", "Competitive programming"],
      gaps: ["No web experience", "No team projects"], nextAction: "Redirect to embedded track",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: designRole.id,
      name: "Anya Petrova", school: "Parsons School of Design", role: "Product Design Intern",
      fitScore: 86, riskLevel: "low", stage: "fair", lane: "recruiter_now",
      verified: false, strengths: ["Figma", "Prototyping", "UX research"],
      gaps: ["No developer handoff experience"], nextAction: "Priority — fast track to interview",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: mlRole.id,
      name: "James Okonkwo", school: "Carnegie Mellon", role: "ML Engineer Intern",
      fitScore: 67, riskLevel: "high", stage: "fair", lane: "redirect",
      verified: false, strengths: ["Enthusiasm", "Math background"],
      gaps: ["No Python", "No ML projects", "GPA below threshold"], nextAction: "Polite redirect",
      ownerId: "seed",
    },
    {
      userId: "seed", eventId: event.id, roleId: sweRole.id,
      name: "Linh Pham", school: "George Mason University", role: "Software Engineer Intern",
      fitScore: 80, riskLevel: "low", stage: "fair", lane: "quick_screen",
      verified: false, strengths: ["Go", "Docker", "Backend systems"],
      gaps: ["No frontend", "Limited testing experience"], nextAction: "Queue for quick screen",
      ownerId: "seed",
    },
  ];

  // `email` is the join key the candidate-facing app uses to match a signed-in
  // Clerk user to their row (services/candidate/procedures). Seeding without it
  // means no seeded candidate can ever be claimed. Derived rather than
  // hand-written so it stays correct if names change.
  const candidateData = await db.insert(candidates).values(
    candidateSeed.map(c => ({
      ...c,
      email: deriveEmail(c.name, c.school),
      summary: ("summary" in c && c.summary) ? c.summary : deriveSummary(c),
    }))
  ).returning();

  console.log("✓ Candidates created");

  // ─── Evidence ──────────────────────────────────────────
  // `content` matters: candidate-side match scoring reads this text. Rows with
  // a null body make every match look weak. `url` stays null rather than "#" so
  // the UI doesn't render a link that goes nowhere.
  const byId = new Map(candidateData.map(c => [c.id, c]));
  await db.insert(evidence).values(
    candidateData.flatMap(c => [
      { candidateId: c.id, type: "resume", content: deriveResume(byId.get(c.id)!) },
      { candidateId: c.id, type: "screen", content: deriveScreenNote(byId.get(c.id)!) },
    ...(( c.fitScore ?? 0) > 88 ? [{ candidateId: c.id, type: "essay", content: deriveEssay(byId.get(c.id)!) }] : []),
    ...(( c.fitScore ?? 0) > 85 ? [{ candidateId: c.id, type: "code", content: deriveCodeSignals(byId.get(c.id)!) }] : []),
    ])
  );

  console.log("✓ Evidence created");
  console.log("✅ Seeding complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
import { db } from "./index";
import { candidates, events, jobRoles, evidence } from "@/services/recruiter/schema";

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
  const roles = await db.insert(jobRoles).values([
    { userId: "seed", eventId: event.id, title: "SWE Intern", department: "Engineering", targetHires: 6, offersNeeded: 12, offersSent: 3, offersAccepted: 1, status: "at_risk" },
    { userId: "seed", eventId: event.id, title: "ML Engineer Intern", department: "AI/ML", targetHires: 4, offersNeeded: 8, offersSent: 2, offersAccepted: 1, status: "on_track" },
    { userId: "seed", eventId: event.id, title: "Data Science Intern", department: "Analytics", targetHires: 3, offersNeeded: 6, offersSent: 1, offersAccepted: 0, status: "at_risk" },
    { userId: "seed", eventId: event.id, title: "Data Engineer Intern", department: "Infrastructure", targetHires: 2, offersNeeded: 4, offersSent: 1, offersAccepted: 1, status: "on_track" },
    { userId: "seed", eventId: event.id, title: "Robotics Engineer Intern", department: "Hardware", targetHires: 1, offersNeeded: 2, offersSent: 0, offersAccepted: 0, status: "at_risk" },
    { userId: "seed", eventId: event.id, title: "Product Design Intern", department: "Design", targetHires: 2, offersNeeded: 4, offersSent: 1, offersAccepted: 0, status: "on_track" },
  ]).returning();

  console.log("✓ Roles created");

  // ─── Candidates ────────────────────────────────────────
  const sweRole = roles.find(r => r.title === "SWE Intern")!;
  const mlRole = roles.find(r => r.title === "ML Engineer Intern")!;
  const dsRole = roles.find(r => r.title === "Data Science Intern")!;
  const designRole = roles.find(r => r.title === "Product Design Intern")!;

  const candidateData = await db.insert(candidates).values([
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
  ]).returning();

  console.log("✓ Candidates created");

  // ─── Evidence ──────────────────────────────────────────
  await db.insert(evidence).values(
    candidateData.flatMap(c => [
      { candidateId: c.id, type: "resume", url: "#" },
      { candidateId: c.id, type: "screen", url: "#" },
    ...(( c.fitScore ?? 0) > 88 ? [{ candidateId: c.id, type: "essay", url: "#" }] : []),
    ...(( c.fitScore ?? 0) > 85 ? [{ candidateId: c.id, type: "code", url: "#" }] : []),
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
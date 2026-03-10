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
"use client";

import { useRouter } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { motion } from "framer-motion";

const LOGO_URL = "/aihire-logo.png";
const ICON_RECRUITER = "/logos/recruiter.png";
const ICON_CANDIDATE = "/logos/candidate.png";

export default function GetStartedPage() {
  const router = useRouter();
  const { openSignIn } = useClerk();
  // Deliberately not gated on `isLoaded`. If Clerk fails to load, `isSignedIn`
  // stays undefined and we fall back to the sign-in handler — the card itself
  // still renders. Gating visibility on Clerk previously made the whole
  // recruiter entry point disappear whenever Clerk was unreachable.
  const { isSignedIn } = useAuth();
  const [hovered, setHovered] = useState<"recruiter" | "candidate" | null>(null);

  const goToRecruiter = () => router.push("/recruiter/hiring-center");
  const triggerRecruiterSignIn = () => openSignIn({ redirectUrl: "/recruiter/hiring-center" });

  const goToCandidate = () => router.push("/candidate");
  const triggerCandidateSignIn = () => openSignIn({ redirectUrl: "/candidate" });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f7f7f7",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
      padding: "24px",
    }}>
      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 48 }}>
        <img src={LOGO_URL} alt="AI Hire AI" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 10 }} />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "#111827" }}>AI Hire AI</span>
      </motion.div>

      {/* Heading */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 36, fontWeight: 600, lineHeight: "40px", color: "#111827", margin: "0 0 12px" }}>
          Welcome to AI Hire AI
        </h1>
        <p style={{ fontSize: 18, fontWeight: 400, lineHeight: "28px", color: "#6b7280", margin: 0 }}>
          Select your role to continue
        </p>
      </motion.div>

      {/* Cards */}
      {/* `alignItems: stretch` + `height: 100%` on the buttons keeps both cards
          the same height regardless of copy length; the CTAs then pin to the
          bottom with `marginTop: auto` so they line up. */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", alignItems: "stretch", maxWidth: 720 }}>

        {/* Recruiter card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.16, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex" }}>
        <button
          onClick={isSignedIn ? goToRecruiter : triggerRecruiterSignIn}
          onMouseEnter={() => setHovered("recruiter")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: "white",
            border: hovered === "recruiter" ? "1px solid #0e3d27" : "1px solid transparent",
            borderRadius: 16,
            padding: 32,
            width: 324,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            cursor: "pointer",
            boxShadow: hovered === "recruiter" ? "0 8px 32px rgba(14,61,39,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          <RecruiterCardContent />
        </button>
        </motion.div>

        {/* Candidate card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.24, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex" }}>
        <button
          onClick={isSignedIn ? goToCandidate : triggerCandidateSignIn}
          onMouseEnter={() => setHovered("candidate")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: "white",
            border: hovered === "candidate" ? "1px solid #0e3d27" : "1px solid transparent",
            borderRadius: 16,
            padding: 32,
            width: 324,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            cursor: "pointer",
            boxShadow: hovered === "candidate" ? "0 8px 32px rgba(14,61,39,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          <CandidateCardContent />
        </button>
        </motion.div>
      </div>

      {/* Back link */}
      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => router.push("/")}
        style={{
          marginTop: 40,
          background: "transparent",
          border: "none",
          color: "#9ca3af",
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ← Back to home
      </motion.button>
    </div>
  );
}

function RecruiterCardContent() {
  return (
    <>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e2e8e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={ICON_RECRUITER} alt="Recruiter" style={{ width: 32, height: 32 }} />
      </div>
      <p style={{ fontSize: 24, fontWeight: 600, lineHeight: "32px", color: "#111827", margin: 0 }}>Recruiter</p>
      <p style={{ fontSize: 16, fontWeight: 500, lineHeight: "24px", color: "#6b7280", margin: 0, maxWidth: 244 }}>
        Access the AI-driven command center to review candidates, approve decisions, and manage hiring
      </p>
      <div style={{
        marginTop: "auto",
        background: "linear-gradient(90deg, #1A4A2E 0%, #3E7A52 100%)",
        color: "white",
        borderRadius: 99,
        padding: "10px 28px",
        fontSize: 14,
        fontWeight: 600,
      }}>
        Continue as Recruiter →
      </div>
    </>
  );
}

function CandidateCardContent() {
  return (
    <>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e2e8e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={ICON_CANDIDATE} alt="Candidate" style={{ width: 32, height: 32 }} />
      </div>
      <p style={{ fontSize: 24, fontWeight: 600, lineHeight: "32px", color: "#111827", margin: 0 }}>Candidate</p>
      <p style={{ fontSize: 16, fontWeight: 500, lineHeight: "24px", color: "#6b7280", margin: 0, maxWidth: 244 }}>
        Build your profile packet, discover matched roles, and track your applications
      </p>
      <div style={{
        marginTop: "auto",
        background: "linear-gradient(90deg, #1A4A2E 0%, #3E7A52 100%)",
        color: "white",
        borderRadius: 99,
        padding: "10px 28px",
        fontSize: 14,
        fontWeight: 600,
      }}>
        Continue as Candidate →
      </div>
    </>
  );
}

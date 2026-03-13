"use client";

import { useRouter } from "next/navigation";
import { useClerk, SignedIn, SignedOut } from "@clerk/nextjs";
import { useState } from "react";
import { motion } from "framer-motion";

const LOGO_URL = "https://www.figma.com/api/mcp/asset/711a3b98-0750-4e7c-9876-6f715b363504";
const ICON_RECRUITER = "https://www.figma.com/api/mcp/asset/863718f8-1e70-4049-bcf5-dac7999417e9";
const ICON_CANDIDATE = "https://www.figma.com/api/mcp/asset/0811283c-95c2-4ebf-a13d-267e4f70bd66";

export default function GetStartedPage() {
  const router = useRouter();
  const { openSignIn } = useClerk();
  const [hovered, setHovered] = useState<"recruiter" | "candidate" | null>(null);
  const [candidateToast, setCandidateToast] = useState(false);

  const goToRecruiter = () => router.push("/hiring-center");
  const triggerRecruiterSignIn = () => openSignIn({ redirectUrl: "/hiring-center" });

  const handleCandidateClick = () => {
    setCandidateToast(true);
    setTimeout(() => setCandidateToast(false), 2500);
  };

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
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 720 }}>

        {/* Recruiter card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}>
        <SignedIn>
          <button
            onClick={goToRecruiter}
            onMouseEnter={() => setHovered("recruiter")}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: "white",
              border: hovered === "recruiter" ? "1px solid #0e3d27" : "1px solid transparent",
              borderRadius: 16,
              padding: 32,
              width: 324,
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
        </SignedIn>
        <SignedOut>
          <button
            onClick={triggerRecruiterSignIn}
            onMouseEnter={() => setHovered("recruiter")}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: "white",
              border: hovered === "recruiter" ? "1px solid #0e3d27" : "1px solid transparent",
              borderRadius: 16,
              padding: 32,
              width: 324,
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
        </SignedOut>
        </motion.div>

        {/* Candidate card — coming soon */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}>
        <button
          onClick={handleCandidateClick}
          onMouseEnter={() => setHovered("candidate")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: "white",
            border: hovered === "candidate" ? "1px solid #9ca3af" : "1px solid transparent",
            borderRadius: 16,
            padding: 32,
            width: 324,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            transition: "all 0.2s ease",
            textAlign: "center",
            position: "relative",
            opacity: 0.7,
          }}
        >
          <div style={{
            position: "absolute",
            top: 12,
            right: 14,
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: 99,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#6b7280",
            letterSpacing: "0.04em",
          }}>
            COMING SOON
          </div>
          <CandidateCardContent />
        </button>
        </motion.div>
      </div>

      {/* Toast */}
      {candidateToast && (
        <div style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#111827",
          color: "white",
          borderRadius: 10,
          padding: "12px 22px",
          fontSize: 14,
          fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          zIndex: 999,
          whiteSpace: "nowrap",
        }}>
          Candidate portal coming soon 🚀
        </div>
      )}

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
        marginTop: 8,
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
      <p style={{ fontSize: 16, fontWeight: 500, lineHeight: "24px", color: "#6b7280", margin: 0, maxWidth: 216 }}>
        Build your profile packet, discover matched roles, and track your applications
      </p>
    </>
  );
}

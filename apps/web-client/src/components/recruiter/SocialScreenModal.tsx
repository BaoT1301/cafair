"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X, Cpu } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */
type FindingKind = "verified" | "warning" | "critical" | "info";
type SocialPlatform = "facebook" | "linkedin" | "github" | "web";

interface SocialFinding {
  kind: FindingKind;
  category: string;
  title: string;
  detail: string;
  platform: SocialPlatform;
}

/* ─── Constants ──────────────────────────────────────────── */
// Drop your demo video path here to replace the browser placeholder
const SOCIAL_SCREEN_VIDEO_SRC = "";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook", linkedin: "LinkedIn", github: "GitHub", web: "Web Search",
};

const PLATFORM_URLS: Record<SocialPlatform, string> = {
  facebook: "https://www.facebook.com/stephen.nguyen.profile",
  linkedin: "https://www.linkedin.com/in/stephen-nguyen-tech",
  github: "https://github.com/snguyen-dev",
  web: "https://www.google.com/search?q=Stephen+Nguyen+Virginia+Tech+developer",
};

const PLATFORM_STATUS: Record<SocialPlatform, string[]> = {
  facebook: ["Verifying identity...", "Verifying education...", "Checking privacy settings..."],
  linkedin: ["Scanning LinkedIn...", "Cross-referencing endorsed skills...", "Checking work history consistency..."],
  github: ["Scanning GitHub...", "Analyzing contribution history...", "Checking code quality signals..."],
  web: ["Scanning web search...", "Checking for press mentions...", "Running final verification..."],
};

const PLATFORM_THRESHOLDS: Record<SocialPlatform, number> = {
  facebook: 6, linkedin: 11, github: 15, web: 18,
};

const PLATFORM_START: Record<SocialPlatform, number> = { facebook: 0, linkedin: 6, github: 11, web: 15 };
const SWITCH_POINTS = [6, 11, 15];

function getActivePlatform(count: number): SocialPlatform {
  if (count < 6)  return "facebook";
  if (count < 11) return "linkedin";
  if (count < 15) return "github";
  return "web";
}

const ALL_FINDINGS: SocialFinding[] = [
  // Facebook (0–5)
  { kind: "verified", category: "Identity",    title: "Profile name matches resume",    detail: '"Stephen Nguyen" — exact match with application name',                         platform: "facebook" },
  { kind: "verified", category: "Education",   title: "Education verified",             detail: "Virginia Tech — confirmed on profile (Aug 2023)",                             platform: "facebook" },
  { kind: "info",     category: "Employment",  title: "Current employer detected",      detail: "Marriott International · Jun 2025 · Present (7 months)",                     platform: "facebook" },
  { kind: "verified", category: "Network",     title: "Professional network size",      detail: "468 connections — reasonable network for early career",                       platform: "facebook" },
  { kind: "verified", category: "Activity",    title: "Tech community engagement",      detail: 'Shared CodeFest 2025 post — "AI & Tech for Human-Centered Travel"',          platform: "facebook" },
  { kind: "info",     category: "Personal",    title: "Profile is locked/private",      detail: "Limited public visibility — privacy-conscious (neutral signal)",             platform: "facebook" },
  // LinkedIn (6–10)
  { kind: "verified", category: "Experience",      title: "Work history consistent",    detail: "3 roles in hospitality tech — progressive responsibility",                   platform: "linkedin" },
  { kind: "verified", category: "Skills",          title: "Endorsed skills match JD",   detail: "React, TypeScript, AWS, Python — 12/15 required skills present",            platform: "linkedin" },
  { kind: "verified", category: "Education",       title: "Degree confirmed",           detail: "B.S. Computer Science, Virginia Tech — Pamplin College",                    platform: "linkedin" },
  { kind: "warning",  category: "Tenure",          title: "Short tenure detected",      detail: "Average 8 months per role — possible job-hopping pattern",                  platform: "linkedin" },
  { kind: "verified", category: "Recommendations", title: "Strong recommendations",     detail: "4 recommendations from managers and colleagues",                             platform: "linkedin" },
  // GitHub (11–14)
  { kind: "verified", category: "Activity",   title: "Active contributor",             detail: "847 contributions in last year — consistent commit history",                 platform: "github" },
  { kind: "verified", category: "Projects",   title: "Relevant open source work",      detail: "Maintained 3 React component libraries (120+ stars total)",                 platform: "github" },
  { kind: "info",     category: "Languages",  title: "Top languages detected",         detail: "TypeScript (42%), Python (28%), JavaScript (18%), Go (12%)",                platform: "github" },
  { kind: "verified", category: "Code",       title: "Clean code practices",           detail: "Consistent PR reviews, comprehensive README docs, CI/CD configs",           platform: "github" },
  // Web Search (15–17)
  { kind: "verified", category: "Publications", title: "Conference talk found",        detail: '"Building Scalable React Apps" — VT HackNight 2024',                        platform: "web" },
  { kind: "verified", category: "Awards",       title: "Hackathon winner",             detail: "1st place at HokieHacks 2023 — AI travel recommendation engine",            platform: "web" },
  { kind: "info",     category: "Media",        title: "No negative press",            detail: "No concerning news articles or public controversies found",                 platform: "web" },
];

/* ─── FindingCard ────────────────────────────────────────── */
function FindingCard({ finding, index = 0 }: { finding: SocialFinding; index?: number }) {
  const cfg: Record<FindingKind, { bg: string; border: string; badge: string; badgeText: string; iconBg: string; icon: React.ReactNode }> = {
    verified: { bg: "#f0faf4", border: "#bbf7d0", badge: "#dcfce7", badgeText: "#15803d", iconBg: "#16a34a", icon: <Check className="w-2.5 h-2.5 text-white" /> },
    warning:  { bg: "#fffbeb", border: "#fde68a", badge: "#fef3c7", badgeText: "#b45309", iconBg: "#d97706", icon: <AlertTriangle className="w-2.5 h-2.5 text-white" /> },
    critical: { bg: "#fef2f2", border: "#fecaca", badge: "#fee2e2", badgeText: "#dc2626", iconBg: "#dc2626", icon: <X className="w-2.5 h-2.5 text-white" /> },
    info:     { bg: "#eff6ff", border: "#bfdbfe", badge: "#dbeafe", badgeText: "#1d4ed8", iconBg: "#2563eb", icon: <div className="w-2 h-2 rounded-full bg-white" /> },
  };
  const c = cfg[finding.kind];
  return (
    <div
      className="rounded-[10px] p-3 border"
      style={{
        background: c.bg,
        borderColor: c.border,
        animation: `ssFindingIn 0.38s cubic-bezier(0.22,1,0.36,1) ${Math.min(index * 0.045, 0.25)}s both`,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: c.iconBg }}>
          {c.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[3px]" style={{ background: c.badge, color: c.badgeText }}>
              {finding.kind.toUpperCase()}
            </span>
            <span className="text-[9px] text-[#9ca3af]">{finding.category}</span>
          </div>
          <p className="text-[12px] font-semibold text-[#111827] leading-[16px]">{finding.title}</p>
          <p className="text-[11px] text-[#6b7280] leading-[15px] mt-0.5">{finding.detail}</p>
          <p className="text-[9px] text-[#9ca3af] mt-1">{PLATFORM_LABELS[finding.platform]}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── BrowserPlaceholder ─────────────────────────────────── */
function BrowserPlaceholder({ platform, statusText }: { platform: SocialPlatform; statusText: string }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#0f0f1a" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "#2a2a3e" }}>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#1f6b43] border-t-transparent animate-spin" />
          <span className="text-[11px] text-[#9ca3af]">{statusText}</span>
        </div>
        <span className="text-[10px] font-semibold text-green-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          LIVE CAPTURE
        </span>
      </div>
      <div className="px-4 py-2 border-b" style={{ borderColor: "#2a2a3e" }}>
        <div className="flex items-center gap-2 rounded-[6px] px-3 py-1.5" style={{ background: "#1a1a2e" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a3e]" />
          <span className="text-[11px] text-[#9ca3af] font-mono truncate">{PLATFORM_URLS[platform]}</span>
        </div>
      </div>
      <div className="flex-1 p-5 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-16 h-16 rounded-full bg-[#2a2a3e] animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 bg-[#2a2a3e] rounded animate-pulse" />
            <div className="h-3 w-28 bg-[#2a2a3e] rounded animate-pulse" />
            <div className="h-3 w-20 bg-[#2a2a3e] rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 mb-5">
          <div className="h-3 w-full bg-[#2a2a3e] rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-[#2a2a3e] rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-[#2a2a3e] rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-[#2a2a3e] rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-[#2a2a3e] rounded animate-pulse" />
        </div>
        <div className="absolute bottom-6 right-6 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0e3d27] animate-ping" />
          <span className="text-[10px] font-bold text-white bg-[#0e3d27] px-2 py-0.5 rounded-[4px]">Nova Act</span>
        </div>
      </div>
    </div>
  );
}

/* ─── SocialIntelligenceReport ───────────────────────────── */
function SocialIntelligenceReport({
  candidateName, verifiedCount, warningCount, criticalCount, infoCount, onClose,
}: {
  candidateName: string;
  verifiedCount: number; warningCount: number; criticalCount: number; infoCount: number;
  onClose: () => void;
}) {
  const platforms: SocialPlatform[] = ["facebook", "linkedin", "github", "web"];
  const kindIcon: Record<FindingKind, React.ReactNode> = {
    verified: <Check className="w-3.5 h-3.5 shrink-0 text-[#16a34a]" />,
    warning:  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#d97706]" />,
    critical: <X className="w-3.5 h-3.5 shrink-0 text-[#dc2626]" />,
    info:     <div className="w-3 h-3 rounded-full shrink-0 bg-[#2563eb]" />,
  };
  const firstName = candidateName.split(" ")[0];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4" style={{ background: "#f9fafb" }}>
      <div className="text-center pb-1">
        <div className="w-11 h-11 rounded-full bg-[#16a34a] flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-[20px] font-bold text-[#111827]">Social Intelligence Report</h2>
        <p className="text-[12px] text-[#6b7280] mt-0.5">{candidateName} · Scanned 4 platforms · {ALL_FINDINGS.length} findings</p>
      </div>

      <div className="bg-white rounded-[14px] p-4 border border-[#e5e7eb]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[#111827]">Overall Social Score</p>
          <span className="text-[17px] font-bold text-[#16a34a] border border-[#bbf7d0] bg-[#f0faf4] px-3 py-0.5 rounded-[8px]">87/100</span>
        </div>
        <div className="flex items-center justify-around">
          {[
            { count: verifiedCount, label: "Verified",  color: "#16a34a" },
            { count: warningCount,  label: "Warnings",  color: "#d97706" },
            { count: criticalCount, label: "Critical",  color: "#dc2626" },
            { count: infoCount,     label: "Info",      color: "#2563eb" },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-[22px] font-bold tabular-nums" style={{ color: item.color }}>{item.count}</span>
              <span className="text-[10px] text-[#6b7280]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[14px] p-4">
        <p className="text-[10px] font-bold text-[#15803d] tracking-wider mb-2">✦ AI RECOMMENDATION</p>
        <p className="text-[12px] text-[#15803d] leading-relaxed">
          {firstName}&apos;s social presence is <strong>strong and consistent</strong> with their application.
          Education and employment are verified across platforms. Active tech community engagement (GitHub
          contributions, hackathon wins) is a positive signal. One minor flag on tenure duration.{" "}
          <strong>Recommendation: Proceed to interview with high confidence.</strong>
        </p>
      </div>

      {platforms.map((p) => {
        const findings = ALL_FINDINGS.filter(f => f.platform === p);
        return (
          <div key={p} className="bg-white rounded-[14px] p-4 border border-[#e5e7eb]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-[#111827]">{PLATFORM_LABELS[p]}</p>
              <span className="text-[11px] text-[#6b7280]">{findings.length} findings</span>
            </div>
            <div className="space-y-2">
              {findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5">{kindIcon[f.kind]}</span>
                  <p className="text-[12px] text-[#111827] leading-relaxed">
                    <span className="font-semibold">{f.title}</span>
                    <span className="text-[#6b7280]"> — {f.detail}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-1 pb-2">
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-[10px] text-[13px] font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
        >
          <Check className="w-4 h-4" />
          Add Report to Candidate File
        </button>
        <button className="h-10 px-4 rounded-[10px] border border-[#e5e7eb] text-[13px] font-medium text-[#4b5563] hover:bg-[#f3f4f6] transition-colors">
          Re-scan
        </button>
      </div>
    </div>
  );
}

/* ─── SocialScreenModal (exported) ──────────────────────── */
export function SocialScreenModal({ candidateName, onClose }: { candidateName: string; onClose: () => void }) {
  const total = ALL_FINDINGS.length;
  const [revealedCount, setRevealedCount] = useState(0);
  const [phase, setPhase] = useState<"scanning" | "report">("scanning");
  const [statusIdx, setStatusIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // Lock background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = "";
    };
  }, []);

  const activePlatform = getActivePlatform(revealedCount);
  const platforms: SocialPlatform[] = ["facebook", "linkedin", "github", "web"];
  const progress = phase === "report" ? 100 : Math.round((revealedCount / total) * 100);
  const statusText = PLATFORM_STATUS[activePlatform][statusIdx % PLATFORM_STATUS[activePlatform].length];

  useEffect(() => {
    if (!SWITCH_POINTS.includes(revealedCount) || phase !== "scanning") return;
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 650);
    return () => clearTimeout(t);
  }, [revealedCount, phase]);

  useEffect(() => {
    if (phase !== "scanning" || transitioning) return;
    if (revealedCount >= total) {
      const t = setTimeout(() => setPhase("report"), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealedCount(c => c + 1), 780);
    return () => clearTimeout(t);
  }, [revealedCount, phase, total, transitioning]);

  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => setStatusIdx(i => i + 1), 1800);
    return () => clearInterval(t);
  }, [phase, activePlatform]);

  const revealed = ALL_FINDINGS.slice(0, revealedCount);
  const verifiedCount = revealed.filter(f => f.kind === "verified").length;
  const warningCount  = revealed.filter(f => f.kind === "warning").length;
  const criticalCount = revealed.filter(f => f.kind === "critical").length;
  const infoCount     = revealed.filter(f => f.kind === "info").length;

  const panelFindings = phase === "report"
    ? ALL_FINDINGS
    : ALL_FINDINGS.slice(PLATFORM_START[activePlatform], revealedCount);

  return (
    <>
      <style>{`
        @keyframes ssFindingIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ssFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ssPlatformIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "rgba(0,0,0,0.80)" }}
        onWheel={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        <motion.div
          className="w-full max-w-[1080px] flex flex-col rounded-[16px] overflow-hidden shadow-2xl"
          style={{ background: "#13131f", height: "min(88vh, 680px)" }}
          initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-4 px-5 py-3 border-b shrink-0" style={{ borderColor: "#2a2a3e" }}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#0e3d27] flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white leading-none">Nova Act Social Intelligence Agent</p>
                <p className="text-[10px] text-[#9ca3af] leading-none mt-0.5">Scanning {candidateName} across 4 platforms</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mx-auto">
              {platforms.map((p) => {
                const isDone = phase === "report" || revealedCount >= PLATFORM_THRESHOLDS[p];
                const isActive = phase === "scanning" && activePlatform === p;
                return (
                  <div
                    key={p}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium"
                    style={{
                      background: isDone ? "#16a34a" : isActive ? "#0e3d27" : "#2a2a3e",
                      color: isDone || isActive ? "#fff" : "#6b7280",
                      transition: "background 0.4s ease, color 0.4s ease",
                    }}
                  >
                    {isDone && <Check className="w-2.5 h-2.5" />}
                    {PLATFORM_LABELS[p]}
                  </div>
                );
              })}
              {phase === "report" && (
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-white text-[#111827]"
                  style={{ animation: "ssPlatformIn 0.35s ease-out" }}
                >
                  ✦ Summary
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {phase === "scanning" ? (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold tracking-widest text-[#6b7280]">SCANNING</span>
                  <div className="w-28 h-1.5 rounded-full overflow-hidden bg-[#2a2a3e]">
                    <div
                      className="h-full bg-[#0e3d27] rounded-full"
                      style={{ width: `${progress}%`, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-white tabular-nums w-8">{progress}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5" style={{ animation: "ssFadeIn 0.4s ease-out" }}>
                  <div className="w-4 h-4 rounded-full bg-[#16a34a] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#16a34a]">COMPLETE</span>
                </div>
              )}
              <button onClick={onClose} className="text-[#4b5563] hover:text-white transition-colors ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel */}
            <div className="flex-1 min-w-0 border-r" style={{ borderColor: "#2a2a3e", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {phase === "scanning" ? (
                SOCIAL_SCREEN_VIDEO_SRC ? (
                  <video src={SOCIAL_SCREEN_VIDEO_SRC} autoPlay muted className="w-full h-full object-cover" />
                ) : (
                  <BrowserPlaceholder platform={activePlatform} statusText={statusText} />
                )
              ) : (
                <SocialIntelligenceReport
                  candidateName={candidateName}
                  verifiedCount={verifiedCount}
                  warningCount={warningCount}
                  criticalCount={criticalCount}
                  infoCount={infoCount}
                  onClose={onClose}
                />
              )}
            </div>

            {/* Right panel */}
            <div className="w-[272px] shrink-0 flex flex-col" style={{ background: "#13131f" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "#2a2a3e" }}>
                <div>
                  <p className="text-[13px] font-bold text-white leading-none">Live Findings</p>
                  {phase === "scanning" && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#6b7280", animation: "ssFadeIn 0.3s ease-out" }} key={activePlatform}>
                      {PLATFORM_LABELS[activePlatform]}
                    </p>
                  )}
                </div>
                <span
                  className="text-[11px] font-bold text-white rounded-full w-6 h-6 flex items-center justify-center tabular-nums"
                  style={{ background: "#0e3d27" }}
                >
                  {phase === "report" ? total : panelFindings.length}
                </span>
              </div>
              <div className="flex items-center gap-4 px-4 py-2 border-b shrink-0" style={{ borderColor: "#2a2a3e" }}>
                {[
                  { count: verifiedCount, color: "#16a34a", icon: <Check className="w-2.5 h-2.5" /> },
                  { count: warningCount,  color: "#d97706", icon: <AlertTriangle className="w-2.5 h-2.5" /> },
                  { count: criticalCount, color: "#dc2626", icon: <X className="w-2.5 h-2.5" /> },
                  { count: infoCount,     color: "#2563eb", icon: <div className="w-2 h-2 rounded-full bg-current" /> },
                ].map((item, i) => (
                  <span key={i} className="flex items-center gap-1 text-[12px] font-bold" style={{ color: item.color }}>
                    {item.icon}{item.count}
                  </span>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2" key={phase === "report" ? "report" : activePlatform}>
                {transitioning ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2.5" style={{ animation: "ssFadeIn 0.25s ease-out" }}>
                    <div className="w-5 h-5 rounded-full border-2 border-[#1f6b43] border-t-transparent animate-spin" />
                    <p className="text-[11px] text-[#6b7280] text-center leading-relaxed">
                      Switching to<br />
                      <span className="text-white font-medium">{PLATFORM_LABELS[activePlatform]}</span>
                    </p>
                  </div>
                ) : (
                  panelFindings.map((f, i) => (
                    <FindingCard key={`${f.platform}-${f.title}`} finding={f} index={i} />
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

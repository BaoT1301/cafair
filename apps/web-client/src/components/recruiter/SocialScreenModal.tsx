"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X, Cpu } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */
type FindingKind = "verified" | "warning" | "critical" | "info";
type SocialPlatform = "linkedin" | "github" | "web";
type ScanStep = "init" | SocialPlatform | "thinking";

interface SocialFinding {
  kind: FindingKind;
  category: string;
  title: string;
  detail: string;
  platform: SocialPlatform;
}

/* ─── Constants ──────────────────────────────────────────── */
const SOCIAL_SCREEN_VIDEO_SRC = "/videos/ce94b33d-84b5-47a1-b1c7-93ad88d19e9e.mp4";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  web: "Portfolio",
};

// Actual URLs visible in the video
const PLATFORM_URLS: Record<SocialPlatform, string> = {
  linkedin: "https://www.linkedin.com/in/nguyenpn1/",
  github: "https://github.com/ngstephen1",
  web: "https://lamanhtruong.com",
};

const PLATFORM_STATUS: Record<SocialPlatform, string[]> = {
  linkedin: ["Scanning LinkedIn profile...", "Checking work history...", "Verifying endorsed skills..."],
  github: ["Scanning GitHub repositories...", "Analyzing contribution activity...", "Checking code quality signals..."],
  web: ["Scanning portfolio website...", "Extracting resume data...", "Verifying project credentials..."],
};

// Video phase boundaries (seconds) — matched to actual video timestamps
const PHASE_START: Record<ScanStep, number> = {
  init:     0,
  linkedin: 8,
  github:   24,
  web:      34,
  thinking: 52,
};

function getScanStep(t: number): ScanStep {
  if (t < 8)  return "init";
  if (t < 24) return "linkedin";
  if (t < 34) return "github";
  if (t < 52) return "web";
  return "thinking";
}

// 14 findings tied to exact video timestamps
// Data sourced directly from what the agent captures in the recording
const VIDEO_TIMELINE: { at: number; finding: SocialFinding }[] = [
  // ── LinkedIn (8s–23s) ──────────────────────────────────────
  {
    at: 9,
    finding: {
      kind: "verified", category: "Identity", platform: "linkedin",
      title: "Profile name matches candidate record",
      detail: '"Nguyen Phan Nguyen" — linkedin.com/in/nguyenpn1 confirmed',
    },
  },
  {
    at: 12,
    finding: {
      kind: "verified", category: "Employment", platform: "linkedin",
      title: "Current employer at Marriott International",
      detail: "Software Engineer role active — consistent with application",
    },
  },
  {
    at: 15,
    finding: {
      kind: "verified", category: "Education", platform: "linkedin",
      title: "Virginia Tech enrollment confirmed",
      detail: "Virginia Tech undergraduate — ICLR 2026, SHPE 2025, TEDx Speaker listed",
    },
  },
  {
    at: 19,
    finding: {
      kind: "info", category: "Status", platform: "linkedin",
      title: "Actively seeking new opportunities",
      detail: "Open to Work: Data Science Intern & AI Intern roles — job-searching signal",
    },
  },
  {
    at: 22,
    finding: {
      kind: "verified", category: "Skills", platform: "linkedin",
      title: "Technical skills aligned to role",
      detail: "Data Analytics, Cloud Applications, Search Engine Technology endorsed by peers",
    },
  },
  // ── GitHub (24s–33s) ───────────────────────────────────────
  {
    at: 25,
    finding: {
      kind: "verified", category: "Profile", platform: "github",
      title: "GitHub profile verified",
      detail: "ngstephen1 (Stephen Nguyen) — Virginia Tech '27, Data Science / Future AI Musician",
    },
  },
  {
    at: 27,
    finding: {
      kind: "verified", category: "Repos", platform: "github",
      title: "20 public repositories confirmed",
      detail: "openclaw (TypeScript, MIT License) — updated 3 days ago · 20 stars",
    },
  },
  {
    at: 30,
    finding: {
      kind: "verified", category: "Projects", platform: "github",
      title: "AI-Hire-AI project contribution found",
      detail: "Forked from anhlamtruong/cafair — TypeScript, actively maintained, 1 star",
    },
  },
  {
    at: 33,
    finding: {
      kind: "info", category: "Network", platform: "github",
      title: "Developer network consistent with seniority",
      detail: "16 followers · 34 following — early-career presence expected for Virginia Tech '27",
    },
  },
  // ── Portfolio / Web (34s–51s) ──────────────────────────────
  // 34s: About page → website confirmed
  {
    at: 35,
    finding: {
      kind: "verified", category: "Portfolio", platform: "web",
      title: "Personal website live and indexed",
      detail: "lamanhtruong.com — React, Next.js, TypeScript, AWS, Python stack confirmed",
    },
  },
  // 37s: Projects page → AI projects visible
  {
    at: 38,
    finding: {
      kind: "verified", category: "Projects", platform: "web",
      title: "Production AI projects shipped",
      detail: "Crushie (Azure OpenAI, ElevenLabs) · FinHack Finance (Gemini, Claude 3.7) — AI-native builder",
    },
  },
  // 44s: Resume PDF → education + experience + location
  {
    at: 44,
    finding: {
      kind: "verified", category: "Education", platform: "web",
      title: "Advanced degree in progress",
      detail: "George Mason University M.S. CS (Jan 2026–Jun 2027) · Cal State East Bay B.S. CS, 3.5 GPA",
    },
  },
  {
    at: 47,
    finding: {
      kind: "verified", category: "Experience", platform: "web",
      title: "Strong full-stack work history",
      detail: "Bay Atlantic (Software Data Eng) · OpenKnect (Full Stack Dev) · STEM Lab (C++ Tutor)",
    },
  },
  {
    at: 50,
    finding: {
      kind: "warning", category: "Location", platform: "web",
      title: "Location may require relocation discussion",
      detail: "Currently based in San Francisco, CA — confirm candidate relocation willingness",
    },
  },
];

// Agent thinking log: lines revealed progressively after the 52s mark
const THINKING_LOG: { delay: number; text: string; done: boolean }[] = [
  { delay: 0.6,  done: true,  text: "LinkedIn — 5 signals captured" },
  { delay: 1.4,  done: true,  text: "GitHub — 4 signals captured" },
  { delay: 2.2,  done: true,  text: "Portfolio — 5 signals captured" },
  { delay: 4.0,  done: false, text: "Cross-referencing identity across platforms..." },
  { delay: 7.5,  done: false, text: "Scoring against role requirements..." },
  { delay: 12.0, done: false, text: "Calculating risk profile..." },
  { delay: 18.0, done: false, text: "Generating AI recommendation..." },
  { delay: 25.0, done: true,  text: "Analysis complete — report ready" },
];

// Flat mock findings for fallback (no video) and report phase
const ALL_MOCK_FINDINGS: SocialFinding[] = VIDEO_TIMELINE.map((e) => e.finding);

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

/* ─── BrowserPlaceholder (fallback — no video) ───────────── */
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
          {[null, "4/5", "3/4", "full"].map((w, i) => (
            <div key={i} className="h-3 bg-[#2a2a3e] rounded animate-pulse" style={{ width: w ?? "100%" }} />
          ))}
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
  candidateName, findings, fitScore, summary, onClose,
}: {
  candidateName: string;
  findings: SocialFinding[];
  fitScore: number;
  summary: string | null;
  onClose: () => void;
}) {
  const platforms: SocialPlatform[] = ["linkedin", "github", "web"];
  const kindIcon: Record<FindingKind, React.ReactNode> = {
    verified: <Check className="w-3.5 h-3.5 shrink-0 text-[#16a34a]" />,
    warning:  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#d97706]" />,
    critical: <X className="w-3.5 h-3.5 shrink-0 text-[#dc2626]" />,
    info:     <div className="w-3 h-3 rounded-full shrink-0 bg-[#2563eb]" />,
  };
  const firstName = candidateName.split(" ")[0];
  const verifiedCount = findings.filter(f => f.kind === "verified").length;
  const warningCount  = findings.filter(f => f.kind === "warning").length;
  const criticalCount = findings.filter(f => f.kind === "critical").length;
  const infoCount     = findings.filter(f => f.kind === "info").length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4" style={{ background: "#f9fafb" }}>
      <div className="text-center pb-1">
        <div className="w-11 h-11 rounded-full bg-[#16a34a] flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-[20px] font-bold text-[#111827]">Social Intelligence Report</h2>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          {candidateName} · Scanned 3 platforms · {findings.length} findings
        </p>
      </div>

      <div className="bg-white rounded-[14px] p-4 border border-[#e5e7eb]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[#111827]">Overall Social Score</p>
          <span className="text-[17px] font-bold text-[#16a34a] border border-[#bbf7d0] bg-[#f0faf4] px-3 py-0.5 rounded-[8px]">
            {fitScore}/100
          </span>
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
          {summary ?? (
            <>
              {firstName}&apos;s social presence is <strong>strong and consistent</strong> with their application.
              Education and employment verified across LinkedIn, GitHub, and portfolio. Active AI project contributions
              and strong skills alignment. One location flag to verify.{" "}
              <strong>Recommendation: Proceed to interview with high confidence.</strong>
            </>
          )}
        </p>
      </div>

      {platforms.map((p) => {
        const pFindings = findings.filter(f => f.platform === p);
        if (pFindings.length === 0) return null;
        return (
          <div key={p} className="bg-white rounded-[14px] p-4 border border-[#e5e7eb]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-[#111827]">{PLATFORM_LABELS[p]}</p>
              <span className="text-[11px] text-[#6b7280]">{pFindings.length} findings</span>
            </div>
            <div className="space-y-2">
              {pFindings.map((f, i) => (
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
export function SocialScreenModal({
  candidateName,
  candidateId,
  resumeText,
  roleTitle,
  school,
  onClose,
}: {
  candidateName: string;
  candidateId?: string;
  resumeText?: string;
  roleTitle?: string;
  school?: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"scanning" | "report">("scanning");
  const [currentStep, setCurrentStep] = useState<ScanStep>("init");
  const [transitioning, setTransitioning] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);

  // Video-driven state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(132);
  const [revealedCount, setRevealedCount] = useState(0); // how many VIDEO_TIMELINE entries to show
  const prevRevealCount = useRef(0);
  const prevStep = useRef<ScanStep>("init");

  // SSE state — real AI findings streamed in background
  const [sseFindings, setSseFindings] = useState<SocialFinding[]>([]);
  const [sseLogs, setSseLogs] = useState<string[]>([]);
  const [sseLogRevealIdx, setSseLogRevealIdx] = useState(0);
  const [realSummary, setRealSummary] = useState<string | null>(null);
  const [realFitScore, setRealFitScore] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const sseClosedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sseClosedRef.current = true;
      esRef.current?.close();
    };
  }, []);

  // Start SSE social screen in background (demo mode — pre-recorded run)
  useEffect(() => {
    sseClosedRef.current = false;

    async function startSSE() {
      try {
        const res = await fetch("/api/aihire/social-screen/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateLabel: candidateName || "Demo Candidate", mode: "demo" }),
        });
        if (!res.ok) return;
        const data = await res.json() as { ok: boolean; streamUrl?: string; reportUrl?: string };
        if (!data.ok || !data.streamUrl) return;
        if (sseClosedRef.current) return;

        const es = new EventSource(data.streamUrl);
        esRef.current = es;

        es.addEventListener("finding", (evt: MessageEvent) => {
          try {
            const parsed = JSON.parse(evt.data as string) as {
              stage?: string;
              data?: { severity?: string; title?: string; text?: string; citations?: string[] };
            };
            const sev = (parsed.data?.severity ?? "info").toLowerCase();
            const kind: FindingKind =
              sev === "warning" ? "warning"
              : sev === "critical" ? "critical"
              : sev === "info" ? "info"
              : "verified";
            const stage = (parsed.stage ?? "web").toLowerCase();
            const platform: SocialPlatform =
              stage === "linkedin" ? "linkedin"
              : stage === "github" ? "github"
              : "web";
            const finding: SocialFinding = {
              kind,
              category: PLATFORM_LABELS[platform],
              title: parsed.data?.title ?? parsed.data?.text ?? "Signal detected",
              detail: (parsed.data?.citations ?? []).join(" · ") || "Details captured by agent",
              platform,
            };
            setSseFindings(prev => [...prev, finding]);
          } catch { /* skip malformed event */ }
        });

        es.addEventListener("status", (evt: MessageEvent) => {
          try {
            const parsed = JSON.parse(evt.data as string) as { message?: string };
            if (typeof parsed.message === "string" && parsed.message.trim()) {
              setSseLogs(prev => [...prev, parsed.message!.trim()]);
            }
          } catch { /* skip */ }
        });

        es.addEventListener("done", (evt: MessageEvent) => {
          try {
            const parsed = JSON.parse(evt.data as string) as {
              data?: { risk?: string; recommendation?: string; flags?: string[] };
            };
            if (parsed.data?.recommendation) setRealSummary(parsed.data.recommendation);
          } catch { /* skip */ }
          es.close();
          // Fetch report for fitScore
          if (data.reportUrl) {
            void fetch(data.reportUrl)
              .then(r => r.json())
              .then((report: { ok?: boolean; report?: { fitScore?: number; score?: number } }) => {
                const score = report.report?.fitScore ?? report.report?.score;
                if (typeof score === "number") setRealFitScore(score);
              })
              .catch(() => { /* fall back to default */ });
          }
        });

        es.onerror = () => { es.close(); };
      } catch { /* fall back to hardcoded data */ }
    }

    void startSSE();
    return () => { sseClosedRef.current = true; esRef.current?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateName]);

  // Progressively reveal SSE logs during thinking phase (~2.2s per line)
  useEffect(() => {
    if (currentStep !== "thinking") return;
    if (sseLogRevealIdx >= sseLogs.length) return;
    const t = setTimeout(() => setSseLogRevealIdx(i => i + 1), 2200);
    return () => clearTimeout(t);
  }, [currentStep, sseLogRevealIdx, sseLogs.length]);

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

  // Status text rotator
  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => setStatusIdx(i => i + 1), 1800);
    return () => clearInterval(t);
  }, [phase]);

  // Video timeupdate → drive all scanning state
  function handleTimeUpdate() {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    const dur = vid.duration;
    if (dur && !isNaN(dur) && dur !== videoDuration) setVideoDuration(dur);
    setVideoTime(t);

    // Reveal findings as timestamps pass — always driven by VIDEO_TIMELINE for reliable timing
    const newCount = VIDEO_TIMELINE.filter(e => e.at <= t).length;
    if (newCount !== prevRevealCount.current) {
      prevRevealCount.current = newCount;
      setRevealedCount(newCount);
    }

    // Detect phase transitions
    const newStep = getScanStep(t);
    if (newStep !== prevStep.current) {
      prevStep.current = newStep;
      setCurrentStep(newStep);
      if (newStep === "linkedin" || newStep === "github" || newStep === "web") {
        setTransitioning(true);
        setTimeout(() => setTransitioning(false), 650);
      }
      if (newStep === "thinking") {
        setSseLogRevealIdx(0);
      }
    }
  }

  function handleVideoEnded() {
    setRevealedCount(VIDEO_TIMELINE.length);
    setTimeout(() => setPhase("report"), 1000);
  }

  // Fallback timer (no video)
  useEffect(() => {
    if (SOCIAL_SCREEN_VIDEO_SRC || phase !== "scanning") return;
    if (revealedCount >= ALL_MOCK_FINDINGS.length) {
      const t = setTimeout(() => setPhase("report"), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealedCount(c => c + 1), 780);
    return () => clearTimeout(t);
  }, [revealedCount, phase]);

  // Derived display values
  const activePlatform: SocialPlatform | null =
    currentStep === "linkedin" || currentStep === "github" || currentStep === "web"
      ? currentStep
      : null;

  const platforms: SocialPlatform[] = ["linkedin", "github", "web"];
  const progress = phase === "report"
    ? 100
    : SOCIAL_SCREEN_VIDEO_SRC
      ? Math.round((videoTime / videoDuration) * 100)
      : Math.round((revealedCount / ALL_MOCK_FINDINGS.length) * 100);

  const statusText = activePlatform
    ? PLATFORM_STATUS[activePlatform][statusIdx % PLATFORM_STATUS[activePlatform].length]
    : "Initializing social intelligence scan...";

  // Build revealed findings: timing from VIDEO_TIMELINE, content from SSE when available
  const revealedFindings: SocialFinding[] = (() => {
    const slots = VIDEO_TIMELINE.slice(0, revealedCount);
    if (sseFindings.length === 0) return slots.map(e => e.finding);
    const byPlatform: Record<SocialPlatform, SocialFinding[]> = {
      linkedin: sseFindings.filter(f => f.platform === "linkedin"),
      github:   sseFindings.filter(f => f.platform === "github"),
      web:      sseFindings.filter(f => f.platform === "web"),
    };
    const platformIdx: Record<SocialPlatform, number> = { linkedin: 0, github: 0, web: 0 };
    return slots.map(({ finding: template }) => {
      const p = template.platform;
      const pArr = byPlatform[p];
      const idx = platformIdx[p]++;
      return idx < pArr.length ? pArr[idx] : template;
    });
  })();

  // Right panel findings: current platform only during active scan; all during thinking/report
  const panelFindings =
    phase === "report" ? revealedFindings
    : currentStep === "thinking" ? revealedFindings
    : activePlatform ? revealedFindings.filter(f => f.platform === activePlatform)
    : [];

  const verifiedCount = revealedFindings.filter(f => f.kind === "verified").length;
  const warningCount  = revealedFindings.filter(f => f.kind === "warning").length;
  const criticalCount = revealedFindings.filter(f => f.kind === "critical").length;
  const infoCount     = revealedFindings.filter(f => f.kind === "info").length;

  // Platform tab done state
  function isPlatformDone(p: SocialPlatform): boolean {
    if (phase === "report") return true;
    const endTimes: Record<SocialPlatform, number> = { linkedin: 24, github: 34, web: 52 };
    return SOCIAL_SCREEN_VIDEO_SRC ? videoTime >= endTimes[p] : revealedFindings.some(f => f.platform === p);
  }

  // Report findings: real SSE findings if available, else mock
  const reportFindings: SocialFinding[] = sseFindings.length > 0 ? sseFindings : ALL_MOCK_FINDINGS;

  return (
    <>
      <style>{`
        @keyframes ssFindingIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ssFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ssPlatformIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes ssThinkLine { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
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
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          {/* ── Title bar ───────────────────────────────────── */}
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
                <p className="text-[10px] text-[#9ca3af] leading-none mt-0.5">Scanning {candidateName} across 3 platforms</p>
              </div>
            </div>

            {/* Platform tabs */}
            <div className="flex items-center gap-1.5 mx-auto">
              {platforms.map((p) => {
                const done = isPlatformDone(p);
                const isActive = phase === "scanning" && activePlatform === p;
                return (
                  <div
                    key={p}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium"
                    style={{
                      background: done ? "#16a34a" : isActive ? "#0e3d27" : "#2a2a3e",
                      color: done || isActive ? "#fff" : "#6b7280",
                      transition: "background 0.4s ease, color 0.4s ease",
                    }}
                  >
                    {done && <Check className="w-2.5 h-2.5" />}
                    {PLATFORM_LABELS[p]}
                  </div>
                );
              })}
              {phase === "scanning" && currentStep === "thinking" && (
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium"
                  style={{ background: "#1a1a2e", color: "#4ade80", border: "1px solid #166534", animation: "ssPlatformIn 0.35s ease-out" }}
                >
                  <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse shrink-0" />
                  Analyzing
                </div>
              )}
              {phase === "report" && (
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-white text-[#111827]"
                  style={{ animation: "ssPlatformIn 0.35s ease-out" }}
                >
                  ✦ Report Ready
                </div>
              )}
            </div>

            {/* Progress / complete */}
            <div className="flex items-center gap-3 shrink-0">
              {phase === "scanning" ? (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold tracking-widest text-[#6b7280]">
                    {currentStep === "thinking" ? "ANALYZING" : "SCANNING"}
                  </span>
                  <div className="w-28 h-1.5 rounded-full overflow-hidden bg-[#2a2a3e]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: currentStep === "thinking" ? "#4ade80" : "#0e3d27",
                        transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                      }}
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

          {/* ── Body ─────────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel — video or report */}
            <div
              className="flex-1 min-w-0 border-r"
              style={{ borderColor: "#2a2a3e", overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              {phase === "scanning" ? (
                SOCIAL_SCREEN_VIDEO_SRC ? (
                  <video
                    ref={videoRef}
                    src={SOCIAL_SCREEN_VIDEO_SRC}
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onLoadedMetadata={() => {
                      const dur = videoRef.current?.duration;
                      if (dur && !isNaN(dur)) setVideoDuration(dur);
                    }}
                  />
                ) : (
                  activePlatform
                    ? <BrowserPlaceholder platform={activePlatform} statusText={statusText} />
                    : (
                      <div className="flex-1 flex items-center justify-center" style={{ background: "#0f0f1a" }}>
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-6 h-6 rounded-full border-2 border-[#1f6b43] border-t-transparent animate-spin" />
                          <p className="text-[12px] text-[#6b7280]">Connecting to agent...</p>
                        </div>
                      </div>
                    )
                )
              ) : (
                <SocialIntelligenceReport
                  candidateName={candidateName}
                  findings={reportFindings}
                  fitScore={realFitScore ?? 87}
                  summary={realSummary ?? null}
                  onClose={onClose}
                />
              )}
            </div>

            {/* Right panel — live findings */}
            <div className="w-[272px] shrink-0 flex flex-col" style={{ background: "#13131f" }}>
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "#2a2a3e" }}>
                <div>
                  <p className="text-[13px] font-bold text-white leading-none">Live Findings</p>
                  {phase === "scanning" && currentStep === "thinking" ? (
                    <p className="text-[10px] mt-0.5" style={{ color: "#4ade80", animation: "ssFadeIn 0.3s ease-out" }}>
                      Agent synthesizing...
                    </p>
                  ) : activePlatform ? (
                    <p className="text-[10px] mt-0.5" style={{ color: "#6b7280", animation: "ssFadeIn 0.3s ease-out" }} key={activePlatform}>
                      {PLATFORM_LABELS[activePlatform]}
                    </p>
                  ) : null}
                </div>
                <span
                  className="text-[11px] font-bold text-white rounded-full w-6 h-6 flex items-center justify-center tabular-nums"
                  style={{ background: "#0e3d27" }}
                >
                  {phase === "report" ? reportFindings.length : panelFindings.length}
                </span>
              </div>

              {/* Cumulative count badges */}
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

              {/* Panel content */}
              <div
                className="flex-1 overflow-y-auto p-3 space-y-2"
                key={`${phase}-${currentStep}`}
              >
                {phase === "scanning" && currentStep === "thinking" ? (
                  <>
                    {/* Agent synthesis log */}
                    <div
                      className="rounded-[10px] p-3 mb-1"
                      style={{ background: "#0d1f14", border: "1px solid #166534" }}
                    >
                      <p className="text-[9px] font-bold text-[#4ade80] tracking-wider mb-2">⚡ AGENT SYNTHESIS</p>
                      <div className="space-y-1.5">
                        {sseLogs.slice(0, sseLogRevealIdx).map((line, i) => (
                          <div key={i} className="flex items-center gap-2" style={{ animation: "ssThinkLine 0.3s ease-out" }}>
                            <Check className="w-3 h-3 text-[#4ade80] shrink-0" />
                            <p className="text-[11px] text-[#4ade80]">{line}</p>
                          </div>
                        ))}
                        {sseLogRevealIdx < sseLogs.length || sseLogs.length === 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-[#1f6b43] border-t-transparent animate-spin shrink-0" />
                            <p className="text-[11px] text-[#9ca3af]">Analyzing signals...</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {/* All findings summary */}
                    {revealedFindings.map((f, i) => (
                      <FindingCard key={`${f.platform}-${f.title}`} finding={f} index={i} />
                    ))}
                  </>
                ) : transitioning ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2.5" style={{ animation: "ssFadeIn 0.25s ease-out" }}>
                    <div className="w-5 h-5 rounded-full border-2 border-[#1f6b43] border-t-transparent animate-spin" />
                    <p className="text-[11px] text-[#6b7280] text-center leading-relaxed">
                      Switching to<br />
                      <span className="text-white font-medium">{activePlatform ? PLATFORM_LABELS[activePlatform] : ""}</span>
                    </p>
                  </div>
                ) : panelFindings.length === 0 && phase === "scanning" ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2.5">
                    <div className="w-5 h-5 rounded-full border-2 border-[#1f6b43] border-t-transparent animate-spin" />
                    <p className="text-[11px] text-[#6b7280] text-center leading-relaxed px-2">{statusText}</p>
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

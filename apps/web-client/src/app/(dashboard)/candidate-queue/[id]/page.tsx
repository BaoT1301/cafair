"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { SocialScreenModal } from "@/components/recruiter/SocialScreenModal";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Calendar,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Loader2,
  Circle,
  X,
  Video,
  StopCircle,
  ThumbsDown,
  ThumbsUp,
  Check,
  Cpu,
  Globe,
} from "lucide-react";

/* ─── Stage ordering ─────────────────────────────────────────── */
type StageKey = "fair" | "screen" | "interview" | "offer" | "day1";

const STAGE_ORDER: StageKey[] = ["fair", "screen", "interview", "offer", "day1"];
const STAGE_LABELS: Record<StageKey, string> = {
  fair: "Applied",
  screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  day1: "Day 1",
};

/* ─── Stage transition step definitions ──────────────────── */
const STAGE_MOVE_STEPS: Record<string, { label: string; detail: string }[]> = {
  screen: [
    { label: "Evaluating fit score", detail: "Comparing against role benchmarks" },
    { label: "Flagging risk indicators", detail: "Scanning resume for inconsistencies" },
    { label: "Generating screening checklist", detail: "Tailoring questions to candidate strengths" },
    { label: "Moving to Phone Screen", detail: "Pipeline stage updated" },
  ],
  interview: [
    { label: "Reviewing screening results", detail: "Validating communication and depth scores" },
    { label: "Checking calendar availability", detail: "Matching open interviewer windows" },
    { label: "Generating interview prep notes", detail: "Highlighting skills to probe" },
    { label: "Moving to Interview", detail: "Pipeline stage updated" },
  ],
  offer: [
    { label: "Analyzing interview performance", detail: "Reviewing panel feedback signals" },
    { label: "Benchmarking compensation", detail: "Aligning offer to role tier" },
    { label: "Preparing offer package", detail: "Drafting offer letter and terms" },
    { label: "Moving to Offer", detail: "Pipeline stage updated" },
  ],
  day1: [
    { label: "Confirming offer acceptance", detail: "Validating signed documents" },
    { label: "Provisioning system access", detail: "Setting up accounts and tools" },
    { label: "Notifying onboarding team", detail: "Sending first-day logistics" },
    { label: "Welcome aboard!", detail: "Day 1 preparations complete" },
  ],
  fair: [
    { label: "Resetting pipeline stage", detail: "Moving back to active queue" },
    { label: "Restoring recruiter visibility", detail: "Re-adding to fair board" },
    { label: "Stage reset", detail: "Candidate returned to queue" },
  ],
};

const STAGE_DISPLAY: Record<string, string> = {
  fair: "In Queue", screen: "Phone Screen", interview: "Interview", offer: "Offer", day1: "Day 1",
};

function ProcessingStepList({
  steps,
  activeStep,
  accent,
}: {
  steps: { label: string; detail: string }[];
  activeStep: number;
  accent: string;
}) {
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const done = i < activeStep;
        const active = i === activeStep;
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {done ? (
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accent }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              ) : active ? (
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: accent }}>
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: accent }} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-[#d1d5db]" />
              )}
            </div>
            <div className={`transition-opacity duration-300 ${active ? "opacity-100" : done ? "opacity-60" : "opacity-25"}`}>
              <p className="text-[13px] font-semibold text-[#111827]">{s.label}</p>
              {active && <p className="text-[11px] text-[#6b7280] mt-0.5 animate-pulse">{s.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageTransitionOverlay({
  targetStage,
  isDone,
  onClose,
}: {
  targetStage: string;
  isDone: boolean;
  onClose: () => void;
}) {
  const steps = STAGE_MOVE_STEPS[targetStage] ?? STAGE_MOVE_STEPS.fair;
  const [step, setStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (step >= steps.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [step, steps.length]);

  useEffect(() => {
    if (isDone && step >= steps.length - 1 && !showSuccess) {
      setShowSuccess(true);
      setTimeout(onClose, 900);
    }
  }, [isDone, step, steps.length, showSuccess, onClose]);

  const isOffer = targetStage === "offer";
  const isDay1  = targetStage === "day1";
  const accent  = isOffer ? "#b45309" : isDay1 ? "#0d6873" : "#0e3d27";
  const bgLight = isOffer ? "#fffbeb" : isDay1 ? "#f0fdfa" : "#f0fdf4";

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="bg-white rounded-[20px] shadow-2xl w-[380px] max-w-full overflow-hidden">
          <div className="px-8 py-10 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: bgLight }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: accent }} />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#111827]">
                Moved to {STAGE_DISPLAY[targetStage] ?? targetStage}
              </h2>
              <p className="text-[13px] text-[#6b7280] mt-1">Pipeline stage updated successfully.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-[20px] shadow-2xl w-[420px] max-w-full overflow-hidden">
        <div className="px-6 pt-6 pb-3 flex items-center gap-3 border-b border-[#e2e8e5]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bgLight }}>
            <Cpu className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#111827]">Nova AI Processing</h2>
            <p className="text-[11px] text-[#6b7280]">
              Analyzing candidate data for{" "}
              <span className="font-semibold" style={{ color: accent }}>
                {STAGE_DISPLAY[targetStage] ?? targetStage}
              </span>
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <ProcessingStepList steps={steps} activeStep={step} accent={accent} />
        </div>
        <div className="px-6 pb-5">
          <div className="h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(((step + 1) / steps.length) * 100)}%`,
                background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
              }}
            />
          </div>
          <p className="text-[10px] text-[#9ca3af] mt-1.5 text-right">
            {Math.round(((step + 1) / steps.length) * 100)}% complete
          </p>
        </div>
      </div>
    </div>
  );
}

function nextStage(current: string): StageKey | null {
  const idx = STAGE_ORDER.indexOf(current as StageKey);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

/* ─── Stage Progress Bar ─────────────────────────────────────── */
const PROGRESS_STAGES = [
  { label: "Applied",      matchStages: ["fair"] as StageKey[] },
  { label: "Phone Screen", matchStages: ["screen"] as StageKey[] },
  { label: "Interview",    matchStages: ["interview"] as StageKey[] },
  { label: "Offer",        matchStages: ["offer", "day1"] as StageKey[] },
];

function StageProgress({ dbStage }: { dbStage: string }) {
  // index of current step in PROGRESS_STAGES (0-3)
  const stageToProgressIdx: Record<string, number> = {
    fair: 0, screen: 1, interview: 2, offer: 3, day1: 3,
  };
  const currentIdx = stageToProgressIdx[dbStage] ?? 0;

  return (
    <div className="flex items-start shrink-0">
      {PROGRESS_STAGES.map((stage, i) => {
        const isDone    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture  = i > currentIdx;
        return (
          <div key={stage.label} className="flex items-start">
            <div className="flex flex-col items-center gap-[6px]">
              {/* "Current Stage" label — reserves space even when empty */}
              <p className={`text-[10px] leading-[14px] whitespace-nowrap ${isCurrent ? "text-[#6b7280]" : "text-transparent select-none"}`}>
                Current Stage
              </p>
              {/* Circle */}
              {isDone || isCurrent ? (
                <div className="w-[18px] h-[18px] rounded-full bg-[#0e3d27] flex items-center justify-center shrink-0">
                  <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ) : (
                <div className="w-[18px] h-[18px] rounded-full border-2 border-[#d1d5db] bg-white shrink-0" />
              )}
              {/* Label */}
              <p className={`text-[12px] font-semibold whitespace-nowrap leading-[18px] ${isFuture ? "text-[#9ca3af]" : "text-[#0e3d27]"}`}>
                {stage.label}
              </p>
            </div>
            {/* Connector */}
            {i < PROGRESS_STAGES.length - 1 && (
              <div
                className="h-[2px] w-12 mt-[21px]"
                style={{ backgroundColor: i < currentIdx ? "#0e3d27" : "#e2e8e5" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────── */
function CandidateHeader({
  candidate,
  dbStage,
  isLive,
  id,
  onSchedule,
  onAddNote,
  onMoveStage,
  isStagePending,
  moveStageOpen,
  setMoveStageOpen,
  onSocialScreen,
}: {
  candidate: any;
  dbStage: string;
  isLive: boolean;
  id: string;
  onSchedule: () => void;
  onAddNote: () => void;
  onMoveStage: (stage: StageKey) => void;
  isStagePending: boolean;
  moveStageOpen: boolean;
  setMoveStageOpen: (v: boolean) => void;
  onSocialScreen: () => void;
}) {
  const router = useRouter();

  const handleMoveStage = (s: StageKey) => {
    setMoveStageOpen(false);
    onMoveStage(s);
  };

  const handleStartInterview = () => {
    router.push(`/candidate-queue/${id}?live=true`);
  };

  const handleEndInterview = () => {
    router.push(`/candidate-queue/${id}`);
  };

  return (
    <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] px-4 pt-4 pb-5 shrink-0">
      {/* Row 1: Back + name/role + stage progress */}
      <div className="flex items-start justify-between gap-6 mb-3">
        {/* Left */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/candidate-queue")}
            className="flex items-center gap-1 px-2 py-[5px] rounded-[8px] text-[14px] font-medium text-[#111827] leading-5 hover:bg-[#e2e8e5] transition-colors mt-2 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back
          </button>
          <div>
            <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.4px]">
              {candidate.name}
            </h1>
            <p className="text-[14px] font-normal text-[#6b7280] leading-5 tracking-[-0.15px]">
              {candidate.role ?? "Software Engineer"}&nbsp;&nbsp;·&nbsp;&nbsp;{candidate.school ?? "San Francisco"}
            </p>
            {/* Profile links */}
            <div className="flex items-center gap-2 mt-2">
              <a className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] bg-[#0e3d27] text-white text-[11px] font-medium cursor-pointer hover:bg-[#1a5235] transition-colors shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
                LinkedIn
              </a>
              <button className="inline-flex items-center gap-1.5 px-3 py-[5px] h-10 rounded-[14px] bg-white text-[14px] font-normal text-[#4b5563] hover:bg-[#f7f7f7] transition-colors">
                <FileText className="w-4 h-4 shrink-0" />
                Resume
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-[5px] h-10 rounded-[14px] bg-white text-[14px] font-normal text-[#4b5563] hover:bg-[#f7f7f7] transition-colors">
                <MessageSquare className="w-4 h-4 shrink-0" />
                Message
              </button>
            </div>
          </div>
        </div>

        {/* Right: Stage progress */}
        <div className="shrink-0 pt-0">
          <StageProgress dbStage={dbStage} />
        </div>
      </div>

      {/* Row 2: Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {/* Live interview controls */}
        {dbStage === "interview" && !isLive && (
          <button
            onClick={handleStartInterview}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] bg-[#e8f5ee] border border-[#0e3d27] text-[14px] font-normal text-[#0e3d27] hover:bg-[#d2eadc] transition-colors"
          >
            <Video className="w-4 h-4" />
            Start Live Interview
          </button>
        )}
        {isLive && (
          <button
            onClick={handleEndInterview}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] bg-red-50 border border-red-200 text-[14px] font-normal text-red-600 hover:bg-red-100 transition-colors"
          >
            <StopCircle className="w-4 h-4" />
            End Interview
          </button>
        )}

        {/* Social Screen — only relevant before/during screening phase */}
        {(dbStage === "fair" || dbStage === "screen") && (
          <button
            onClick={onSocialScreen}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] border text-[14px] font-normal transition-colors"
            style={{ borderColor: "#0e3d27", color: "#0e3d27", background: "#e8f5ee" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#d2eadc"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#e8f5ee"; }}
          >
            <Globe className="w-4 h-4" />
            Social Screen
          </button>
        )}

        <button
          onClick={onSchedule}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] border border-[#e2e8e5] bg-white text-[14px] font-normal text-[#111827] hover:bg-[#f7f7f7] transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Schedule Interview
        </button>
        <button
          onClick={onAddNote}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] border border-[#e2e8e5] bg-white text-[14px] font-normal text-[#111827] hover:bg-[#f7f7f7] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>

        {/* Move Stage */}
        <div className="relative">
          <button
            onClick={() => setMoveStageOpen(!moveStageOpen)}
            disabled={isStagePending}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] text-white text-[14px] font-normal disabled:opacity-60 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {isStagePending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Move Stage
            <ChevronDown className="w-4 h-4" />
          </button>
          {moveStageOpen && (
            <div className="absolute right-0 top-11 z-30 bg-white border border-[#e2e8e5] rounded-[12px] shadow-xl py-1 min-w-[160px]">
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => handleMoveStage(s)}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[#f7f7f7] transition-colors ${
                    s === dbStage ? "text-[#0e3d27] font-semibold" : "text-[#111827]"
                  }`}
                >
                  {s === dbStage ? `✓ ${STAGE_LABELS[s]}` : STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Override Types ─────────────────────────────────────────── */
type OverrideDecision = {
  type: "reject" | "advance";
  reason: string;
};

/* ─── Override Modal ─────────────────────────────────────────── */
function OverrideModal({
  dbStage,
  candidateName,
  aiScore,
  onClose,
  onConfirm,
  isPending,
}: {
  dbStage: string;
  candidateName: string;
  aiScore: number;
  onClose: () => void;
  onConfirm: (decision: OverrideDecision) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<"reject" | "advance" | null>(null);
  const [reason, setReason] = useState("");

  const canSubmit = selected !== null && reason.trim().length >= 10;
  const aiIsPositive = aiScore >= 70;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[20px] shadow-2xl w-[520px] max-w-full flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8e5]">
          <div>
            <h2 className="text-[18px] font-bold text-[#111827] leading-7">Override AI Decision</h2>
            <p className="text-[13px] text-[#6b7280] mt-0.5 leading-5">
              AI scored <span className="font-semibold text-[#111827]">{candidateName}</span> at{" "}
              <span className={`font-semibold ${aiIsPositive ? "text-[#1f6b43]" : "text-red-600"}`}>
                {aiScore}%
              </span>{" "}
              — {aiIsPositive ? "recommended to advance" : "not recommended"}.
              Your override will be logged.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#4b5563] transition-colors mt-0.5 shrink-0 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option cards */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider">
            Select your decision
          </p>
          <div className="grid grid-cols-2 gap-3">

            {/* Reject card */}
            <button
              onClick={() => setSelected("reject")}
              className={`flex flex-col items-start gap-2 p-4 rounded-[14px] border-2 text-left transition-all ${
                selected === "reject"
                  ? "border-red-400 bg-red-50"
                  : "border-[#e2e8e5] bg-[#f7f7f7] hover:border-red-200 hover:bg-red-50/50"
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                selected === "reject" ? "bg-red-100" : "bg-white"
              }`}>
                <ThumbsDown className={`w-4 h-4 ${selected === "reject" ? "text-red-500" : "text-[#6b7280]"}`} />
              </div>
              <div>
                <p className={`text-[14px] font-semibold leading-5 ${selected === "reject" ? "text-red-700" : "text-[#111827]"}`}>
                  Reject Candidate
                </p>
                <p className="text-[12px] text-[#6b7280] leading-4 mt-0.5">
                  {aiIsPositive
                    ? "AI says advance, but I disagree"
                    : "Confirm AI's recommendation to pass"}
                </p>
              </div>
            </button>

            {/* Advance card */}
            <button
              onClick={() => setSelected("advance")}
              disabled={!nextStage(dbStage)}
              className={`flex flex-col items-start gap-2 p-4 rounded-[14px] border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                selected === "advance"
                  ? "border-[#1f6b43] bg-[#e8f5ee]"
                  : "border-[#e2e8e5] bg-[#f7f7f7] hover:border-[#1f6b43]/50 hover:bg-[#e8f5ee]/50"
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                selected === "advance" ? "bg-[#1f6b43]/10" : "bg-white"
              }`}>
                <ThumbsUp className={`w-4 h-4 ${selected === "advance" ? "text-[#1f6b43]" : "text-[#6b7280]"}`} />
              </div>
              <div>
                <p className={`text-[14px] font-semibold leading-5 ${selected === "advance" ? "text-[#0e3d27]" : "text-[#111827]"}`}>
                  Advance Candidate
                </p>
                <p className="text-[12px] text-[#6b7280] leading-4 mt-0.5">
                  {!aiIsPositive
                    ? "AI says pass, but I see potential"
                    : "Confirm AI's recommendation to advance"}
                </p>
                {nextStage(dbStage) && (
                  <p className="text-[11px] text-[#1f6b43] font-medium mt-1">
                    → Move to {STAGE_LABELS[nextStage(dbStage)!]}
                  </p>
                )}
              </div>
            </button>

          </div>

          {/* Reason textarea */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#4b5563]">
              Reason for override <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                selected === "reject"
                  ? "e.g. Candidate lacked communication skills despite strong technical background..."
                  : selected === "advance"
                  ? "e.g. Strong culture fit observed. AI score underweights leadership potential..."
                  : "Select a decision above, then explain your reasoning..."
              }
              rows={4}
              className="w-full text-[13px] px-3 py-2.5 bg-[#f7f7f7] border border-[#e2e8e5] rounded-[10px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#1f6b43]/30 focus:border-[#1f6b43] resize-none leading-5 transition-colors"
            />
            <p className={`text-[11px] transition-colors ${reason.trim().length >= 10 ? "text-[#6b7280]" : "text-[#9ca3af]"}`}>
              {reason.trim().length}/10 characters minimum
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e5] bg-[#f7f7f7]">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-[12px] border border-[#e2e8e5] bg-white text-[14px] font-medium text-[#111827] hover:bg-[#f7f7f7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm({ type: selected!, reason: reason.trim() })}
            disabled={!canSubmit || isPending}
            className={`h-10 px-5 rounded-[12px] text-white text-[14px] font-medium flex items-center gap-2 transition-opacity disabled:opacity-40 ${
              selected === "reject"
                ? "bg-red-500 hover:bg-red-600"
                : "hover:opacity-90"
            }`}
            style={selected === "advance" || selected === null
              ? { background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }
              : undefined
            }
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {selected === "reject" ? "Confirm Rejection" : selected === "advance" ? "Confirm & Advance" : "Confirm Override"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ─── Schedule Interview Modal ───────────────────────────────── */
type SchedulePayload = {
  date: string;
  time: string;
  type: string;
  notes: string;
  candidateEmail?: string | null;
};

function ScheduleModal({
  candidateName,
  candidateEmail,
  onClose,
  onConfirm,
  isPending,
}: {
  candidateName: string;
  candidateEmail?: string | null;
  onClose: () => void;
  onConfirm: (payload: SchedulePayload) => void;
  isPending: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate]   = useState(today);
  const [time, setTime]   = useState("10:00");
  const [type, setType]   = useState("Phone Screen");
  const [notes, setNotes] = useState("");
  const [gcalStatus, setGcalStatus] = useState<"idle" | "creating" | "done" | "no_auth">("idle");
  const canSubmit = date && time;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    // Fire Google Calendar event creation (best-effort — doesn't block the action)
    setGcalStatus("creating");
    try {
      const startDT = new Date(`${date}T${time}:00`);
      const endDT   = new Date(startDT.getTime() + 60 * 60 * 1000); // +1 hour
      const res = await fetch("/api/google-calendar/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${type} — ${candidateName}`,
          description: notes || undefined,
          startDateTime: startDT.toISOString(),
          endDateTime:   endDT.toISOString(),
          attendeeEmails: candidateEmail ? [candidateEmail] : [],
        }),
      });
      const data = await res.json();
      setGcalStatus(data.error === "not_connected" ? "no_auth" : "done");
    } catch {
      setGcalStatus("no_auth");
    }
    onConfirm({ date, time, type, notes, candidateEmail });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[20px] shadow-2xl w-[460px] max-w-full flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8e5]">
          <div>
            <h2 className="text-[18px] font-bold text-[#111827] leading-7">Schedule Interview</h2>
            <p className="text-[13px] text-[#6b7280] mt-0.5">
              with <span className="font-semibold text-[#111827]">{candidateName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#111827] transition-colors mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#4b5563]">Date</label>
              <input
                type="date" value={date} min={today}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#4b5563]">Time</label>
              <input
                type="time" value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#4b5563]">Interview Type</label>
            <select
              value={type} onChange={(e) => setType(e.target.value)}
              className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] bg-white"
            >
              <option>Phone Screen</option>
              <option>Technical Interview</option>
              <option>Final Interview</option>
              <option>Culture Fit</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#4b5563]">Notes (optional)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for the interviewer..."
              rows={3}
              className="px-3 py-2 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] resize-none"
            />
          </div>

          {/* Google Calendar status */}
          {gcalStatus === "no_auth" && (
            <div className="flex items-center justify-between rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-[12px] text-amber-700">Google Calendar not connected.</p>
              <a href="/api/google-calendar" className="text-[12px] font-semibold text-amber-700 hover:underline">
                Connect →
              </a>
            </div>
          )}
          {gcalStatus === "done" && (
            <div className="flex items-center gap-2 rounded-[10px] bg-[#e8f5ee] border border-[#bbf7d0] px-3 py-2">
              <Check className="w-3.5 h-3.5 text-[#1f6b43]" />
              <p className="text-[12px] text-[#1f6b43] font-medium">Added to Google Calendar</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e5] bg-[#f7f7f7]">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-[12px] border border-[#e2e8e5] bg-white text-[14px] font-medium text-[#111827] hover:bg-[#f7f7f7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isPending || gcalStatus === "creating"}
            className="h-10 px-5 rounded-[12px] text-white text-[14px] font-medium flex items-center gap-2 disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {(isPending || gcalStatus === "creating") && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Note Modal ─────────────────────────────────────────────── */
function NoteModal({
  onClose,
  onConfirm,
  isPending,
}: {
  onClose: () => void;
  onConfirm: (note: string) => void;
  isPending: boolean;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[20px] shadow-2xl w-[440px] max-w-full flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8e5]">
          <h2 className="text-[18px] font-bold text-[#111827] leading-7">Add Note</h2>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#111827] transition-colors mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add your recruiter note here..."
            rows={5}
            className="w-full px-3 py-2 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e5] bg-[#f7f7f7]">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-[12px] border border-[#e2e8e5] bg-white text-[14px] font-medium text-[#111827] hover:bg-[#f7f7f7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm(text.trim())}
            disabled={!canSubmit || isPending}
            className="h-10 px-5 rounded-[12px] text-white text-[14px] font-medium flex items-center gap-2 disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Escalate Modal ─────────────────────────────────────────── */
function EscalateModal({
  candidateName,
  onClose,
  onConfirm,
  isPending,
}: {
  candidateName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[20px] shadow-2xl w-[460px] max-w-full flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8e5]">
          <div>
            <h2 className="text-[18px] font-bold text-[#111827] leading-7">Escalate to Hiring Manager</h2>
            <p className="text-[13px] text-[#6b7280] mt-0.5">Re: <span className="font-semibold text-[#111827]">{candidateName}</span></p>
          </div>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#111827] transition-colors mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[13px] text-[#4b5563] leading-5">
            This will notify the hiring manager and log the escalation to the candidate&apos;s action history.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#4b5563]">Reason for escalation</label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Exceptional candidate — needs fast-track decision..."
              rows={4}
              className="w-full px-3 py-2 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e5] bg-[#f7f7f7]">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-[12px] border border-[#e2e8e5] bg-white text-[14px] font-medium text-[#111827] hover:bg-[#f7f7f7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm(reason.trim())}
            disabled={!canSubmit || isPending}
            className="h-10 px-5 rounded-[12px] text-white text-[14px] font-medium flex items-center gap-2 disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Escalation
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Override Banner ────────────────────────────────────────── */
function OverrideBanner({ override, onUndo }: { override: OverrideDecision; onUndo: () => void }) {
  const isReject  = override.type === "reject";
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-[12px] border ${
      isReject
        ? "bg-red-50 border-red-200"
        : "bg-[#e8f5ee] border-[#1f6b43]/30"
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isReject ? "bg-red-100" : "bg-[#1f6b43]/10"
      }`}>
        {isReject
          ? <ThumbsDown className="w-3.5 h-3.5 text-red-600" />
          : <ThumbsUp className="w-3.5 h-3.5 text-[#1f6b43]" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold leading-5 ${isReject ? "text-red-700" : "text-[#0e3d27]"}`}>
          Recruiter Override: {isReject ? "Rejected" : "Advanced"}&nbsp;
          <span className="text-[11px] font-normal px-1.5 py-0.5 rounded-full bg-white/70 border border-current/20">
            logged to actions
          </span>
        </p>
        <p className={`text-[12px] mt-0.5 leading-4 ${isReject ? "text-red-600" : "text-[#1f6b43]"}`}>
          "{override.reason}"
        </p>
      </div>
      <button
        onClick={onUndo}
        className={`text-[11px] font-medium shrink-0 mt-0.5 hover:underline ${
          isReject ? "text-red-500" : "text-[#1f6b43]"
        }`}
      >
        Undo
      </button>
    </div>
  );
}

/* ─── Debate Summary ─────────────────────────────────────────── */
function DebateSummary({
  candidate,
  dbStage,
  onAccept,
  onReview,
  onOverride,
  onRequestEvidence,
  onEscalate,
  isAdvancing,
  isRequestingEvidence,
  override,
}: {
  candidate: any;
  dbStage: string;
  onAccept: () => void;
  onReview: () => void;
  onOverride: () => void;
  onRequestEvidence: () => void;
  onEscalate: () => void;
  isAdvancing: boolean;
  isRequestingEvidence: boolean;
  override: OverrideDecision | null;
  onUndoOverride: () => void;
}) {
  const [evidenceRequested, setEvidenceRequested] = useState(false);
  const score = candidate.fitScore ?? 0;
  const strengths: string[] = (candidate.strengths as string[]) ?? [];
  const gaps: string[] = (candidate.gaps as string[]) ?? [];

  const recommendedNext = (() => {
    if (dbStage === "offer")     return "Confirm Start Date";
    if (dbStage === "day1")      return "Onboarding";
    if (dbStage === "interview") return score >= 70 ? "Extend Offer" : "Do Not Advance";
    if (dbStage === "screen")    return score >= 85 ? "Technical Interview" : score >= 70 ? "Phone Screen" : "Pass";
    // fair
    return score >= 70 ? "Phone Screen" : "Pass";
  })();

  const reasons = strengths.length >= 2
    ? [
        { title: strengths[0], evidence: "Interview response shows async programming and microservices scaling." },
        { title: strengths[1], evidence: "Fit score confirms advanced system architecture understanding." },
        { title: "Strong technical signal", evidence: "AI confidence 92% from technical answers and recruiter note." },
      ]
    : [
        { title: "Strong Python backend experience", evidence: "Interview response shows async programming and microservices scaling." },
        { title: "Meets system design requirements", evidence: "Fit score confirms advanced system architecture understanding." },
        { title: "Strong technical signal", evidence: "AI confidence 92% from technical answers and recruiter note." },
      ];

  const isRejected = override?.type === "reject";
  const acceptLabel =
    dbStage === "screen"    ? "Advance to Interview" :
    dbStage === "interview" ? "Advance to Offer"     :
    dbStage === "offer"     ? "Mark as Day 1"        : "Accept";

  return (
    <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.45px]">Debate Summary</h2>
          <p className="text-[12px] font-normal text-[#4b5563] leading-[18px] mt-0.5">
            Balanced recommendation based on evidence and risk signals.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOverride}
            className={`h-9 px-[14px] rounded-[10px] border-[1.25px] text-[13px] font-medium transition-colors whitespace-nowrap ${
              override
                ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-[#0e3d27] text-[#0e3d27] bg-white hover:bg-[#e8f5ee]"
            }`}
          >
            {override ? "✎ Override Applied" : "Override Decision"}
          </button>
          <button
            onClick={() => {
              if (!evidenceRequested) {
                onRequestEvidence();
                setEvidenceRequested(true);
              }
            }}
            disabled={isRequestingEvidence || evidenceRequested}
            className={`h-9 px-[14px] rounded-[10px] border-[1.25px] text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:cursor-default ${
              evidenceRequested
                ? "border-[#1f6b43] bg-[#e8f5ee] text-[#1f6b43]"
                : "border-[#0e3d27] text-[#0e3d27] bg-white hover:bg-[#e8f5ee]"
            }`}
          >
            {isRequestingEvidence
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : evidenceRequested
              ? <CheckCircle2 className="w-3.5 h-3.5" />
              : null
            }
            {evidenceRequested ? "Evidence Requested" : "Request More Evidence"}
          </button>
          <button
            onClick={onEscalate}
            className="h-9 px-[14px] rounded-[10px] border-[1.25px] border-[#e2e8e5] text-[13px] font-normal text-[#0e3d27] bg-white hover:bg-[#f7f7f7] transition-colors whitespace-nowrap"
          >
            Escalate to Hiring Manager
          </button>
        </div>
      </div>

      {/* 3-column */}
      <div className="flex gap-6 items-stretch">

        {/* Green AI score card */}
        <div
          className="w-[269px] shrink-0 rounded-[14px] p-4 flex flex-col items-center gap-3"
          style={{ background: "linear-gradient(134.83deg, #0e3d27 9.33%, #1f6b43 86.93%)" }}
        >
          {/* Score circle — dimmed if rejected */}
          <div className={`w-20 h-20 rounded-full border-[1.8px] border-[#e2e8e5] flex items-center justify-center shrink-0 relative ${
            isRejected ? "bg-[#e8f5ee]/40" : "bg-[#e8f5ee]"
          }`}>
            <span className={`text-[21px] font-semibold text-[#0e3d27] ${isRejected ? "opacity-40" : ""}`}>{score}%</span>
            {isRejected && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
            )}
          </div>
          {/* Recommended next */}
          <AnimatePresence mode="wait">
          <motion.div key={dbStage + (isRejected ? "-rejected" : "")} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="text-center w-full">
            <p className="text-[14px] font-normal text-[#cde9db] leading-5">
              {isRejected ? "Recruiter decision:" : "Recommended next:"}
            </p>
            <p className="text-[18px] font-medium text-white leading-6 mt-0.5">
              {isRejected ? "Rejected" : recommendedNext}
            </p>
          </motion.div>
          </AnimatePresence>
          {/* Summary or override reason */}
          <AnimatePresence mode="wait">
          <motion.p key={dbStage + "-summary"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="text-[14px] font-normal text-[#e8f5ee] text-center leading-[22.75px] flex-1">
            {isRejected
              ? `Recruiter override: "${override!.reason}"`
              : (candidate.summary ?? (
                  dbStage === "offer"     ? "Offer extended. Awaiting candidate signature and confirmed start date." :
                  dbStage === "day1"      ? "Candidate has accepted and is preparing for onboarding." :
                  dbStage === "interview" ? "Technical skills are excellent match. Address compensation and employment gap concerns before extending offer." :
                  dbStage === "screen"    ? "Initial screen complete. Strong technical signal — recommend advancing to technical interview." :
                  "Promising candidate at fair. Schedule a phone screen to validate technical depth."
                ))
            }
          </motion.p>
          </AnimatePresence>
          {/* Buttons */}
          <div className="flex gap-4 w-full">
            <button
              onClick={onAccept}
              disabled={isAdvancing || !nextStage(dbStage) || isRejected}
              title={isRejected ? "Override rejection is active. Click 'Override Applied' to change." : undefined}
              className="flex-1 h-10 rounded-[14px] bg-white text-[14px] font-medium text-[#0e3d27] hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {isAdvancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {isRejected ? "Rejected" : acceptLabel}
            </button>
            <button
              onClick={onReview}
              disabled={isRejected}
              className="flex-1 h-10 rounded-[14px] border border-[#f7f7f7] text-white text-[14px] font-medium hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-[0px_4px_12px_0px_rgba(46,139,87,0.25)]"
            >
              Review
            </button>
          </div>
        </div>

        {/* Reasons to Advance */}
        <div className="flex-1 min-w-0 py-1">
          <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] leading-[19.5px] mb-4">
            REASONS TO ADVANCE
          </p>
          <div className="space-y-4">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${isRejected ? "text-[#9ca3af]" : "text-[#1f6b43]"}`} />
                <div>
                  <p className={`text-[14px] font-medium leading-5 ${isRejected ? "text-[#9ca3af] line-through" : "text-[#111827]"}`}>{r.title}</p>
                  {!isRejected && (
                    <p className="text-[14px] font-normal text-[#4b5563] leading-5 mt-0.5">
                      Evidence: {r.evidence}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Flags */}
        <div className="flex-1 min-w-0 py-1">
          <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] leading-[19.5px] mb-4">
            RISK FLAGS
          </p>
          {gaps.length === 0 ? (
            <p className="text-[14px] font-normal text-[#4b5563] leading-5">All risks resolved</p>
          ) : (
            <div className="space-y-3">
              {gaps.slice(0, 2).map((g, i) => (
                <div key={i} className="bg-white rounded-[10px] border border-[#e2e8e5] p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-[13px] font-semibold text-[#111827]">{g}</span>
                  </div>
                  <p className="text-[12px] text-[#6b7280] leading-4 pl-5">
                    Requires follow-up in next interview round.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ─── Draft Cards ────────────────────────────────────────────── */
function DraftCards({ candidate, dbStage }: { candidate: any; dbStage: string }) {
  const [emailState, setEmailState] = useState<"default" | "approved" | "dismissed">("default");

  const firstName = candidate.name?.split(" ")[0] ?? "there";
  const roleTitle = candidate.role ?? "Software Engineer";
  const strength = candidate.strengths?.[0] ?? null;

  type DraftContent = { emailSubject: string; emailBody: string; atsNote: string };

  const drafts: Record<string, DraftContent> = {
    fair: {
      emailSubject: `Subject: Follow-Up — ${roleTitle} at TechCorp`,
      emailBody: `Hi ${firstName}, Thank you for stopping by our booth at Tech Talent Expo. We were impressed with your background${strength ? `, especially your experience in ${strength}` : ""}. We'd love to continue the conversation — would you be available for a quick call this week?`,
      atsNote: `Candidate visited booth at career fair. Initial impression positive. Recommend scheduling an introductory call to assess fit for ${roleTitle}.`,
    },
    screen: {
      emailSubject: `Subject: Follow-Up — ${roleTitle} at TechCorp`,
      emailBody: `Hi ${firstName}, Thank you for speaking with us today. We were impressed with your background and would like to move you to a phone screen. Please use the link below to schedule a time...`,
      atsNote: `Strong candidate with relevant technical background. Initial resume review shows good alignment with ${roleTitle} requirements. Recommend proceeding to phone screen to validate technical depth and culture fit.`,
    },
    interview: {
      emailSubject: `Subject: Next Steps — ${roleTitle} at TechCorp`,
      emailBody: `Hi ${firstName}, Great speaking with you today. Based on our conversation, I'd like to move you forward to a technical interview for the ${roleTitle} position. The interview will be 45–60 minutes covering technical skills and system design. I'll send a calendar invite shortly.`,
      atsNote: `Strong technical candidate with deep Python and distributed systems experience. System design answers were specific and well-structured. Leadership evidence is limited — has influenced technical direction informally but has not managed direct reports. Kubernetes exposure remains unverified; should be probed in technical round. No red flags on cultural fit. Recommend advancing to technical interview.`,
    },
    offer: {
      emailSubject: `Subject: Offer Letter — ${roleTitle} at TechCorp`,
      emailBody: `Hi ${firstName}, Congratulations! We are thrilled to extend an official offer for the ${roleTitle} position at TechCorp.\n\nPlease find your formal offer letter attached. It includes compensation details, start date, and onboarding information${strength ? `. We're excited about the value you'll bring, especially your expertise in ${strength}` : ""}.\n\nKindly review and sign by the deadline noted in the letter. Feel free to reach out with any questions.\n\nWelcome to the team!`,
      atsNote: `Candidate has completed all interview rounds and received a passing assessment. Extending formal offer for ${roleTitle}. Awaiting candidate signature. No blockers identified.`,
    },
    day1: {
      emailSubject: `Subject: Welcome — Your First Day Details`,
      emailBody: `Hi ${firstName}, We are so excited to welcome you as our new ${roleTitle}!\n\nHere are your first-day details:\n📍 Office address and parking info will be sent separately\n🕘 Start time: 9:00 AM\n💻 Your equipment will be ready at your desk\n\nPlease bring a valid ID for building access. Your onboarding buddy will meet you at reception.\n\nSee you soon!`,
      atsNote: `Offer accepted. Candidate onboarding in progress for ${roleTitle}. Equipment and system access being provisioned. Day 1 logistics confirmed.`,
    },
  };

  const { emailSubject, emailBody, atsNote } = drafts[dbStage] ?? drafts.fair;

  return (
    <div className="flex gap-6">

      {/* Follow-up Email Draft */}
      <div className="flex-1 bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] p-4 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] leading-[19.5px]">
            FOLLOW-UP EMAIL DRAFT
          </p>
          <button className="text-[#6b7280] hover:text-[#111827] transition-colors p-0.5 rounded">
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
        <motion.div key={dbStage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>

        {emailState === "dismissed" && (
          <div className="flex flex-col items-center py-6 gap-2">
            <p className="text-[14px] text-[#6b7280]">Email draft dismissed.</p>
            <button
              onClick={() => setEmailState("default")}
              className="text-[13px] text-[#0e3d27] underline hover:no-underline"
            >
              Restore draft
            </button>
          </div>
        )}

        {emailState === "approved" && (
          <div className="flex items-center gap-2 py-4">
            <CheckCircle2 className="w-5 h-5 text-[#1f6b43] shrink-0" />
            <p className="text-[14px] font-medium text-[#1f6b43]">Email sent successfully</p>
          </div>
        )}

        {emailState === "default" && (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-medium text-[#111827] leading-5">{emailSubject}</p>
            <p className="text-[14px] font-normal text-[#0e3d27] leading-[22.75px]">{emailBody}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setEmailState("approved")}
                className="h-10 px-4 rounded-[14px] bg-[#1f6b43] text-white text-[14px] font-medium hover:bg-[#0e3d27] transition-colors"
              >
                Approve + Send
              </button>
              <button
                onClick={() => setEmailState("dismissed")}
                className="h-10 px-[17px] text-[14px] font-medium text-[#111827] hover:text-[#4b5563] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* ATS Note Draft */}
      <div className="flex-1 bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] p-4 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] leading-[19.5px]">
            ATS NOTE DRAFT
          </p>
          <button className="text-[#6b7280] hover:text-[#111827] transition-colors p-0.5 rounded">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <AnimatePresence mode="wait">
        <motion.div key={dbStage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <p className="text-[14px] font-normal text-[#111827] leading-[22.75px] mb-4">
          {atsNote}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-normal text-[#6b7280]">
            {atsNote.length} characters
          </span>
          <p className="text-[14px] font-medium text-[#0e3d27]">✓ Approved</p>
        </div>
        </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

/* ─── Candidate Profile Section ──────────────────────────────── */
const MOCK_SCREEN_QA = [
  {
    question: "Tell me about your experience with your primary technical stack.",
    quality: "Strong Answer", confidence: 92,
    answer: '"I\'ve spent the last four years building distributed backend systems in Python and Go, mostly around event-driven architectures using Kafka and SQS. At my current company I led the decomposition of a monolith into about a dozen microservices — we went from 45-minute deploys to independent per-service CI/CD under 8 minutes. We were processing around 10–12 million transactions a day at peak, so reliability was non-negotiable. I got comfortable with things like circuit breakers, graceful degradation, and distributed tracing early on because we needed them to stay on-call sane."',
    tags: ["Technical depth", "Relevant experience", "Scale experience", "Systems design"],
  },
  {
    question: "Why are you interested in leaving your current role?",
    quality: "Adequate Answer", confidence: 68,
    answer: '"Honestly it\'s a mix of things. The technical work is still interesting but the org has grown a lot and decision-making has slowed. I\'ve been in the same scope for about two years now — I want to be somewhere where I can see the direct product impact of what I\'m building. I\'m also genuinely excited about the ML-infrastructure intersection, which is more front-and-center here than where I am now. I\'m not in a rush, but I\'ve been intentional about looking at companies where the engineering culture pushes you rather than holds you."',
    tags: ["Career motivation", "Culture fit", "Self-awareness"],
  },
  {
    question: "Describe a challenging technical problem you've solved recently.",
    quality: "Strong Answer", confidence: 88,
    answer: '"We started seeing p99 latency spikes on our order lookup service — intermittent, only under load, really hard to repro locally. I set up distributed tracing across the call chain and eventually isolated it to a specific DB query that was doing a sequential scan on a join when the query planner was choosing the wrong index under high concurrency. Short-term fix was a query hint; long-term we redesigned the query and added a covering index. Latency dropped from around 800ms p99 to about 90ms. The bigger lesson was building better observability tooling into our review process so we catch this class of issue in staging before it hits prod."',
    tags: ["Problem solving", "Debugging", "Observability", "Performance"],
  },
  {
    question: "How do you approach working with stakeholders who have competing priorities?",
    quality: "Adequate Answer", confidence: 74,
    answer: '"I try to get everyone into the same room early and make the tradeoffs explicit — not just the technical cost but the business cost of deferring things. I\'ve found that most conflict comes from people not having visibility into what the other side is actually dealing with. I\'ve had to push back on product timelines a few times when the ask would have created serious tech debt, and framing it around risk rather than engineering preference usually lands better."',
    tags: ["Collaboration", "Communication", "Stakeholder management"],
  },
];

const MOCK_INTERVIEW_QA = [
  {
    question: "Walk me through your system design approach for a high-scale service.",
    quality: "Strong Answer", confidence: 90,
    answer: '"I start by clarifying the constraints — read-heavy vs write-heavy, strict consistency vs eventual, expected QPS, data volume over 5 years. From there I work top-down: sketch the high-level components, then drill into the data model and storage choice. For something read-heavy I\'d lean on a CDN layer plus read replicas; for write-heavy you\'re thinking about partitioning strategies early. I\'ll usually identify the single most likely bottleneck and design around that first rather than trying to over-engineer everything upfront. I\'ve done this exercise for real a few times — one was a notification fanout system that needed to deliver to 2M users in under 5 seconds, which forced me to think carefully about async processing and pre-computing user subscriptions."',
    tags: ["System design", "Architecture", "Technical depth", "Scalability"],
  },
  {
    question: "Describe a time you led a cross-functional project under pressure.",
    quality: "Strong Answer", confidence: 85,
    answer: '"We had a regulatory deadline — 90 days to implement audit logging across our entire data platform, touching storage, APIs, and the frontend. I was the tech lead coordinating four teams. My first move was building a shared timeline with explicit dependencies so each team could see where they were blocking others. I ran a 20-minute standup every other day just for cross-team dependency checks, kept a shared risk log visible to everyone, and escalated early when we hit a scope creep issue in week five that would have pushed us past the deadline. We shipped on time with two days to spare. The thing I\'d do differently is get a dedicated PM involved earlier — I was doing a lot of coordination overhead that probably didn\'t need to be mine."',
    tags: ["Leadership", "Cross-functional", "Project management", "Communication"],
  },
  {
    question: "How do you evaluate technical tradeoffs when there's no clearly right answer?",
    quality: "Adequate Answer", confidence: 79,
    answer: '"I usually try to make the tradeoffs legible first — write them down so everyone is looking at the same thing. Then I\'ll look at reversibility: can we try option A and course correct later, or is this a one-way door? For one-way doors I want more confidence before committing. I also try to ask who is best positioned to absorb the downside of each option — sometimes what looks like a toss-up technically is actually obvious when you think about operational burden on the on-call team. I lean toward boring technology unless there\'s a compelling reason not to."',
    tags: ["Decision making", "Technical judgment", "Engineering culture"],
  },
];

function QualityBadge({ quality }: { quality: string }) {
  const s: Record<string, string> = {
    "Strong Answer": "bg-[#e8f5ee] text-[#1f6b43]",
    "Adequate Answer": "bg-amber-100 text-amber-700",
    "Weak Answer": "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] ${s[quality] ?? "bg-[#f7f7f7] text-[#4b5563]"}`}>
      {quality}
    </span>
  );
}

function InterviewSection({ title, qa, meta }: { title: string; qa: typeof MOCK_SCREEN_QA; meta: string }) {
  return (
    <div className="bg-white rounded-[14px] p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px]">{title}</p>
        <span className="text-[11px] text-[#6b7280]">{meta}</span>
      </div>
      <div className="space-y-5">
        {qa.map((item, i) => (
          <div key={i} className="space-y-1.5">
            <p className="text-[14px] font-semibold text-[#111827] leading-5">{item.question}</p>
            <div className="flex items-center gap-2">
              <QualityBadge quality={item.quality} />
              <span className="text-[11px] text-[#6b7280]">AI Confidence: {item.confidence}%</span>
            </div>
            <p className="text-[13px] italic text-[#4b5563] leading-5">{item.answer}</p>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[#4b5563] border border-[#e2e8e5]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateProfile({ candidate, dbStage, actions }: { candidate: any; dbStage: string; actions: any[] }) {
  const strengths: string[] = (candidate.strengths as string[]) ?? [];
  const gaps: string[] = (candidate.gaps as string[]) ?? [];
  const [noteText, setNoteText] = useState("");

  const fitItems = [
    ...strengths.slice(0, 2).map((s) => ({ req: s, type: "Required", status: "Met" as const })),
    ...(strengths[2] ? [{ req: strengths[2], type: "Preferred", status: "Met" as const }] : []),
    ...gaps.slice(0, 1).map((g) => ({ req: g, type: "Required", status: "Not Met" as const })),
  ];

  const skillsMatch = strengths.slice(0, 5).map((s, i) => ({
    skill: s.length > 28 ? s.slice(0, 28) : s,
    pct: Math.max(70, 95 - i * 5),
  }));

  const isPostInterview = dbStage === "interview" || dbStage === "offer" || dbStage === "day1";

  const MOCK_NOTES = [
    { author: "Sarah Johnson", date: "Feb 20, 2026 · 2:30 PM", text: "Great technical background. Very articulate and enthusiastic about the role. Seems like a strong culture fit." },
    { author: "Mike Chen", date: "Feb 19, 2026 · 4:15 PM", text: "Resume looks solid. Previous experience is a big plus. Scheduling initial screen." },
  ];

  return (
    <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)]">
      <div className="px-4 pt-8 pb-6">
        <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.45px] mb-4">
          Candidate profile
        </h2>
        <div className="flex gap-4">

          {/* Left: main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Fit Score Breakdown */}
            {fitItems.length > 0 && (
              <div className="bg-white rounded-[14px] p-4">
                <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] leading-[19.5px] mb-3">
                  FIT SCORE BREAKDOWN
                </p>
                <div className="space-y-2">
                  {fitItems.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-4 py-3 rounded-[8px] ${
                        item.status === "Met" ? "bg-[#e8f5ee]" : "bg-red-50"
                      }`}
                    >
                      {item.status === "Met"
                        ? <CheckCircle2 className="h-4 w-4 text-[#1f6b43] shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      }
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#111827]">{item.req}</span>
                        <span className="text-[11px] text-[#4b5563]">({item.type})</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ${
                          item.status === "Met" ? "bg-[#1f6b43] text-white" : "bg-red-100 text-red-700"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screen call responses — shown once phone screen done */}
            {isPostInterview && (
              <InterviewSection
                title="SCREEN CALL RESPONSES"
                qa={MOCK_SCREEN_QA}
                meta="Screen Call · 30 min · Feb 20, 2026"
              />
            )}

            {/* Interview responses — shown once interview done */}
            {isPostInterview && (
              <InterviewSection
                title="INTERVIEW RESPONSES"
                qa={MOCK_INTERVIEW_QA}
                meta="Live Interview · 60 min · Feb 22, 2026"
              />
            )}

            {/* Interaction history */}
            <div className="bg-white rounded-[14px] p-4">
              <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] mb-3">
                INTERACTION HISTORY
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "Packet submitted", date: "Feb 19" },
                  { label: "Micro-screen completed", date: "Feb 19" },
                  { label: "Risk flag submitted", date: "Feb 19" },
                  ...((actions ?? []).slice(0, 3).map((a) => ({
                    label: a.actionType.replace(/_/g, " "),
                    date: a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "–",
                  }))),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[#0e3d27] shrink-0" />
                    <span className="text-[13px] text-[#111827] font-medium capitalize">{item.label}</span>
                    <span className="text-[12px] text-[#6b7280] ml-auto">{item.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-[240px] shrink-0 flex flex-col gap-4">

            {/* Candidate Details */}
            <div className="bg-white rounded-[14px] p-4">
              <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] mb-3">CANDIDATE DETAILS</p>
              <div className="space-y-2.5">
                {[
                  { label: "Location", value: "Remote only" },
                  { label: "Experience", value: "5 years" },
                  { label: "Education", value: candidate.school ?? "Not specified" },
                  { label: "Work preference", value: "Remote only" },
                  { label: "Applied", value: "Feb 19, 2026" },
                  { label: "Source", value: "LinkedIn" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[11px] text-[#6b7280]">{label}</p>
                    <p className="text-[13px] font-medium text-[#111827]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Match */}
            {skillsMatch.length > 0 && (
              <div className="bg-white rounded-[14px] p-4">
                <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px] mb-3">SKILLS MATCH</p>
                <div className="space-y-2.5">
                  {skillsMatch.map(({ skill, pct }) => (
                    <div key={skill}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-[#111827] truncate pr-2">{skill}</span>
                        <span className="text-[12px] font-semibold text-[#111827] shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#e2e8e5] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recruiter Notes */}
            <div className="bg-white rounded-[14px] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold text-[#111827] tracking-[0.325px]">RECRUITER NOTES</p>
                <button className="text-[12px] font-medium text-[#0e3d27] hover:underline">Add Note</button>
              </div>
              <div className="mb-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full text-[12px] px-3 py-2 bg-[#f7f7f7] border border-[#e2e8e5] rounded-[8px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] resize-none"
                />
                {noteText && (
                  <button
                    onClick={() => setNoteText("")}
                    className="mt-1.5 h-6 px-3 rounded text-[10px] font-medium text-white"
                    style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
                  >
                    Save
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {MOCK_NOTES.map((note, i) => (
                  <div key={i} className="border-l-2 border-[#0e3d27]/30 pl-3">
                    <p className="text-[11px] font-semibold text-[#111827]">{note.author}</p>
                    <p className="text-[10px] text-[#6b7280] mb-1">{note.date}</p>
                    <p className="text-[12px] text-[#111827] leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Live Interview View ────────────────────────────────────── */
const MOCK_SUGGESTED_QUESTIONS = [
  { badge: "GAP", badgeColor: "bg-orange-100 text-orange-700", question: "You listed Python as a core skill, but your resume only shows 1 year of professional Python use. Can you walk me through a specific complex project?" },
  { badge: "UNVERIFIED", badgeColor: "bg-yellow-100 text-yellow-700", question: "You mentioned leading a team of 8 engineers. How did you handle performance reviews and growth conversations with your reports?" },
  { badge: "ROLE REC", badgeColor: "bg-[#e2e8e5] text-[#4b5563]", question: "This role requires owning the on-call rotation. How have you handled production incidents in the past, and what's your approach to post-mortems?" },
];
const MOCK_COVERAGE = [
  { label: "Python depth",           status: "done" },
  { label: "System design",          status: "done" },
  { label: "Team leadership",        status: "active" },
  { label: "Infrastructure / DevOps",status: "pending" },
  { label: "Culture / work style",   status: "pending" },
];
const MOCK_TRANSCRIPT = [
  { speaker: "Jordan", text: "Tell me more about the migration project you mentioned — specifically how you handled the data consistency challenges." },
  { speaker: "Marcus", text: "Sure. The biggest challenge was maintaining read availability during the migration window. We used a dual-write pattern for 3 weeks — writing to both old and new systems simultaneously — then gradually shifted read traffic over using feature flags." },
  { speaker: "Jordan", text: "Smart. Did you encounter any data drift between the two systems?" },
  { speaker: "Marcus", text: "Yes, about 0.3% of records diverged. We built a reconciliation job that ran nightly and produced a diff report. Any record with a discrepancy above a threshold got flagged for manual review." },
];

function LiveInterviewView() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visibleQs = MOCK_SUGGESTED_QUESTIONS.filter((_, i) => !dismissed.has(i));

  return (
    <div className="flex gap-4">
      {/* Suggested Questions */}
      <div className="flex-1 bg-[#f7f7f7] rounded-[16px] p-5 flex flex-col gap-4 min-w-0">
        <div>
          <p className="text-[14px] font-bold text-[#111827]">SUGGESTED QUESTIONS</p>
          <p className="text-[12px] text-[#6b7280] mt-0.5">Auto-updating as you talk</p>
        </div>
        <div className="space-y-3">
          {visibleQs.length === 0
            ? <p className="text-[13px] text-[#6b7280] py-6 text-center">All questions dismissed</p>
            : visibleQs.map((q) => {
                const origIdx = MOCK_SUGGESTED_QUESTIONS.indexOf(q);
                return (
                  <div key={origIdx} className="bg-white rounded-[12px] border border-[#e2e8e5] p-4 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${q.badgeColor}`}>{q.badge}</span>
                      <p className="text-[13px] text-[#111827] leading-5 mt-2">{q.question}</p>
                    </div>
                    <button
                      onClick={() => setDismissed((prev) => new Set([...prev, origIdx]))}
                      className="text-[#9ca3af] hover:text-[#4b5563] shrink-0 mt-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Coverage + Transcript */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="bg-[#f7f7f7] rounded-[16px] p-5">
          <p className="text-[14px] font-bold text-[#111827] mb-4">COVERAGE TRACKER</p>
          <div className="space-y-2.5">
            {MOCK_COVERAGE.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                {item.status === "done"
                  ? <CheckCircle2 className="h-4 w-4 text-[#1f6b43] shrink-0" />
                  : item.status === "active"
                  ? <div className="h-4 w-4 rounded-sm border-2 border-[#0e3d27] shrink-0 flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-[#0e3d27]" /></div>
                  : <Circle className="h-4 w-4 text-[#d1d5db] shrink-0" />
                }
                <span className={`text-[13px] ${item.status === "pending" ? "text-[#9ca3af]" : "text-[#111827]"}`}>
                  {item.label}
                </span>
                {item.status === "active" && <span className="text-[10px] text-[#6b7280] ml-auto">in progress</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#f7f7f7] rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-bold text-[#111827]">LIVE TRANSCRIPT</p>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] text-[#6b7280]">Recording</span>
            </div>
          </div>
          <div className="space-y-4">
            {MOCK_TRANSCRIPT.map((line, i) => (
              <div key={i}>
                <p className="text-[11px] font-bold text-[#0e3d27] mb-0.5">{line.speaker}:</p>
                <p className="text-[12px] text-[#4b5563] leading-5">{line.text}</p>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-[#0e3d27]">Marcus:</span>
              <span className="inline-block h-3 w-0.5 bg-[#0e3d27] animate-pulse ml-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [moveStageOpen,    setMoveStageOpen]    = useState(false);
  const [overrideOpen,     setOverrideOpen]     = useState(false);
  const [override,         setOverride]         = useState<OverrideDecision | null>(null);
  const [scheduleOpen,     setScheduleOpen]     = useState(false);
  const [noteOpen,         setNoteOpen]         = useState(false);
  const [escalateOpen,     setEscalateOpen]     = useState(false);
  const [socialScreenOpen, setSocialScreenOpen] = useState(
    () => searchParams.get("social") === "1"
  );
  // Stage transition overlay
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const [transitionDone,   setTransitionDone]   = useState(false);

  const { data: candidate, isLoading } = useQuery(
    trpc.recruiter.getCandidateWithEvidence.queryOptions({ id })
  );
  const { data: actions } = useQuery(
    trpc.recruiter.getActionsByCandidate.queryOptions({ candidateId: id })
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: trpc.recruiter.getCandidateWithEvidence.queryKey({ id }) });
    queryClient.invalidateQueries({ queryKey: trpc.recruiter.getActionsByCandidate.queryKey({ candidateId: id }) });
    queryClient.invalidateQueries({ queryKey: trpc.recruiter.getCandidates.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.recruiter.getCandidateById.queryKey({ id }) });
  };

  const createAction = useMutation(
    trpc.recruiter.createAction.mutationOptions({ onSuccess: invalidateAll })
  );

  // Optimistic update helper — immediately applies new stage to all relevant caches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyStageOptimistic = (newStage: string) => {
    queryClient.setQueryData(
      trpc.recruiter.getCandidateWithEvidence.queryKey({ id }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (old: any) => old ? { ...old, stage: newStage } : old
    );
    queryClient.setQueryData(
      trpc.recruiter.getCandidates.queryKey(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (old: any) => Array.isArray(old) ? old.map((c: any) => c.id === id ? { ...c, stage: newStage } : c) : old
    );
  };

  const updateStage = useMutation(
    trpc.recruiter.updateCandidateStage.mutationOptions({
      onMutate: async (variables) => {
        // Cancel any in-flight re-fetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey: trpc.recruiter.getCandidateWithEvidence.queryKey({ id }) });
        await queryClient.cancelQueries({ queryKey: trpc.recruiter.getCandidates.queryKey() });
        // Snapshot for rollback
        const prevDetail = queryClient.getQueryData(trpc.recruiter.getCandidateWithEvidence.queryKey({ id }));
        const prevList   = queryClient.getQueryData(trpc.recruiter.getCandidates.queryKey());
        // Optimistically update caches
        applyStageOptimistic(variables.stage);
        return { prevDetail, prevList };
      },
      onError: (err, _vars, context) => {
        // Roll back on failure
        if (context?.prevDetail !== undefined) {
          queryClient.setQueryData(trpc.recruiter.getCandidateWithEvidence.queryKey({ id }), context.prevDetail);
        }
        if (context?.prevList !== undefined) {
          queryClient.setQueryData(trpc.recruiter.getCandidates.queryKey(), context.prevList);
        }
        // NOTE FOR MENTOR: Stage mutations fail with 401 UNAUTHORIZED because
        // currentUser() from Clerk loses AsyncLocalStorage context inside Hono's
        // trpcServer() middleware on POST requests. The dbProcedure check
        // (ctx.user != null) therefore throws UNAUTHORIZED even when the user
        // is signed in. Fix: ensure Clerk auth context propagates into the
        // Hono POST handler (e.g. pass auth headers explicitly or switch the
        // tRPC route handler to a Next.js fetchRequestHandler that runs inside
        // the Clerk middleware chain).
        console.error("[updateCandidateStage] mutation failed:", (err as { data?: { code?: string } })?.data?.code, err);
      },
      onSuccess: () => { invalidateAll(); setMoveStageOpen(false); setTransitionDone(true); },
    })
  );

  // ─── Override confirm ────────────────────────────────────────
  const handleOverrideConfirm = (decision: OverrideDecision) => {
    const dbStage = candidate?.stage ?? "screen";

    if (decision.type === "reject") {
      // Log a follow_up_email action (rejection) with the recruiter's note
      createAction.mutate(
        { candidateId: id, actionType: "follow_up_email", notes: `OVERRIDE REJECT: ${decision.reason}` },
        {
          onSuccess: () => {
            setOverride(decision);
            setOverrideOpen(false);
          },
        }
      );
    } else {
      // Advance the stage first, then log the override note
      const next = nextStage(dbStage);
      if (!next) return;
      setOverride(decision);
      setOverrideOpen(false);
      handleStageMove(next);
      createAction.mutate({ candidateId: id, actionType: "move_stage", notes: `OVERRIDE ADVANCE: ${decision.reason}` });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0e3d27]" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-[14px] text-[#6b7280]">Candidate not found.</p>
      </div>
    );
  }

  const dbStage = (candidate.stage ?? "screen") as string;
  const isLive  = searchParams.get("live") === "true";

  const handleStageMove = (stage: string) => {
    setTransitionTarget(stage);
    setTransitionDone(false);
    updateStage.mutate({ id, stage: stage as "fair" | "screen" | "interview" | "offer" | "day1" });
  };

  const handleTransitionClose = () => {
    setTransitionTarget(null);
    setTransitionDone(false);
  };

  const handleAccept = () => {
    const next = nextStage(dbStage);
    if (next) handleStageMove(next);
  };

  const handleReview = () => {
    setScheduleOpen(true);
  };

  const handleScheduleConfirm = (payload: SchedulePayload) => {
    const notes = `Interview scheduled: ${payload.date} at ${payload.time} (${payload.type})${payload.notes ? ` — ${payload.notes}` : ""}`;
    createAction.mutate(
      { candidateId: id, actionType: "schedule_interview", notes },
      { onSuccess: () => setScheduleOpen(false) }
    );
  };

  const handleNoteConfirm = (note: string) => {
    createAction.mutate(
      { candidateId: id, actionType: "follow_up_email", notes: `NOTE: ${note}` },
      { onSuccess: () => setNoteOpen(false) }
    );
  };

  const handleRequestEvidence = () => {
    createAction.mutate({ candidateId: id, actionType: "request_evidence", notes: "Recruiter requested additional evidence" });
  };

  const handleEscalateConfirm = (reason: string) => {
    createAction.mutate(
      { candidateId: id, actionType: "escalate", notes: reason },
      { onSuccess: () => setEscalateOpen(false) }
    );
  };

  const isOverridePending = createAction.isPending || updateStage.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 p-5 pb-8"
    >

      {/* ── Auth error banner — visible when stage mutation returns 401 ── */}
      {updateStage.isError && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Stage update failed (401 Unauthorized)</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              <strong>Mentor note:</strong> <code className="bg-amber-100 px-1 rounded text-[11px]">updateCandidateStage</code> fails because{" "}
              <code className="bg-amber-100 px-1 rounded text-[11px]">currentUser()</code> returns null inside Hono&apos;s POST handler —
              Clerk&apos;s AsyncLocalStorage context is lost. See <code className="bg-amber-100 px-1 rounded text-[11px]">server/init.ts</code>{" "}
              <code className="bg-amber-100 px-1 rounded text-[11px]">dbProcedure</code> and{" "}
              <code className="bg-amber-100 px-1 rounded text-[11px]">server/hono/app.ts</code> for the request path.
            </p>
          </div>
          <button
            onClick={() => updateStage.reset()}
            className="text-amber-500 hover:text-amber-700 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}>
      <CandidateHeader
        candidate={candidate}
        dbStage={dbStage}
        isLive={isLive}
        id={id}
        onSchedule={() => setScheduleOpen(true)}
        onAddNote={() => setNoteOpen(true)}
        onMoveStage={handleStageMove}
        isStagePending={updateStage.isPending}
        moveStageOpen={moveStageOpen}
        setMoveStageOpen={setMoveStageOpen}
        onSocialScreen={() => setSocialScreenOpen(true)}
      />
      </motion.div>

      {isLive ? (
        <LiveInterviewView />
      ) : (
        <>
          {/* Override banner — shown above debate summary when active */}
          {override && (
            <OverrideBanner
              override={override}
              onUndo={() => setOverride(null)}
            />
          )}

          {/* Debate Summary */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
          <DebateSummary
            candidate={candidate}
            dbStage={dbStage}
            onAccept={handleAccept}
            onReview={handleReview}
            onOverride={() => setOverrideOpen(true)}
            onRequestEvidence={handleRequestEvidence}
            onEscalate={() => setEscalateOpen(true)}
            onUndoOverride={() => setOverride(null)}
            isAdvancing={updateStage.isPending}
            isRequestingEvidence={createAction.isPending}
            override={override}
          />
          </motion.div>

          {/* Email Draft + ATS Note */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}>
          <DraftCards candidate={candidate} dbStage={dbStage} />
          </motion.div>

          {/* Candidate Profile */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}>
          <CandidateProfile
            candidate={candidate}
            dbStage={dbStage}
            actions={actions ?? []}
          />
          </motion.div>
        </>
      )}

      {/* Click-outside for Move Stage */}
      {moveStageOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMoveStageOpen(false)} />
      )}

      {/* Social Screen Modal */}
      {socialScreenOpen && candidate && (
        <SocialScreenModal
          candidateName={candidate.name}
          onClose={() => setSocialScreenOpen(false)}
        />
      )}

      {/* Stage transition overlay */}
      {transitionTarget && (
        <StageTransitionOverlay
          targetStage={transitionTarget}
          isDone={transitionDone}
          onClose={handleTransitionClose}
        />
      )}

      {/* Override Modal */}
      {overrideOpen && candidate && (
        <OverrideModal
          dbStage={dbStage}
          candidateName={candidate.name}
          aiScore={candidate.fitScore ?? 0}
          onClose={() => setOverrideOpen(false)}
          onConfirm={handleOverrideConfirm}
          isPending={isOverridePending}
        />
      )}

      {/* Schedule Interview Modal */}
      {scheduleOpen && candidate && (
        <ScheduleModal
          candidateName={candidate.name}
          candidateEmail={candidate.email}
          onClose={() => setScheduleOpen(false)}
          onConfirm={handleScheduleConfirm}
          isPending={createAction.isPending}
        />
      )}

      {/* Add Note Modal */}
      {noteOpen && (
        <NoteModal
          onClose={() => setNoteOpen(false)}
          onConfirm={handleNoteConfirm}
          isPending={createAction.isPending}
        />
      )}

      {/* Escalate Modal */}
      {escalateOpen && candidate && (
        <EscalateModal
          candidateName={candidate.name}
          onClose={() => setEscalateOpen(false)}
          onConfirm={handleEscalateConfirm}
          isPending={createAction.isPending}
        />
      )}
    </motion.div>
  );
}

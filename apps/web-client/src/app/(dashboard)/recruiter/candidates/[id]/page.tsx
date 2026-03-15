"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { RiskBadge } from "@/components/recruiter/RiskBadge";
import { SocialScreenModal } from "@/components/recruiter/SocialScreenModal";
import { getInitials, STAGE_ORDER } from "@/lib/recruiter-utils";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Mic,
  Code2,
  PenLine,
  RefreshCw,
  Globe,
  Zap,
  Calendar,
  Send,
  AlertTriangle,
  CheckCircle2,
  Star,
  ChevronDown,
  Sparkles,
  Check,
  Loader2,
  Cpu,
  ShieldAlert,
  X,
  ScanSearch,
} from "lucide-react";

type Tab = "overview" | "evidence" | "notes" | "actions";

const STAGE_LABELS: Record<string, string> = {
  fair: "In Queue",
  screen: "Screening",
  interview: "Interview",
  offer: "Offer",
  day1: "Day 1",
};

/* ─── Stage move steps (AI analysis context per transition) ── */
const STAGE_MOVE_STEPS: Record<string, { label: string; detail: string }[]> = {
  screen: [
    { label: "Evaluating fit score", detail: "Comparing against role benchmarks" },
    { label: "Flagging risk indicators", detail: "Scanning resume for inconsistencies" },
    { label: "Generating screening checklist", detail: "Tailoring questions to candidate strengths" },
    { label: "Moving to Screening", detail: "Pipeline stage updated" },
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

const ACTION_STEPS: Record<string, { label: string; sub: string }[]> = {
  sync_to_ats: [
    { label: "Formatting candidate record", sub: "Structuring data for ATS" },
    { label: "Authenticating with ATS", sub: "Verifying connection" },
    { label: "Syncing pipeline status", sub: "Record queued successfully" },
  ],
  schedule_interview: [
    { label: "Scanning interviewer calendars", sub: "Finding available windows" },
    { label: "Checking candidate availability", sub: "Cross-referencing time zones" },
    { label: "Generating calendar invite", sub: "Sending confirmation" },
  ],
  follow_up_email: [
    { label: "Reviewing conversation history", sub: "Personalizing message tone" },
    { label: "Drafting follow-up email", sub: "Tailoring to current stage" },
    { label: "Draft saved", sub: "Ready for your review" },
  ],
  send_rejection: [
    { label: "Preparing rejection notice", sub: "Crafting professional message" },
    { label: "Queuing for approval", sub: "Awaiting HR sign-off" },
    { label: "Action queued", sub: "Will send upon approval" },
  ],
  send_offer_email: [
    { label: "Generating offer letter", sub: "Pulling compensation package data" },
    { label: "Attaching offer documents", sub: "Terms, start date, and benefits" },
    { label: "Queued for approval", sub: "Awaiting final review before send" },
  ],
};

/* ─── Shared step list component ─────────────────────────── */
function CandidateProcessingSteps({
  steps,
  activeStep,
  accentColor = "#0e3d27",
}: {
  steps: { label: string; detail: string }[];
  activeStep: number;
  accentColor?: string;
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
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accentColor }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              ) : active ? (
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: accentColor }}>
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: accentColor }} />
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

/* ─── Stage Transition Overlay ───────────────────────────── */
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

  // Auto-advance steps 0→(n-2), last step waits for isDone
  useEffect(() => {
    if (step >= steps.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [step, steps.length]);

  // When mutation done and animation reached last step → success → close
  useEffect(() => {
    if (isDone && step >= steps.length - 1 && !showSuccess) {
      setShowSuccess(true);
      setTimeout(onClose, 900);
    }
  }, [isDone, step, steps.length, showSuccess, onClose]);

  const isOffer = targetStage === "offer";
  const isDay1 = targetStage === "day1";
  const accent = isOffer ? "#b45309" : isDay1 ? "#0d6873" : "#0e3d27";
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
                Moved to {STAGE_LABELS[targetStage] ?? targetStage}
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
                {STAGE_LABELS[targetStage] ?? targetStage}
              </span>
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <CandidateProcessingSteps steps={steps} activeStep={step} accentColor={accent} />
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

/* ─── Action Processing Banner (sidebar inline) ──────────── */
function ActionProcessingBanner({ actionType }: { actionType: string }) {
  const steps = ACTION_STEPS[actionType] ?? ACTION_STEPS.sync_to_ats;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= steps.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [step, steps.length]);

  const current = steps[step];
  return (
    <div className="mt-2 px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2">
      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] font-semibold text-primary leading-tight">{current?.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 animate-pulse">{current?.sub}</p>
      </div>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [noteText, setNoteText] = useState("");
  const [showStagePicker, setShowStagePicker] = useState(false);
  // Optimistic stage — null means "use server value"
  const [optimisticStage, setOptimisticStage] = useState<string | null>(null);
  // Stage transition overlay
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const [transitionDone, setTransitionDone] = useState(false);
  // Action processing banner
  const [pendingActionType, setPendingActionType] = useState<string | null>(null);
  // Risk banner + social screen
  const [riskBannerDismissed, setRiskBannerDismissed] = useState(false);
  const [socialScreenOpen, setSocialScreenOpen] = useState(false);
  const [openClawOpen, setOpenClawOpen] = useState(false);

  const { data: candidate, isLoading } = useQuery(
    trpc.recruiter.getCandidateWithEvidence.queryOptions({ id })
  );

  const { data: actions } = useQuery(
    trpc.recruiter.getActionsByCandidate.queryOptions({ candidateId: id })
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.recruiter.getCandidateWithEvidence.queryKey({ id }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.recruiter.getCandidates.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.recruiter.getActionsByCandidate.queryKey({ candidateId: id }),
    });
  };

  const updateStage = useMutation(
    trpc.recruiter.updateCandidateStage.mutationOptions({
      onMutate: () => {
        setShowStagePicker(false);
      },
      onSuccess: () => {
        invalidateAll();
        setTransitionDone(true);
      },
      onError: () => {
        setTransitionTarget(null);
        setTransitionDone(false);
        setOptimisticStage(null);
      },
    })
  );

  const handleStageMove = (stage: string) => {
    setTransitionTarget(stage);
    setTransitionDone(false);
    updateStage.mutate({ id, stage: stage as "fair" | "screen" | "interview" | "offer" | "day1" });
  };

  const handleTransitionClose = () => {
    if (transitionTarget) setOptimisticStage(transitionTarget);
    setTransitionTarget(null);
    setTransitionDone(false);
  };

  const createAction = useMutation(
    trpc.recruiter.createAction.mutationOptions({
      onSuccess: (action) => {
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getActionsByCandidate.queryKey({ candidateId: id }),
        });
        setPendingActionType(null);
        // Simulate action lifecycle: queued → success after 3s
        if (action?.id) {
          setTimeout(() => {
            markDone.mutate({ actionId: action.id });
          }, 3000);
        }
      },
      onError: () => setPendingActionType(null),
    })
  );

  const fireAction = (actionType: string, notes?: string) => {
    setPendingActionType(actionType);
    createAction.mutate({ candidateId: id, actionType: actionType as "sync_to_ats" | "follow_up_email" | "schedule_interview" | "move_stage" | "send_rejection" | "send_offer_email" | "request_evidence" | "escalate", notes });
  };

  const markDone = useMutation(
    trpc.recruiter.markFollowUpSent.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getActionsByCandidate.queryKey({ candidateId: id }),
        });
      },
    })
  );

  const [aiError, setAiError] = useState<string | null>(null);
  const scoreWithAI = useMutation(
    trpc.recruiter.scoreCandidate.mutationOptions({
      onSuccess: () => {
        setAiError(null);
        invalidateAll();
      },
      onError: (err) => {
        setAiError(err.message);
      },
    })
  );

  const runAIAnalysis = () => {
    if (!candidate) return;
    setAiError(null);
    // Compose a resume proxy from existing candidate data
    const resumeParts = [
      `Name: ${candidate.name}`,
      candidate.school ? `Education: ${candidate.school}` : "",
      candidate.role ? `Role: ${candidate.role}` : "",
      strengths.length > 0 ? `Strengths: ${strengths.join(", ")}` : "",
      gaps.length > 0 ? `Areas to develop: ${gaps.join(", ")}` : "",
      candidate.summary ? `Summary: ${candidate.summary}` : "",
    ].filter(Boolean).join("\n");

    const jobDescription = candidate.role
      ? `We are looking for a ${candidate.role}. Strong communication, technical depth, and team collaboration skills required.`
      : "Software engineering role requiring strong technical skills and communication.";

    scoreWithAI.mutate({
      candidateId: id,
      resume: resumeParts,
      jobDescription,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Candidate not found</p>
      </div>
    );
  }

  const displayStage = optimisticStage ?? candidate.stage ?? "fair";
  const initials = getInitials(candidate.name);
  const strengths: string[] = (candidate.strengths as string[]) ?? [];
  const gaps: string[] = (candidate.gaps as string[]) ?? [];
  const score = candidate.fitScore ?? 0;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  const evidenceList = (candidate as any).evidence ?? [];
  const resumeEvidence = evidenceList.filter((e: any) => e.type === "resume");
  const screenEvidence = evidenceList.filter((e: any) => e.type === "screen");
  const codeEvidence = evidenceList.filter((e: any) => e.type === "code");
  const essayEvidence = evidenceList.filter((e: any) => e.type === "essay");

  const currentStageIndex = STAGE_ORDER.indexOf(displayStage as typeof STAGE_ORDER[number]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "evidence", label: "Evidence" },
    { key: "notes", label: "Notes" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="space-y-4 w-full">

      {/* Back */}
      <motion.button
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </motion.button>

      {/* ── High-risk alert banner ── */}
      {candidate.riskLevel === "high" && !riskBannerDismissed && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">High Risk — Flagged for review</p>
            <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
              {gaps.length > 0
                ? `Key risk factors: ${gaps.slice(0, 3).join(" · ")}`
                : "This candidate has been flagged based on fit score and screening signals."}
            </p>
            <p className="text-xs text-red-600 mt-1.5">Use the actions panel on the right to run a Social Screen or send a rejection.</p>
          </div>
          <button onClick={() => setRiskBannerDismissed(true)} className="text-red-400 hover:text-red-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-5">
        {/* Left content */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="flex-1 space-y-4 min-w-0">

          {/* Header card */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{candidate.name}</h1>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <Star className="w-3 h-3" />
                    Priority
                  </span>
                  <RiskBadge risk={(candidate.riskLevel as "low" | "medium" | "high") ?? "low"} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {candidate.role ?? "Candidate"} · {candidate.school}
                </p>

                {/* Evidence tags */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {resumeEvidence.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      <FileText className="w-3 h-3" /> Resume
                    </span>
                  )}
                  {screenEvidence.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      <Mic className="w-3 h-3" /> Screen
                    </span>
                  )}
                  {codeEvidence.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      <Code2 className="w-3 h-3" /> Code
                    </span>
                  )}
                  {essayEvidence.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      <PenLine className="w-3 h-3" /> Essay
                    </span>
                  )}
                  {candidate.lane === "recruiter_now" && (
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">
                      Immediate
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
            {tabs.map((tab) => (
              <motion.button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.key === "actions" && actions && actions.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold bg-primary/20 text-primary px-1 py-0.5 rounded-full">
                    {actions.length}
                  </span>
                )}
              </motion.button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-3 gap-4">
              {/* Fit Score */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col items-center justify-center gap-3">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label={`Fit score: ${score} out of 100`}>
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="36"
                      fill="none" stroke="#2d6a4f" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground tabular-nums">{score}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">FIT</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Fit Score</p>
                  <RiskBadge risk={(candidate.riskLevel as "low" | "medium" | "high") ?? "low"} />
                </div>
              </div>

              {/* Key Strengths */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Strengths</p>
                {strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {strengths.slice(0, 4).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No strengths recorded yet</p>
                )}
              </div>

              {/* Gaps */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Gaps</p>
                {gaps.length > 0 ? (
                  <ul className="space-y-2">
                    {gaps.slice(0, 4).map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        {g}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No gaps recorded yet</p>
                )}
              </div>

              {/* Risk Breakdown — only shown for high-risk candidates */}
              {candidate.riskLevel === "high" && (
                <div className="col-span-3 bg-red-50 border border-red-200 rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <p className="text-sm font-semibold text-red-800">Risk Breakdown</p>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      HIGH RISK
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2">Fit Score Risk</p>
                      <p className="text-xs text-red-700 leading-relaxed">
                        Score of <span className="font-bold">{score}</span> is below the 70-point threshold.
                        {score < 60 ? " Well below minimum bar for this role." : " Borderline — requires human review."}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2">Skill Gaps</p>
                      <ul className="space-y-1">
                        {gaps.slice(0, 3).map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            {g}
                          </li>
                        ))}
                        {gaps.length === 0 && <li className="text-xs text-red-500">No specific gaps recorded</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2">Recommended Actions</p>
                      <ul className="space-y-1.5">
                        <li className="text-xs text-red-700 flex items-center gap-1.5">
                          <ScanSearch className="w-3 h-3 shrink-0" />
                          Run Social Screen to verify profile
                        </li>
                        <li className="text-xs text-red-700 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Request additional evidence
                        </li>
                        <li className="text-xs text-red-700 flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 shrink-0" />
                          Consider rejection or redirect lane
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {candidate.summary && (
                <div className="col-span-3 bg-card border border-border rounded-xl shadow-sm p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Assessment</p>
                  <p className="text-sm text-foreground leading-relaxed">{candidate.summary}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "evidence" && (
            <div className="space-y-4">
              {resumeEvidence.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Resume Highlights</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {strengths.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-foreground border border-border">
                        {s.length > 30 ? s.slice(0, 30) + "..." : s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {screenEvidence.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Mic className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Micro-Screen Highlights</p>
                  </div>
                  <div className="space-y-2">
                    {strengths.slice(0, 2).map((s, i) => (
                      <div key={i} className="text-sm text-primary italic px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
                        "{s}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {codeEvidence.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Code2 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Code Signals</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gaps.slice(0, 2).map((g, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {g.length > 35 ? g.slice(0, 35) + "..." : g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {evidenceList.length === 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm p-8 text-center">
                  <p className="text-sm text-muted-foreground">No evidence uploaded yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="bg-card border border-border rounded-xl shadow-sm p-5 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Strengths</p>
                <div className="text-sm text-foreground px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  {strengths.length > 0 ? strengths.join(", ") : "No strengths recorded"}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Concerns</p>
                <div className="text-sm text-foreground px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  {gaps.length > 0 ? gaps.join(", ") : "No concerns recorded"}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Next Step</p>
                <div className="text-sm text-foreground px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  {displayStage === "offer"
                    ? "Prepare competitive offer"
                    : displayStage === "interview"
                    ? "Schedule final round"
                    : displayStage === "screen"
                    ? "Complete technical screen"
                    : "Register at fair booth"}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Add a Note</p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full text-sm px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
                <button
                  onClick={() => setNoteText("")}
                  className="mt-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}

          {activeTab === "actions" && (
            <div className="space-y-3">
              {actions && actions.length > 0 ? (
                actions.map((action: any) => (
                  <div key={action.id} className="bg-card border border-border rounded-xl shadow-sm p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {action.actionType.replace(/_/g, " ")}
                      </p>
                      {action.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{action.notes}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(action.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      action.status === "success"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : action.status === "failed"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : action.status === "agent_active"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {action.status === "queued" ? "processing…" : action.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="bg-card border border-border rounded-xl shadow-sm p-8 text-center">
                  <p className="text-sm text-muted-foreground">No actions taken yet</p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Right sidebar */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="w-[220px] shrink-0 space-y-4">

          {/* Actions */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>

            {/* Run Social Screen */}
            <motion.button
              onClick={() => setSocialScreenOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full flex items-center gap-2 text-sm font-semibold py-2 px-3 rounded-lg"
              style={{ background: "linear-gradient(135deg, #0e3d27 0%, #1f6b43 100%)", color: "#fff" }}
            >
              <ScanSearch className="w-3.5 h-3.5" />
              Run Social Screen
            </motion.button>

            {/* Get Notified on Agent — OpenClaw */}
            <motion.button
              onClick={() => setOpenClawOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full flex flex-col items-start gap-0.5 py-2 px-3 rounded-lg border"
              style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
            >
              <span className="text-sm font-semibold text-[#15803d]">Get Notified on Agent</span>
              <span className="text-[10px] text-[#6b7280]">powered by GPT 5.4 Codex · OpenClaw</span>
            </motion.button>

            <motion.button
              onClick={() => fireAction("sync_to_ats")}
              disabled={createAction.isPending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2 px-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Zap className="w-3.5 h-3.5" />
              Sync to ATS
            </motion.button>
            <motion.button
              onClick={() => fireAction("schedule_interview")}
              disabled={createAction.isPending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full flex items-center gap-2 bg-muted text-foreground text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/70 transition-colors border border-border disabled:opacity-60"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule Interview
            </motion.button>
            <motion.button
              onClick={() => fireAction("follow_up_email")}
              disabled={createAction.isPending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full flex items-center gap-2 bg-muted text-foreground text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/70 transition-colors border border-border disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              Draft Follow-up
            </motion.button>

            {/* Action processing banner */}
            {pendingActionType && <ActionProcessingBanner actionType={pendingActionType} />}

            {/* Move Stage — dropdown picker */}
            <div className="relative">
              <button
                onClick={() => setShowStagePicker((v) => !v)}
                disabled={updateStage.isPending}
                className="w-full flex items-center justify-between gap-2 bg-muted text-foreground text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/70 transition-colors border border-border disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${updateStage.isPending ? "animate-spin" : ""}`} />
                  Move Stage
                </span>
                <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-0.5">
                  {STAGE_LABELS[displayStage] ?? displayStage}
                  <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              {showStagePicker && (
                <motion.div
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                >
                  {STAGE_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStageMove(s)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-muted transition-colors ${
                        s === displayStage ? "bg-primary/5 text-primary font-semibold" : "text-foreground"
                      }`}
                    >
                      {STAGE_LABELS[s]}
                      {s === displayStage && (
                        <span className="text-[9px] text-primary font-bold">CURRENT</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Approval Required */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approval Required</p>
            <button
              onClick={() => fireAction("send_rejection", "Rejection email queued for approval")}
              disabled={createAction.isPending}
              className="w-full flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium py-2 px-3 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Send Rejection
            </button>
            <button
              onClick={() => fireAction("send_offer_email", "Offer email queued for approval")}
              disabled={createAction.isPending}
              className="w-full flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium py-2 px-3 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Send Offer Email
            </button>
          </div>

          {/* Pipeline */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pipeline</p>
            <div className="flex gap-1 mb-2">
              {STAGE_ORDER.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= currentStageIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {STAGE_LABELS[displayStage] ?? displayStage}
            </p>
          </div>

          {/* Identity & Risk Scan */}
          <div
            className="rounded-xl shadow-sm p-4"
            style={
              candidate.riskLevel === "high"
                ? { background: "#fff1f2", border: "1px solid #fecdd3" }
                : { background: "var(--card)", border: "1px solid var(--border)" }
            }
          >
            <div className="flex items-center gap-2 mb-2">
              {candidate.riskLevel === "high" ? (
                <ShieldAlert className="w-4 h-4 text-red-600" />
              ) : (
                <Globe className="w-4 h-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold" style={{ color: candidate.riskLevel === "high" ? "#991b1b" : undefined }}>
                Identity & Risk Scan
              </p>
              {candidate.riskLevel === "high" && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">FLAGGED</span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: candidate.riskLevel === "high" ? "#b91c1c" : "var(--muted-foreground)" }}>
              {candidate.riskLevel === "high"
                ? "This candidate is high-risk. Run Social Screen to verify profile accuracy."
                : "Search public profiles, detect red flags and surface inconsistencies versus resume and fair interactions."}
            </p>
            <button
              onClick={() => setSocialScreenOpen(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
              style={
                candidate.riskLevel === "high"
                  ? { background: "#dc2626", color: "#fff" }
                  : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }
              }
            >
              <ScanSearch className="w-3.5 h-3.5" />
              {candidate.riskLevel === "high" ? "Run Social Screen" : "Run Web Scan"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Close stage picker on outside click */}
      {showStagePicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowStagePicker(false)}
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

      {/* OpenClaw Video Modal */}
      {openClawOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.82)" }}
          onClick={() => setOpenClawOpen(false)}
        >
          <div
            className="w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#0f0f1a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#2a2a3e" }}>
              <div>
                <p className="text-[13px] font-bold text-white">Internal OpenClaw Workflow Runner</p>
                <p className="text-[11px] text-[#9ca3af]">Syncs up with you once Agent starts to Screen</p>
              </div>
              <button onClick={() => setOpenClawOpen(false)} className="text-[#4b5563] hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <video
              src="/videos/OpenClawBot.mp4"
              autoPlay
              controls
              className="w-full"
              style={{ maxHeight: "80vh" }}
            />
          </div>
        </div>
      )}

      {/* Social Screen Modal */}
      {socialScreenOpen && candidate && (
        <SocialScreenModal
          candidateName={candidate.name}
          onClose={() => setSocialScreenOpen(false)}
        />
      )}
    </motion.div>
  );
}

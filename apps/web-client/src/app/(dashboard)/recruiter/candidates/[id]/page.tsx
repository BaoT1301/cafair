"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { RiskBadge } from "@/components/recruiter/RiskBadge";
import { StageBadge } from "@/components/recruiter/StageBadge";
import { getInitials, STAGE_ORDER } from "@/lib/recruiter-utils";
import { useState } from "react";
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
} from "lucide-react";

type Tab = "overview" | "evidence" | "notes" | "actions";

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [noteText, setNoteText] = useState("");

  const { data: candidate, isLoading } = useQuery(
    trpc.recruiter.getCandidateWithEvidence.queryOptions({ id })
  );

  const { data: actions } = useQuery(
    trpc.recruiter.getActionsByCandidate.queryOptions({ candidateId: id })
  );

  const createAction = useMutation(
    trpc.recruiter.createAction.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getActionsByCandidate.queryKey({ candidateId: id }),
        });
      },
    })
  );

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

  const currentStageIndex = STAGE_ORDER.indexOf((candidate.stage ?? "fair") as typeof STAGE_ORDER[number]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "evidence", label: "Evidence" },
    { key: "notes", label: "Notes" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <div className="max-w-[1200px] space-y-4">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex gap-5">
        {/* Left content */}
        <div className="flex-1 space-y-4 min-w-0">

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
                  {/* Priority badge */}
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <Star className="w-3 h-3" />
                    Priority
                  </span>
                  <RiskBadge risk={(candidate.riskLevel as "low" | "medium" | "high") ?? "low"} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {/* role name fallback */}
                  Head of AWS Cloud · {candidate.school}
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
                  {/* Lane badge */}
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
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-3 gap-4">
              {/* Fit Score */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col items-center justify-center gap-3">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label={`Fit score: ${score} out of 100`}>
                    <circle
                      cx="50" cy="50" r="36"
                      fill="none" stroke="#e5e7eb" strokeWidth="10"
                    />
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Key Strengths
                </p>
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Gaps
                </p>
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

              {/* Summary */}
              {candidate.summary && (
                <div className="col-span-3 bg-card border border-border rounded-xl shadow-sm p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    AI Assessment
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{candidate.summary}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "evidence" && (
            <div className="space-y-4">
              {/* Resume Highlights */}
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

              {/* Micro-Screen Highlights */}
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

              {/* Code Signals */}
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Strengths
                </p>
                <div className="text-sm text-foreground px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  {strengths.length > 0 ? strengths.join(", ") : "No strengths recorded"}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Concerns
                </p>
                <div className="text-sm text-foreground px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  {gaps.length > 0 ? gaps.join(", ") : "No concerns recorded"}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Next Step
                </p>
                <div className="text-sm text-foreground px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  {candidate.stage === "offer"
                    ? "Prepare competitive offer"
                    : candidate.stage === "interview"
                    ? "Schedule final round"
                    : candidate.stage === "screen"
                    ? "Complete technical screen"
                    : "Register at fair booth"}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Add a Note
                </p>
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
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      action.status === "success"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : action.status === "failed"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : action.status === "agent_active"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {action.status}
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
        </div>

        {/* Right sidebar */}
        <div className="w-[220px] shrink-0 space-y-4">

          {/* Actions */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </p>
            <button
              onClick={() =>
                createAction.mutate({
                  candidateId: id,
                  actionType: "sync_to_ats",
                })
              }
              className="w-full flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2 px-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Zap className="w-3.5 h-3.5" />
              Sync to ATS
            </button>
            <button
              onClick={() =>
                createAction.mutate({
                  candidateId: id,
                  actionType: "schedule_interview",
                })
              }
              className="w-full flex items-center gap-2 bg-muted text-foreground text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/70 transition-colors border border-border"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule Interview
            </button>
            <button
              onClick={() =>
                createAction.mutate({
                  candidateId: id,
                  actionType: "follow_up_email",
                })
              }
              className="w-full flex items-center gap-2 bg-muted text-foreground text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/70 transition-colors border border-border"
            >
              <Send className="w-3.5 h-3.5" />
              Draft Follow-up
            </button>
            <button className="w-full flex items-center gap-2 bg-muted text-foreground text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/70 transition-colors border border-border">
              <RefreshCw className="w-3.5 h-3.5" />
              Move Stage
            </button>
          </div>

          {/* Approval Required */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Approval Required
            </p>
            <button className="w-full flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium py-2 px-3 rounded-lg hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              Send Rejection
            </button>
            <button className="w-full flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium py-2 px-3 rounded-lg hover:bg-emerald-100 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Send Offer Email
            </button>
          </div>

          {/* Pipeline */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Pipeline
            </p>
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
            <p className="text-xs text-muted-foreground capitalize">{candidate.stage}</p>
          </div>

          {/* Identity & Risk Scan */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Identity & Risk Scan</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Search public profiles, detect red flags and surface inconsistencies versus resume and fair interactions. Only publicly available information is used.
            </p>
            <button className="mt-3 w-full text-xs font-medium py-1.5 px-3 rounded-lg border border-border bg-muted text-foreground hover:bg-muted/70 transition-colors">
              Run Web Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

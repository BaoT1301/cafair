"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap,
  Users,
  BarChart3,
  Send,
  ShieldCheck,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Brain,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

// ─── Risk Badge ─────────────────────────────────────────
function RiskBadge({ level }: { level: string | null }) {
  const cfg: Record<string, { color: string; icon: React.ElementType }> = {
    low: {
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      icon: CheckCircle,
    },
    medium: {
      color: "text-amber-600 bg-amber-50 border-amber-200",
      icon: AlertTriangle,
    },
    high: {
      color: "text-red-600 bg-red-50 border-red-200",
      icon: AlertTriangle,
    },
  };
  const c = cfg[level ?? "low"] ?? cfg.low;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${c.color}`}
    >
      <c.icon className="w-3 h-3" />
      {level}
    </span>
  );
}

// ─── Score Bar ──────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-500"
      : score >= 70
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums w-8 text-right">
        {score}
      </span>
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 1. AI Scoring Demo
// ═══════════════════════════════════════════════════════════
function AIScoringDemo() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [resume, setResume] = useState(
    "3 years Python, PyTorch, published NeurIPS paper, AWS certified, built ML pipelines at startup",
  );
  const [jobDesc, setJobDesc] = useState(
    "ML Engineer: requires Python, PyTorch, 2+ years production ML, AWS experience preferred",
  );
  const [candidateId, setCandidateId] = useState("");
  const [result, setResult] = useState<{
    fit_score: number;
    strengths: string[];
    gaps: string[];
    risk_level: string;
    summary: string;
    provider?: string;
  } | null>(null);

  // If there are real candidates, let users pick one
  const { data: candidates } = useQuery(
    trpc.recruiter.getCandidates.queryOptions(),
  );

  const scoreMutation = useMutation(
    trpc.recruiter.scoreCandidate.mutationOptions({
      onSuccess: (data) => {
        setResult({
          fit_score: data.fitScore ?? 0,
          strengths: (data.strengths as string[]) ?? [],
          gaps: (data.gaps as string[]) ?? [],
          risk_level: (data.riskLevel as string) ?? "medium",
          summary: (data.summary as string) ?? "",
        });
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getCandidates.queryKey(),
        });
      },
    }),
  );

  const handleScore = () => {
    if (!candidateId) return;
    setResult(null);
    scoreMutation.mutate({
      candidateId,
      resume,
      jobDescription: jobDesc,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Brain}
          title="AI Candidate Scoring"
          description="scoreCandidate mutation → LLM /api/score → DB update"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Candidate picker */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Candidate
          </label>
          {candidates && candidates.length > 0 ? (
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
            >
              <option value="">Select a candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.role ?? "No role"}
                </option>
              ))}
            </select>
          ) : (
            <Input
              placeholder="Candidate ID (seed your DB first)"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
            />
          )}
        </div>

        {/* Resume */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Resume Text
          </label>
          <textarea
            className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
          />
        </div>

        {/* Job Description */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Job Description
          </label>
          <textarea
            className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
          />
        </div>

        <Button
          onClick={handleScore}
          disabled={scoreMutation.isPending || !candidateId}
          className="w-full"
        >
          {scoreMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scoring via AI…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Score Candidate
            </>
          )}
        </Button>

        {scoreMutation.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {scoreMutation.error.message}
          </div>
        )}

        {result && (
          <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Fit Score
              </span>
              <RiskBadge level={result.risk_level} />
            </div>
            <ScoreBar score={result.fit_score} />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {result.summary}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                  Strengths
                </span>
                <ul className="mt-1 space-y-0.5">
                  {result.strengths.map((s, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1"
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                  Gaps
                </span>
                <ul className="mt-1 space-y-0.5">
                  {result.gaps.map((g, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. Dashboard Stats
// ═══════════════════════════════════════════════════════════
function StatsDemo() {
  const trpc = useTRPC();
  const { data: stats, isLoading } = useQuery(
    trpc.recruiter.getDashboardStats.queryOptions(),
  );

  const items = stats
    ? [
        {
          label: "Total Candidates",
          value: stats.totalCandidates,
          icon: Users,
        },
        { label: "In Queue", value: stats.inQueue, icon: BarChart3 },
        { label: "Interviewing", value: stats.inInterview, icon: Zap },
        { label: "Offers", value: stats.offers, icon: CheckCircle },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={BarChart3}
          title="Dashboard Stats"
          description="getDashboardStats query — live numbers"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {item.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. Candidate List (mini)
// ═══════════════════════════════════════════════════════════
function CandidateListDemo() {
  const trpc = useTRPC();
  const {
    data: candidates,
    isLoading,
    refetch,
  } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <SectionHeader
            icon={Users}
            title="Candidates"
            description="getCandidates query — sorted by fit score"
          />
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !candidates?.length ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No candidates yet. Run{" "}
            <code className="bg-muted px-1 rounded">npm run db:seed</code>{" "}
            first.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-70 overflow-y-auto">
            {candidates.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {(c.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {c.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {c.role ?? "No role"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.riskLevel && <RiskBadge level={c.riskLevel} />}
                  {c.fitScore != null && (
                    <span className="text-xs font-bold tabular-nums text-foreground w-6 text-right">
                      {c.fitScore}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. Actions Demo
// ═══════════════════════════════════════════════════════════
function ActionsDemo() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: actions, isLoading } = useQuery(
    trpc.recruiter.getActions.queryOptions(),
  );
  const { data: candidates } = useQuery(
    trpc.recruiter.getCandidates.queryOptions(),
  );

  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [actionType, setActionType] = useState<
    "sync_to_ats" | "follow_up_email" | "schedule_interview" | "move_stage"
  >("follow_up_email");

  const createAction = useMutation(
    trpc.recruiter.createAction.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getActions.queryKey(),
        });
      },
    }),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Send}
          title="Recruiter Actions"
          description="createAction mutation + getActions query"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create action form */}
        <div className="flex gap-2">
          <select
            className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-xs"
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
          >
            <option value="">Candidate…</option>
            {candidates?.slice(0, 10).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as typeof actionType)}
          >
            <option value="follow_up_email">Follow-up</option>
            <option value="sync_to_ats">Sync ATS</option>
            <option value="schedule_interview">Interview</option>
            <option value="move_stage">Move Stage</option>
          </select>
          <Button
            size="sm"
            disabled={!selectedCandidate || createAction.isPending}
            onClick={() =>
              createAction.mutate({
                candidateId: selectedCandidate,
                actionType,
              })
            }
          >
            {createAction.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Recent actions list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !actions?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No actions yet — create one above.
          </p>
        ) : (
          <div className="space-y-1 max-h-45 overflow-y-auto">
            {actions.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Send className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-foreground capitalize">
                    {a.actionType?.replace(/_/g, " ")}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    a.status === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : a.status === "queued"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// Page Layout
// ═══════════════════════════════════════════════════════════
export default function DemoPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">Feature Demo</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Live showcase of backend features — tRPC procedures, AI scoring, and
          recruiter actions.
        </p>
      </div>

      {/* AI Scoring — full width */}
      <AIScoringDemo />

      {/* Stats + Candidates side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatsDemo />
        <CandidateListDemo />
      </div>

      {/* Actions */}
      <ActionsDemo />

      {/* Feature checklist */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={ShieldCheck}
            title="Backend Features"
            description="All implemented tRPC procedures"
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              {
                name: "getCandidates",
                type: "query",
                desc: "List all candidates by fit score",
              },
              {
                name: "getCandidateById",
                type: "query",
                desc: "Single candidate details",
              },
              {
                name: "getCandidateWithEvidence",
                type: "query",
                desc: "Candidate + evidence files",
              },
              {
                name: "updateCandidateStage",
                type: "mutation",
                desc: "Move through pipeline stages",
              },
              {
                name: "updateCandidateLane",
                type: "mutation",
                desc: "Assign triage lane",
              },
              {
                name: "updateCandidateOwner",
                type: "mutation",
                desc: "Assign recruiter owner",
              },
              {
                name: "updateCandidateScore",
                type: "mutation",
                desc: "Manual score override",
              },
              {
                name: "scoreCandidate",
                type: "mutation",
                desc: "AI scoring via Nova/Gemini",
              },
              { name: "getRoles", type: "query", desc: "List job roles" },
              {
                name: "getEvents",
                type: "query",
                desc: "List career fair events",
              },
              {
                name: "getActiveEvent",
                type: "query",
                desc: "Current live event",
              },
              {
                name: "getDashboardStats",
                type: "query",
                desc: "Aggregated dashboard numbers",
              },
              {
                name: "getActions",
                type: "query",
                desc: "All recruiter actions",
              },
              {
                name: "getActionsByCandidate",
                type: "query",
                desc: "Actions for one candidate",
              },
              {
                name: "createAction",
                type: "mutation",
                desc: "Queue a new action",
              },
              {
                name: "markFollowUpSent",
                type: "mutation",
                desc: "Mark action as sent",
              },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-2 py-1">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <code className="text-[11px] font-mono text-foreground">
                  {p.name}
                </code>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    p.type === "query"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  {p.type}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

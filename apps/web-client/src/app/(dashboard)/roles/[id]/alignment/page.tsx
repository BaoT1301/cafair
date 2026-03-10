"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  TrendingUp,
  Trash2,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────── */
type Criterion = {
  criterion: string;
  type: string;
  weight: number;
  minReq: number;
  evidenceSource: string;
};
type Dealbreaker = { rule: string; triggerCondition: string; action: string };
type Thresholds = {
  advance: number;
  review: number;
  reject: number;
  autoReject: boolean;
};
type ExperienceRange = { min: number; max: number; autoReject: boolean };
type Round = { id: string; name: string; count: number };

const DEFAULT_ROUNDS: Round[] = [
  { id: "shortlist",  name: "Shortlisted (by AI)",   count: 20 },
  { id: "phone",      name: "Phone Screen",           count: 10 },
  { id: "technical",  name: "Technical Interview",    count: 5  },
];

/* ─── Input Style ────────────────────────────────────────────── */
const inputCls =
  "bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors";

const selectCls =
  "bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43] appearance-none cursor-pointer";

/* ─── Section Card ───────────────────────────────────────────── */
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[16px] p-6 flex flex-col gap-8 w-full ${className}`}>
      {children}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function RoleAlignmentPage() {
  const params = useParams();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const roleId = params.id as string;

  const { data: role, isLoading } = useQuery(
    trpc.recruiter.getRoleById.queryOptions({ id: roleId }),
  );

  const saveMutation = useMutation(
    trpc.recruiter.saveRoleAlignment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.recruiter.getRoles.queryOptions().queryKey });
        queryClient.invalidateQueries({ queryKey: trpc.recruiter.getRoleById.queryOptions({ id: roleId }).queryKey });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      },
    }),
  );

  /* ─── State ──────────────────────────────────────────────── */
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [expRange, setExpRange] = useState<ExperienceRange>({ min: 3, max: 7, autoReject: false });
  const [dealbreakers, setDealbreakers] = useState<Dealbreaker[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>({ advance: 80, review: 65, reject: 65, autoReject: false });
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [riskTolerance, setRiskTolerance] = useState(42);
  const [rounds, setRounds] = useState<Round[]>(DEFAULT_ROUNDS);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [initialized, setInitialized] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  /* ─── Init from DB ───────────────────────────────────────── */
  if (role && !initialized) {
    setTitle(role.title ?? "");
    setJobDescription(role.jobDescription ?? "");
    const dbCriteria = (role.criteria as Criterion[]) ?? [];
    setCriteria(dbCriteria);
    if (dbCriteria.length > 0) setAiGenerated(true);
    setExpRange((role.experienceRange as ExperienceRange) ?? { min: 3, max: 7, autoReject: false });
    setDealbreakers((role.dealbreakers as Dealbreaker[]) ?? []);
    setThresholds((role.thresholds as Thresholds) ?? { advance: 80, review: 65, reject: 65, autoReject: false });
    setFocusAreas(role.interviewFocusAreas ?? []);
    setRiskTolerance(role.riskTolerance ?? 42);
    setInitialized(true);
  }

  /* ─── Save ───────────────────────────────────────────────── */
  const handleSave = useCallback(() => {
    setSaveStatus("saving");
    // Persist shortlist limit so Candidate Queue can read it
    if (rounds[0]) {
      localStorage.setItem("shortlist-limit", String(rounds[0].count));
    }
    saveMutation.mutate({
      id: roleId,
      title,
      jobDescription,
      criteria,
      experienceRange: expRange,
      dealbreakers,
      thresholds,
      interviewFocusAreas: focusAreas,
      riskTolerance,
    });
  }, [roleId, title, jobDescription, criteria, expRange, dealbreakers, thresholds, focusAreas, riskTolerance, rounds, saveMutation]);

  /* ─── Generate AI Criteria (stub) ────────────────────────── */
  const handleGenerateCriteria = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      setCriteria([
        { criterion: "System Design",      type: "Technical",  weight: 25, minReq: 3, evidenceSource: "Interview, Micro-screen" },
        { criterion: "Python Backend",     type: "Technical",  weight: 25, minReq: 3, evidenceSource: "Resume, Micro-screen" },
        { criterion: "Stakeholder Communication", type: "Soft Skill", weight: 15, minReq: 2, evidenceSource: "Interview transcript" },
        { criterion: "Cloud (AWS)",        type: "Technical",  weight: 10, minReq: 0, evidenceSource: "Resume" },
        { criterion: "Leadership/Roadmap", type: "Soft Skill", weight: 10, minReq: 0, evidenceSource: "Interview" },
        { criterion: "Domain Exposure",    type: "Domain",     weight: 5,  minReq: 0, evidenceSource: "Resume" },
      ]);
      setDealbreakers([
        { rule: "No work authorization",            triggerCondition: "Work auth status = not authorized",     action: "Auto-reject" },
        { rule: "Policy violation based on company", triggerCondition: "Ethical breach ≥ GPA threshold",       action: "Flag" },
        { rule: "Negative employment/misconduct history", triggerCondition: "Gap > 1 year with no explanation", action: "Flag" },
      ]);
      setFocusAreas([
        "Technical proficiency",
        "Code quality & architecture",
        "System Design thinking",
        "Communication & collaboration",
      ]);
      setExpRange({ min: 3, max: 7, autoReject: false });
      setThresholds({ advance: 80, review: 65, reject: 65, autoReject: false });
      setRiskTolerance(42);
      setGenerating(false);
      setAiGenerated(true);
    }, 1500);
  }, []);

  /* ─── Scoring Preview ────────────────────────────────────── */
  const exampleScores = criteria.map((c, i) => {
    const scores = [4, 3, 4, 0, 0, 3];
    const score = scores[i] ?? Math.floor(Math.random() * 3) + 2;
    return { ...c, score, weighted: Math.round(score * (c.weight / 100) * 20) };
  });
  const totalScore = exampleScores.reduce((sum, s) => sum + s.weighted, 0);

  const toleranceLabel =
    riskTolerance < 30 ? "Conservative" : riskTolerance < 70 ? "Balanced" : "Aggressive";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header card ── */}
      <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] px-4 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/roles"
              className="flex items-center gap-1 px-2 py-[5px] rounded-[8px] text-[14px] font-medium text-[#111827] leading-5 hover:bg-[#e2e8e5] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              Back
            </Link>
            <div className="flex flex-col gap-1">
              <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.006em]">
                Role Alignment Setup
              </h1>
              <p className="text-[14px] font-normal text-[#6b7280] leading-5 tracking-[-0.015em]">
                Define what &ldquo;good&rdquo; looks like before candidates arrive. Takes ~5 minutes.
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            {saveStatus === "saved" ? "Saved!" : "Save & Publish"}
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] flex-1 min-h-0 overflow-y-auto px-[60px] py-[30px]">
        <div className="flex flex-col gap-[42px] items-center w-full">

          {/* ── Position Details + Buttons ── */}
          <SectionCard>
            {/* Position Details header */}
            <div className="flex flex-col gap-6">
              <h2 className="text-[18px] font-semibold text-[#0e3d27] leading-7">
                Position Details
              </h2>

              {/* Position Title */}
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#4b5563] leading-[14px]">
                  Position Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className={`${inputCls} max-w-[448px]`}
                />
                <p className="text-[12px] text-[#4b5563] leading-4">
                  This will appear on all candidate cards and communications
                </p>
              </div>

              {/* Job Description */}
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#4b5563] leading-[14px]">
                  Job Description
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here, or write a brief overview of the role, responsibilities, and requirements..."
                  className="bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] w-full min-h-[200px] px-3 py-2 text-[14px] text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors resize-y"
                />
                <p className="text-[12px] text-[#4b5563] leading-4">
                  The AI will analyze this to suggest alignment criteria below
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-6">
              <button
                onClick={handleGenerateCriteria}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-opacity"
                style={{ background: "linear-gradient(173deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 shrink-0" />
                )}
                Generate Criteria with AI
              </button>
              <button
                onClick={() => {
                  setCriteria((prev) => [
                    ...prev,
                    { criterion: "", type: "Technical", weight: 10, minReq: 0, evidenceSource: "" },
                  ]);
                  setAiGenerated(true);
                }}
                className="h-10 px-[17px] py-[13px] rounded-[14px] border border-[#0e3d27] text-[14px] font-normal text-[#0e3d27] leading-5 tracking-[-0.015em] shadow-[0px_4px_12px_0px_rgba(46,139,87,0.25)] disabled:opacity-50 transition-opacity hover:bg-[#e8f5ee] whitespace-nowrap"
              >
                Set Criteria Manually
              </button>
            </div>
          </SectionCard>

          {/* ── Success Profile ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Success Profile
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  Define what a strong candidate looks like for this role
                </p>
              </div>

              {/* Table */}
              <div className="flex flex-col w-full overflow-x-auto">
                {/* Header row */}
                <div className="bg-[#f7f7f7] flex items-center justify-between pl-5 rounded-t-[8px]">
                  <div className="flex items-center justify-center px-[10px] py-6 w-[250px]">
                    <span className="text-[12px] font-semibold text-[#0e3d27] tracking-[0.3px] uppercase">Criterion</span>
                  </div>
                  <div className="flex items-center justify-center p-6 w-[180px]">
                    <span className="text-[12px] font-semibold text-[#0e3d27] tracking-[0.3px] uppercase">Type</span>
                  </div>
                  <div className="flex items-center justify-center p-6 w-[150px]">
                    <span className="text-[12px] font-semibold text-[#0e3d27] tracking-[0.3px] uppercase">Weight</span>
                  </div>
                  <div className="flex items-center justify-center px-6 py-[15px] w-[130px]">
                    <span className="text-[12px] font-semibold text-[#0e3d27] tracking-[0.3px] uppercase text-center leading-[18px]">Min Requirement</span>
                  </div>
                  <div className="flex items-center justify-center p-6 w-[220px]">
                    <span className="text-[12px] font-semibold text-[#0e3d27] tracking-[0.3px] uppercase">Evidence Source</span>
                  </div>
                  <div className="w-[84px]" />
                </div>

                {/* Body rows */}
                {criteria.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between pl-5 border-b-[1.25px] border-[#e2e8e5]"
                  >
                    {/* Criterion */}
                    <div className="flex flex-col items-start px-[10px] py-[17px] w-[250px]">
                      <input
                        value={c.criterion}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[i] = { ...next[i], criterion: e.target.value };
                          setCriteria(next);
                        }}
                        placeholder="e.g. System Design"
                        className={inputCls}
                      />
                    </div>
                    {/* Type */}
                    <div className="flex flex-col items-start px-6 py-[17px] w-[180px]">
                      <select
                        value={c.type}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[i] = { ...next[i], type: e.target.value };
                          setCriteria(next);
                        }}
                        className={selectCls}
                      >
                        <option value="Technical">Technical</option>
                        <option value="Soft Skill">Soft Skill</option>
                        <option value="Domain">Domain</option>
                        <option value="Behavioral">Behavioral</option>
                      </select>
                    </div>
                    {/* Weight */}
                    <div className="flex flex-col items-start px-6 py-[17px] w-[150px]">
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="number"
                          value={c.weight}
                          min={0}
                          max={100}
                          onChange={(e) => {
                            const next = [...criteria];
                            next[i] = { ...next[i], weight: Number(e.target.value) };
                            setCriteria(next);
                          }}
                          className="bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 flex-1 px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43] text-center"
                        />
                        <span className="text-[13px] text-[#6b7280]">%</span>
                      </div>
                    </div>
                    {/* Min Requirement */}
                    <div className="flex flex-col items-start px-6 py-[17px] w-[130px]">
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="number"
                          value={c.minReq}
                          min={0}
                          max={5}
                          onChange={(e) => {
                            const next = [...criteria];
                            next[i] = { ...next[i], minReq: Number(e.target.value) };
                            setCriteria(next);
                          }}
                          className="bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 w-10 px-2 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43] text-center"
                        />
                        <span className="text-[13px] text-[#6b7280]">/ 5</span>
                      </div>
                    </div>
                    {/* Evidence Source */}
                    <div className="flex flex-col items-start px-[10px] w-[220px]">
                      <input
                        value={c.evidenceSource}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[i] = { ...next[i], evidenceSource: e.target.value };
                          setCriteria(next);
                        }}
                        placeholder="e.g. Interview, Resume"
                        className={inputCls}
                      />
                    </div>
                    {/* Delete */}
                    <div className="flex flex-col items-start px-6 py-[19px] w-[84px]">
                      <button
                        onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}
                        className="h-8 w-full rounded-[8px] flex items-center justify-center text-[#9ca3af] hover:text-[#991b1b] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add Criterion */}
                <div className="pt-4">
                  <button
                    onClick={() =>
                      setCriteria([...criteria, { criterion: "", type: "Technical", weight: 10, minReq: 0, evidenceSource: "" }])
                    }
                    className="flex items-center gap-2 text-[13px] font-medium text-[#111827] hover:text-[#0e3d27] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Criterion
                  </button>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Interview Rounds ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Interview Rounds
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  Set up your hiring funnel. The AI will shortlist the top candidates and route them through each round.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {rounds.map((round, idx) => (
                  <div
                    key={round.id}
                    className="flex items-center gap-3 bg-[#f7f7f7] border-[1.25px] border-[#e2e8e5] rounded-[10px] px-4 py-3"
                  >
                    {/* Round index */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)" }}
                    >
                      {idx + 1}
                    </div>

                    {/* Round name */}
                    <input
                      type="text"
                      value={round.name}
                      onChange={(e) =>
                        setRounds(rounds.map((r) => r.id === round.id ? { ...r, name: e.target.value } : r))
                      }
                      placeholder="Round name (e.g. Phone Screen)"
                      className="flex-1 h-9 bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] px-3 text-[14px] text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors"
                    />

                    {/* Candidate count */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] text-[#6b7280] whitespace-nowrap">
                        {idx === 0 ? "Shortlist" : "Take"}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={round.count}
                        onChange={(e) =>
                          setRounds(rounds.map((r) => r.id === round.id ? { ...r, count: parseInt(e.target.value) || 1 } : r))
                        }
                        className="w-16 h-9 bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] px-2 text-[14px] text-[#111827] text-center outline-none focus:border-[#1f6b43] transition-colors"
                      />
                      <span className="text-[13px] text-[#6b7280] whitespace-nowrap">candidates</span>
                    </div>

                    {/* Remove button (not on first round) */}
                    {rounds.length > 1 && (
                      <button
                        onClick={() => setRounds(rounds.filter((r) => r.id !== round.id))}
                        className="text-[#9ca3af] hover:text-[#991b1b] transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add round */}
                <button
                  onClick={() =>
                    setRounds([...rounds, { id: `round-${Date.now()}`, name: "", count: 5 }])
                  }
                  className="flex items-center gap-2 text-[13px] font-medium text-[#0e3d27] hover:text-[#1f6b43] transition-colors self-start"
                >
                  <Plus className="w-4 h-4" />
                  Add round
                </button>
              </div>

              {/* Shortlist summary banner */}
              {rounds[0] && (
                <div className="flex items-center gap-2 bg-[#e8f5ee] rounded-[10px] px-4 py-3">
                  <span className="text-[13px] text-[#0e3d27]">
                    AI will automatically shortlist the top{" "}
                    <span className="font-bold">{rounds[0].count}</span>{" "}
                    candidates from your candidate pool
                  </span>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Experience Range ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Experience Range
                </h2>
                <p className="text-[14px] text-[#4b5563] leading-5">
                  Years of relevant experience you&rsquo;re targeting. This filters candidates early.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  {/* Min */}
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#4b5563]">Minimum</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={0}
                        max={15}
                        value={expRange.min}
                        onChange={(e) => setExpRange({ ...expRange, min: Number(e.target.value) })}
                        className="flex-1 accent-[#1f6b43] h-4"
                        style={{
                          background: `linear-gradient(to right, #2e8b57 0%, #1f6b43 ${(expRange.min / 15) * 100}%, #e2e8e5 ${(expRange.min / 15) * 100}%, #e2e8e5 100%)`,
                          borderRadius: "999px",
                          cursor: "pointer",
                        }}
                      />
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[18px] font-semibold text-[#111827]">{expRange.min}</span>
                        <span className="text-[14px] text-[#6b7280]">yrs</span>
                      </div>
                    </div>
                  </div>
                  {/* Max */}
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#4b5563]">Maximum</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={expRange.max}
                        onChange={(e) => setExpRange({ ...expRange, max: Number(e.target.value) })}
                        className="flex-1 h-4"
                        style={{
                          background: `linear-gradient(to right, #2e8b57 0%, #1f6b43 ${(expRange.max / 20) * 100}%, #e2e8e5 ${(expRange.max / 20) * 100}%, #e2e8e5 100%)`,
                          borderRadius: "999px",
                          cursor: "pointer",
                          accentColor: "#0e3d27",
                        }}
                      />
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[18px] font-semibold text-[#111827]">{expRange.max}</span>
                        <span className="text-[14px] text-[#6b7280]">yrs</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3">
                  <p className="text-[14px] text-[#4b5563]">
                    Target range:{" "}
                    <span className="font-semibold text-[#4b5563]">
                      {expRange.min}–{expRange.max} years
                    </span>
                  </p>
                </div>

                <p className="text-[12px] text-[#6b7280]">
                  Input type: Dual range slider · Default: 3–7 years
                </p>

                {/* Auto-reject checkbox */}
                <label className="flex items-center gap-3 text-[13px] font-medium text-[#111827] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expRange.autoReject}
                    onChange={(e) => setExpRange({ ...expRange, autoReject: e.target.checked })}
                    className="w-4 h-4 rounded border border-[#111827] accent-[#1f6b43]"
                  />
                  Auto-reject candidates outside the range (requires recruiter batch approval)
                </label>
              </div>
            </SectionCard>
          )}

          {/* ── Dealbreakers ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="border-b-[1.25px] border-[#f7f7f7] pb-0 flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Dealbreakers
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  Conditions that automatically disqualify candidates
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {dealbreakers.map((d, i) => (
                  <div key={i} className="bg-[#f7f7f7] rounded-[10px] p-[17px] flex flex-col gap-3">
                    <div className="flex items-start gap-4">
                      {/* Rule */}
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-[12px] font-medium text-[#111827]">Rule</label>
                        <input
                          value={d.rule}
                          onChange={(e) => {
                            const next = [...dealbreakers];
                            next[i] = { ...next[i], rule: e.target.value };
                            setDealbreakers(next);
                          }}
                          className="bg-white border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]"
                        />
                      </div>
                      {/* Trigger */}
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-[12px] font-medium text-[#111827]">Trigger Condition</label>
                        <input
                          value={d.triggerCondition}
                          onChange={(e) => {
                            const next = [...dealbreakers];
                            next[i] = { ...next[i], triggerCondition: e.target.value };
                            setDealbreakers(next);
                          }}
                          className="bg-white border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]"
                        />
                      </div>
                      {/* Action */}
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-[12px] font-medium text-[#111827]">Action</label>
                        <select
                          value={d.action}
                          onChange={(e) => {
                            const next = [...dealbreakers];
                            next[i] = { ...next[i], action: e.target.value };
                            setDealbreakers(next);
                          }}
                          className="bg-white border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]"
                        >
                          <option value="Auto-reject">Auto-reject</option>
                          <option value="Flag">Flag</option>
                          <option value="Review">Review</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => setDealbreakers(dealbreakers.filter((_, j) => j !== i))}
                      className="flex items-center gap-1 text-[12px] font-medium text-[#6b7280] hover:text-[#991b1b] transition-colors self-start"
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setDealbreakers([...dealbreakers, { rule: "", triggerCondition: "", action: "Auto-reject" }])}
                  className="flex items-center gap-2 text-[13px] font-medium text-[#111827] hover:text-[#0e3d27] transition-colors self-start"
                >
                  <Plus className="w-4 h-4" />
                  Add Dealbreaker
                </button>
              </div>
            </SectionCard>
          )}

          {/* ── Decision Thresholds ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Decision Thresholds
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  Define when candidates should advance or be rejected
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Score / Advance */}
                <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1f6b43]" />
                    <span className="text-[14px] font-semibold text-[#111827]">Score</span>
                  </div>
                  <p className="text-[12px] text-[#6b7280]">Score threshold</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] text-[#6b7280]">≥</span>
                    <input
                      type="number"
                      value={thresholds.advance}
                      onChange={(e) => setThresholds({ ...thresholds, advance: Number(e.target.value) })}
                      className="bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-16 px-2 text-[14px] font-semibold text-[#111827] text-center outline-none focus:border-[#1f6b43]"
                    />
                  </div>
                  <p className="text-[12px] text-[#6b7280]">
                    AND all must-have criteria pass minimum requirement
                  </p>
                </div>

                {/* Recruiter / Review */}
                <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#92400e]" />
                    <span className="text-[14px] font-semibold text-[#111827]">Recruiter</span>
                  </div>
                  <p className="text-[12px] text-[#6b7280]">Score range</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={thresholds.review}
                      onChange={(e) => setThresholds({ ...thresholds, review: Number(e.target.value) })}
                      className="bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-16 px-2 text-[14px] font-semibold text-[#111827] text-center outline-none focus:border-[#1f6b43]"
                    />
                    <span className="text-[13px] text-[#6b7280]">to {thresholds.advance - 1}</span>
                  </div>
                </div>

                {/* Reject */}
                <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-[#991b1b]" />
                    <span className="text-[14px] font-semibold text-[#111827]">Reject</span>
                  </div>
                  <p className="text-[12px] text-[#6b7280]">Score threshold</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] text-[#6b7280]">&lt;</span>
                    <input
                      type="number"
                      value={thresholds.reject}
                      onChange={(e) => setThresholds({ ...thresholds, reject: Number(e.target.value) })}
                      className="bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-16 px-2 text-[14px] font-semibold text-[#111827] text-center outline-none focus:border-[#1f6b43]"
                    />
                  </div>
                  <p className="text-[12px] text-[#6b7280]">OR dealbreaker triggered</p>
                </div>
              </div>

              <label className="flex items-center gap-3 text-[13px] font-medium text-[#111827] cursor-pointer">
                <input
                  type="checkbox"
                  checked={thresholds.autoReject}
                  onChange={(e) => setThresholds({ ...thresholds, autoReject: e.target.checked })}
                  className="w-4 h-4 rounded border border-[#111827] accent-[#1f6b43]"
                />
                Auto-reject candidates below threshold (requires recruiter batch approval)
              </label>
            </SectionCard>
          )}

          {/* ── Interview Focus Areas ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Interview Focus Areas
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  Key topics for interview prompts. The AI uses these to generate question guides.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {focusAreas.map((area, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)" }}
                    >
                      {i + 1}
                    </div>
                    <input
                      value={area}
                      onChange={(e) => {
                        const next = [...focusAreas];
                        next[i] = e.target.value;
                        setFocusAreas(next);
                      }}
                      className="flex-1 bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]"
                    />
                    <button
                      onClick={() => setFocusAreas(focusAreas.filter((_, j) => j !== i))}
                      className="text-[#9ca3af] hover:text-[#991b1b] transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setFocusAreas([...focusAreas, ""])}
                  className="flex items-center gap-2 text-[13px] font-medium text-[#111827] hover:text-[#0e3d27] transition-colors self-start"
                >
                  <Plus className="w-4 h-4" />
                  Add Focus Area
                </button>
                <p className="text-[12px] text-[#6b7280]">
                  Recommended: 3–5 areas
                </p>
              </div>
            </SectionCard>
          )}

          {/* ── Risk Tolerance ── */}
          {aiGenerated && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Risk Tolerance
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  Conservative = proven track record only. Aggressive = willing to bet on potential.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(Number(e.target.value))}
                    className="flex-1 h-4"
                    style={{
                      background: `linear-gradient(to right, #2e8b57 0%, #1f6b43 ${riskTolerance}%, #e2e8e5 ${riskTolerance}%, #e2e8e5 100%)`,
                      borderRadius: "999px",
                      cursor: "pointer",
                      accentColor: "#0e3d27",
                    }}
                  />
                  <span className="text-[18px] font-bold text-[#111827] w-14 text-right">
                    {riskTolerance}%
                  </span>
                </div>
                <p className="text-[14px] text-[#4b5563] leading-5">
                  <span className="font-semibold text-[#0e3d27]">{toleranceLabel}:</span>{" "}
                  {riskTolerance < 30
                    ? "AI considers only proven track record."
                    : riskTolerance < 70
                      ? "AI considers both proven experience and high-potential candidates."
                      : "AI is willing to bet on potential and upside."}
                </p>
                <p className="text-[12px] text-[#6b7280]">
                  Applies to candidate scoring logic · Default: 50% (balanced)
                </p>
              </div>
            </SectionCard>
          )}

          {/* ── Scoring Logic Preview ── */}
          {aiGenerated && criteria.length > 0 && (
            <SectionCard>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">
                  Scoring Logic Preview
                </h2>
                <p className="text-[13px] text-[#6b7280] leading-5">
                  See how the AI calculates fit scores based on your configuration
                </p>
              </div>

              <div className="flex gap-6">
                {/* Formula + breakdown */}
                <div className="flex-1 bg-[#f7f7f7] rounded-[14px] p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0e3d27]" />
                    <span className="text-[14px] font-semibold text-[#0e3d27]">Formula</span>
                  </div>
                  <p className="text-[13px] text-[#6b7280]">
                    Fit Score (0–100) = Sum of (criterion score × weight)
                  </p>
                  <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-medium text-[#0e3d27]">Example Breakdown:</p>
                    {exampleScores.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <span className="text-[#4b5563]">
                          {s.criterion}: {s.score}/5 × {s.weight}%
                        </span>
                        <span className="font-semibold text-[#111827]">= {s.weighted}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-[14px] font-bold text-[#0e3d27] border-t border-[#e2e8e5] pt-2 mt-1">
                      <span>Final Score</span>
                      <span>{totalScore}</span>
                    </div>
                  </div>
                </div>
                {/* Note */}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-[13px] text-[#6b7280] leading-6">
                    This is a preview using sample scores. Actual candidate scores will be calculated using real evidence from resumes, interviews, and micro-screens.
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Bottom actions ── */}
          <div className="flex items-center justify-between w-full pt-2 pb-4">
            <Link
              href="/roles"
              className="text-[14px] font-medium text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Save className="w-4 h-4 shrink-0" />
              )}
              {saveStatus === "saved" ? "Saved!" : "Save & Publish"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

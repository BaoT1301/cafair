"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  Plus,
  X as XIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────── */
type Round = { id: string; name: string; count: number };
type Criterion = { criterion: string; type: string; weight: number; minReq: number; evidenceSource: string };
type Dealbreaker = { rule: string; triggerCondition: string; action: string };
type Thresholds = { advance: number; review: number; reject: number; autoReject: boolean };
type ExperienceRange = { min: number; max: number; autoReject: boolean };

const DEFAULT_ROUNDS: Round[] = [
  { id: "shortlist",  name: "Shortlisted (by AI)",  count: 20 },
  { id: "phone",      name: "Phone Screen",          count: 10 },
  { id: "technical",  name: "Technical Interview",   count: 5  },
];

/* ─── Shared styles ──────────────────────────────────────────── */
const inputCls =
  "bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors";

const selectCls =
  "bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43] appearance-none cursor-pointer";

/* ─── Section Card ───────────────────────────────────────────── */
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[16px] p-6 flex flex-col gap-8 w-full">
      {children}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function NewRoleAlignmentPage() {
  const trpc        = useTRPC();
  const router      = useRouter();
  const queryClient = useQueryClient();

  /* ── Form state ── */
  const [title,          setTitle]          = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [rounds,         setRounds]         = useState<Round[]>(DEFAULT_ROUNDS);
  const [criteria,       setCriteria]       = useState<Criterion[]>([]);
  const [expRange,       setExpRange]       = useState<ExperienceRange>({ min: 3, max: 7, autoReject: false });
  const [dealbreakers,   setDealbreakers]   = useState<Dealbreaker[]>([]);
  const [thresholds,     setThresholds]     = useState<Thresholds>({ advance: 80, review: 65, reject: 65, autoReject: false });
  const [focusAreas,     setFocusAreas]     = useState<string[]>([]);
  const [riskTolerance,  setRiskTolerance]  = useState(42);
  const [aiGenerated,    setAiGenerated]    = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [aiError,        setAiError]        = useState<string | null>(null);

  /* ── Mutations ── */
  const generateMutation = useMutation(trpc.recruiter.generateRoleAlignment.mutationOptions());

  const createMutation = useMutation(
    trpc.recruiter.createRole.mutationOptions({
      onSuccess: () => {
        if (rounds[0]) localStorage.setItem("shortlist-limit", String(rounds[0].count));
        queryClient.invalidateQueries({ queryKey: trpc.recruiter.getRoles.queryOptions().queryKey });
        router.push("/recruiter/roles");
      },
    }),
  );

  /* ── Generate criteria inline (no navigation) ── */
  const handleGenerate = useCallback(async () => {
    if (!jobDescription.trim()) {
      setAiError("Please paste a job description first.");
      return;
    }
    setGenerating(true);
    setAiError(null);
    try {
      const result = await generateMutation.mutateAsync({
        jobDescription,
        roleTitle: title || "This role",
      });

      const total = result.criteria.reduce((s, c) => s + c.weight, 0);
      setCriteria(
        result.criteria.map((c) => ({
          criterion:      c.name,
          type:           c.mustHave ? "Technical" : "Soft Skill",
          weight:         Math.round((c.weight / total) * 100),
          minReq:         c.mustHave ? 3 : 0,
          evidenceSource: "Resume, Interview",
        })),
      );
      setDealbreakers(
        result.dealbreakers.map((rule) => ({
          rule,
          triggerCondition: "Auto-evaluated by Nova AI",
          action:           "Flag",
        })),
      );
      setFocusAreas(result.interviewFocusAreas);
      setExpRange(result.experienceRange);
      setThresholds(result.thresholds);
      setRiskTolerance(result.riskTolerance);
      setAiGenerated(true);
    } catch (err: any) {
      const msg: string = err?.message ?? "AI analysis failed";
      setAiError(
        msg.includes("LLM service") || msg.includes("fetch") || msg.includes("ECONNREFUSED")
          ? "Could not reach AI — make sure the LLM service is running (cd apps/llm && npm run dev)"
          : msg,
      );
    } finally {
      setGenerating(false);
    }
  }, [jobDescription, title, generateMutation]);

  /* ── Save & Publish ── */
  const handlePublish = () => {
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), jobDescription: jobDescription.trim() || undefined });
  };

  const isSaving = createMutation.isPending;

  /* ── Scoring preview ── */
  const exampleScores = criteria.map((c, i) => {
    const scores = [4, 3, 4, 0, 0, 3];
    const score  = scores[i] ?? Math.floor(Math.random() * 3) + 2;
    return { ...c, score, weighted: Math.round(score * (c.weight / 100) * 20) };
  });
  const totalScore    = exampleScores.reduce((s, x) => s + x.weighted, 0);
  const toleranceLabel = riskTolerance < 30 ? "Conservative" : riskTolerance < 70 ? "Balanced" : "Aggressive";

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header ── */}
      <div className="bg-[#f7f7f7] rounded-[16px] px-4 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/recruiter/roles"
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
            onClick={handlePublish}
            disabled={!title.trim() || isSaving}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-all active:scale-[0.97]"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Save className="w-4 h-4 shrink-0" />}
            Save &amp; Publish
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="bg-[#f7f7f7] rounded-[16px] flex-1 min-h-0 overflow-y-auto px-[60px] py-[30px]">
        <div className="flex flex-col gap-[42px] items-center w-full">

          {/* ── Position Details + Generate ── */}
          <SectionCard>
            <div className="flex flex-col gap-6">
              <h2 className="text-[18px] font-semibold text-[#0e3d27] leading-7">Position Details</h2>

              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#4b5563] leading-[14px]">Position Title</label>
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

              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#4b5563] leading-[14px]">Job Description</label>
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

            <div className="flex items-center gap-6">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-all active:scale-[0.97]"
                style={{ background: "linear-gradient(173deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
              >
                {generating
                  ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  : <Sparkles className="w-4 h-4 shrink-0" />}
                Generate Criteria with AI
              </button>
              <button
                onClick={() => { setCriteria([{ criterion: "", type: "Technical", weight: 10, minReq: 0, evidenceSource: "" }]); setAiGenerated(true); }}
                disabled={generating}
                className="h-10 px-[17px] py-[13px] rounded-[14px] border border-[#0e3d27] text-[14px] font-normal text-[#0e3d27] leading-5 tracking-[-0.015em] disabled:opacity-50 transition-all active:scale-[0.97] hover:bg-[#e8f5ee] whitespace-nowrap"
              >
                Set Criteria Manually
              </button>
            </div>

            {aiError && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-[10px] bg-red-50 border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-700 leading-snug">{aiError}</p>
              </div>
            )}
          </SectionCard>

          {/* ── Interview Rounds ── */}
          <SectionCard>
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] font-semibold text-[#0e3d27] leading-7">Interview Rounds</h2>
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
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)" }}
                  >
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={round.name}
                    onChange={(e) => setRounds(rounds.map((r) => r.id === round.id ? { ...r, name: e.target.value } : r))}
                    placeholder="Round name (e.g. Phone Screen)"
                    className="flex-1 h-9 bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] px-3 text-[14px] text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] text-[#6b7280] whitespace-nowrap">{idx === 0 ? "Shortlist" : "Take"}</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={round.count}
                      onChange={(e) => setRounds(rounds.map((r) => r.id === round.id ? { ...r, count: parseInt(e.target.value) || 1 } : r))}
                      className="w-16 h-9 bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] px-2 text-[14px] text-[#111827] text-center outline-none focus:border-[#1f6b43] transition-colors"
                    />
                    <span className="text-[13px] text-[#6b7280] whitespace-nowrap">candidates</span>
                  </div>
                  {rounds.length > 1 && (
                    <button
                      onClick={() => setRounds(rounds.filter((r) => r.id !== round.id))}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-[#9ca3af] hover:bg-red-50 hover:text-red-500 transition-all active:scale-[0.9] shrink-0"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setRounds([...rounds, { id: `round-${Date.now()}`, name: "", count: 5 }])}
                className="flex items-center gap-2 text-[13px] font-medium text-[#0e3d27] hover:text-[#1f6b43] transition-colors self-start"
              >
                <Plus className="w-4 h-4" />
                Add round
              </button>
            </div>

            {rounds[0] && (
              <div className="flex items-center gap-2 bg-[#e8f5ee] rounded-[10px] px-4 py-3">
                <span className="text-[13px] text-[#0e3d27]">
                  AI will automatically shortlist the top <span className="font-bold">{rounds[0].count}</span> candidates from your candidate pool
                </span>
              </div>
            )}
          </SectionCard>

          {/* ── AI-generated sections ── */}
          {aiGenerated && (
            <>
              {/* Success Profile */}
              <SectionCard>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Success Profile</h2>
                  <p className="text-[13px] text-[#6b7280] leading-5">Define what a strong candidate looks like for this role</p>
                </div>
                <div className="flex flex-col w-full overflow-x-auto">
                  <div className="bg-[#f7f7f7] flex items-center justify-between pl-5 rounded-t-[8px]">
                    {["Criterion","Type","Weight","Min Requirement","Evidence Source"].map((h, i) => (
                      <div key={h} className={`flex items-center justify-center ${i === 0 ? "px-[10px] py-6 w-[250px]" : i === 4 ? "p-6 w-[220px]" : i === 3 ? "px-6 py-[15px] w-[130px]" : i === 2 ? "p-6 w-[150px]" : "p-6 w-[180px]"}`}>
                        <span className="text-[12px] font-semibold text-[#0e3d27] tracking-[0.3px] uppercase text-center leading-[18px]">{h}</span>
                      </div>
                    ))}
                    <div className="w-[84px]" />
                  </div>
                  {criteria.map((c, i) => (
                    <div key={i} className="flex items-center justify-between pl-5 border-b-[1.25px] border-[#e2e8e5]">
                      <div className="flex flex-col items-start px-[10px] py-[17px] w-[250px]">
                        <input value={c.criterion} onChange={(e) => { const n=[...criteria]; n[i]={...n[i],criterion:e.target.value}; setCriteria(n); }} placeholder="e.g. System Design" className={inputCls} />
                      </div>
                      <div className="flex flex-col items-start px-6 py-[17px] w-[180px]">
                        <select value={c.type} onChange={(e) => { const n=[...criteria]; n[i]={...n[i],type:e.target.value}; setCriteria(n); }} className={selectCls}>
                          <option>Technical</option><option>Soft Skill</option><option>Domain</option><option>Behavioral</option>
                        </select>
                      </div>
                      <div className="flex flex-col items-start px-6 py-[17px] w-[150px]">
                        <div className="flex items-center gap-2 w-full">
                          <input type="number" value={c.weight} min={0} max={100} onChange={(e) => { const n=[...criteria]; n[i]={...n[i],weight:Number(e.target.value)}; setCriteria(n); }} className="bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 flex-1 px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43] text-center" />
                          <span className="text-[13px] text-[#6b7280]">%</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-start px-6 py-[17px] w-[130px]">
                        <div className="flex items-center gap-2 w-full">
                          <input type="number" value={c.minReq} min={0} max={5} onChange={(e) => { const n=[...criteria]; n[i]={...n[i],minReq:Number(e.target.value)}; setCriteria(n); }} className="bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 w-10 px-2 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43] text-center" />
                          <span className="text-[13px] text-[#6b7280]">/ 5</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-start px-[10px] w-[220px]">
                        <input value={c.evidenceSource} onChange={(e) => { const n=[...criteria]; n[i]={...n[i],evidenceSource:e.target.value}; setCriteria(n); }} placeholder="e.g. Interview, Resume" className={inputCls} />
                      </div>
                      <div className="flex flex-col items-start px-6 py-[19px] w-[84px]">
                        <button onClick={() => setCriteria(criteria.filter((_,j) => j!==i))} className="h-8 w-full rounded-[8px] flex items-center justify-center text-[#9ca3af] hover:text-[#991b1b] transition-colors">
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4">
                    <button onClick={() => setCriteria([...criteria, { criterion:"", type:"Technical", weight:10, minReq:0, evidenceSource:"" }])} className="flex items-center gap-2 text-[13px] font-medium text-[#111827] hover:text-[#0e3d27] transition-colors">
                      <Plus className="w-4 h-4" />Add Criterion
                    </button>
                  </div>
                </div>
              </SectionCard>

              {/* Experience Range */}
              <SectionCard>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Experience Range</h2>
                  <p className="text-[14px] text-[#4b5563] leading-5">Years of relevant experience you&rsquo;re targeting. This filters candidates early.</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    {[{label:"Minimum",key:"min",max:15},{label:"Maximum",key:"max",max:20}].map(({label,key,max}) => (
                      <div key={key} className="flex-1 flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-[#4b5563]">{label}</label>
                        <div className="flex items-center gap-4">
                          <input type="range" min={0} max={max} value={expRange[key as "min"|"max"]}
                            onChange={(e) => setExpRange({...expRange,[key]:Number(e.target.value)})}
                            className="flex-1 h-4"
                            style={{ background:`linear-gradient(to right,#2e8b57 0%,#1f6b43 ${(expRange[key as "min"|"max"]/max)*100}%,#e2e8e5 ${(expRange[key as "min"|"max"]/max)*100}%,#e2e8e5 100%)`, borderRadius:"999px", cursor:"pointer", accentColor:"#0e3d27" }}
                          />
                          <div className="flex items-baseline gap-1 shrink-0">
                            <span className="text-[18px] font-semibold text-[#111827]">{expRange[key as "min"|"max"]}</span>
                            <span className="text-[14px] text-[#6b7280]">yrs</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3">
                    <p className="text-[14px] text-[#4b5563]">Target range: <span className="font-semibold">{expRange.min}–{expRange.max} years</span></p>
                  </div>
                  <label className="flex items-center gap-3 text-[13px] font-medium text-[#111827] cursor-pointer">
                    <input type="checkbox" checked={expRange.autoReject} onChange={(e) => setExpRange({...expRange,autoReject:e.target.checked})} className="w-4 h-4 rounded border border-[#111827] accent-[#1f6b43]" />
                    Auto-reject candidates outside the range (requires recruiter batch approval)
                  </label>
                </div>
              </SectionCard>

              {/* Dealbreakers */}
              <SectionCard>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Dealbreakers</h2>
                  <p className="text-[13px] text-[#6b7280] leading-5">Conditions that automatically disqualify candidates</p>
                </div>
                <div className="flex flex-col gap-4">
                  {dealbreakers.map((d, i) => (
                    <div key={i} className="bg-[#f7f7f7] rounded-[10px] p-[17px] flex flex-col gap-3">
                      <div className="flex items-start gap-4">
                        {[{l:"Rule",k:"rule"},{l:"Trigger Condition",k:"triggerCondition"}].map(({l,k}) => (
                          <div key={k} className="flex-1 flex flex-col gap-2">
                            <label className="text-[12px] font-medium text-[#111827]">{l}</label>
                            <input value={d[k as "rule"|"triggerCondition"]} onChange={(e) => { const n=[...dealbreakers]; n[i]={...n[i],[k]:e.target.value}; setDealbreakers(n); }} className="bg-white border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]" />
                          </div>
                        ))}
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-[12px] font-medium text-[#111827]">Action</label>
                          <select value={d.action} onChange={(e) => { const n=[...dealbreakers]; n[i]={...n[i],action:e.target.value}; setDealbreakers(n); }} className="bg-white border-[1.25px] border-white rounded-[8px] h-9 w-full px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]">
                            <option>Auto-reject</option><option>Flag</option><option>Review</option>
                          </select>
                        </div>
                      </div>
                      <button onClick={() => setDealbreakers(dealbreakers.filter((_,j)=>j!==i))} className="flex items-center gap-1 text-[12px] font-medium text-[#6b7280] hover:text-[#991b1b] transition-colors self-start">
                        <XIcon className="w-4 h-4" />Remove
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setDealbreakers([...dealbreakers,{rule:"",triggerCondition:"",action:"Auto-reject"}])} className="flex items-center gap-2 text-[13px] font-medium text-[#111827] hover:text-[#0e3d27] transition-colors self-start">
                    <Plus className="w-4 h-4" />Add Dealbreaker
                  </button>
                </div>
              </SectionCard>

              {/* Decision Thresholds */}
              <SectionCard>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Decision Thresholds</h2>
                  <p className="text-[13px] text-[#6b7280] leading-5">Define when candidates should advance or be rejected</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1f6b43]" /><span className="text-[14px] font-semibold text-[#111827]">Score</span></div>
                    <p className="text-[12px] text-[#6b7280]">Score threshold</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] text-[#6b7280]">≥</span>
                      <input type="number" value={thresholds.advance} onChange={(e)=>setThresholds({...thresholds,advance:Number(e.target.value)})} className="bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-16 px-2 text-[14px] font-semibold text-[#111827] text-center outline-none focus:border-[#1f6b43]" />
                    </div>
                    <p className="text-[12px] text-[#6b7280]">AND all must-have criteria pass minimum requirement</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#92400e]" /><span className="text-[14px] font-semibold text-[#111827]">Recruiter</span></div>
                    <p className="text-[12px] text-[#6b7280]">Score range</p>
                    <div className="flex items-center gap-1">
                      <input type="number" value={thresholds.review} onChange={(e)=>setThresholds({...thresholds,review:Number(e.target.value)})} className="bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-16 px-2 text-[14px] font-semibold text-[#111827] text-center outline-none focus:border-[#1f6b43]" />
                      <span className="text-[13px] text-[#6b7280]">to {thresholds.advance-1}</span>
                    </div>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-[#991b1b]" /><span className="text-[14px] font-semibold text-[#111827]">Reject</span></div>
                    <p className="text-[12px] text-[#6b7280]">Score threshold</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] text-[#6b7280]">&lt;</span>
                      <input type="number" value={thresholds.reject} onChange={(e)=>setThresholds({...thresholds,reject:Number(e.target.value)})} className="bg-white border-[1.25px] border-[#e2e8e5] rounded-[8px] h-9 w-16 px-2 text-[14px] font-semibold text-[#111827] text-center outline-none focus:border-[#1f6b43]" />
                    </div>
                    <p className="text-[12px] text-[#6b7280]">OR dealbreaker triggered</p>
                  </div>
                </div>
                <label className="flex items-center gap-3 text-[13px] font-medium text-[#111827] cursor-pointer">
                  <input type="checkbox" checked={thresholds.autoReject} onChange={(e)=>setThresholds({...thresholds,autoReject:e.target.checked})} className="w-4 h-4 rounded border border-[#111827] accent-[#1f6b43]" />
                  Auto-reject candidates below threshold (requires recruiter batch approval)
                </label>
              </SectionCard>

              {/* Interview Focus Areas */}
              <SectionCard>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Interview Focus Areas</h2>
                  <p className="text-[13px] text-[#6b7280] leading-5">Key topics for interview prompts. The AI uses these to generate question guides.</p>
                </div>
                <div className="flex flex-col gap-3">
                  {focusAreas.map((area, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white" style={{background:"linear-gradient(180deg,#2e8b57 0%,#1f6b43 100%)"}}>{i+1}</div>
                      <input value={area} onChange={(e)=>{const n=[...focusAreas];n[i]=e.target.value;setFocusAreas(n);}} className="flex-1 bg-[#f7f7f7] border-[1.25px] border-white rounded-[8px] h-9 px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b43]" />
                      <button onClick={()=>setFocusAreas(focusAreas.filter((_,j)=>j!==i))} className="text-[#9ca3af] hover:text-[#991b1b] transition-colors shrink-0"><XIcon className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={()=>setFocusAreas([...focusAreas,""])} className="flex items-center gap-2 text-[13px] font-medium text-[#111827] hover:text-[#0e3d27] transition-colors self-start">
                    <Plus className="w-4 h-4" />Add Focus Area
                  </button>
                  <p className="text-[12px] text-[#6b7280]">Recommended: 3–5 areas</p>
                </div>
              </SectionCard>

              {/* Risk Tolerance */}
              <SectionCard>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Risk Tolerance</h2>
                  <p className="text-[13px] text-[#6b7280] leading-5">Conservative = proven track record only. Aggressive = willing to bet on potential.</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <input type="range" min={0} max={100} value={riskTolerance} onChange={(e)=>setRiskTolerance(Number(e.target.value))} className="flex-1 h-4"
                      style={{background:`linear-gradient(to right,#2e8b57 0%,#1f6b43 ${riskTolerance}%,#e2e8e5 ${riskTolerance}%,#e2e8e5 100%)`,borderRadius:"999px",cursor:"pointer",accentColor:"#0e3d27"}} />
                    <span className="text-[18px] font-bold text-[#111827] w-14 text-right">{riskTolerance}%</span>
                  </div>
                  <p className="text-[14px] text-[#4b5563] leading-5">
                    <span className="font-semibold text-[#0e3d27]">{toleranceLabel}:</span>{" "}
                    {riskTolerance<30?"AI considers only proven track record.":riskTolerance<70?"AI considers both proven experience and high-potential candidates.":"AI is willing to bet on potential and upside."}
                  </p>
                </div>
              </SectionCard>

              {/* Scoring Logic Preview */}
              {criteria.length > 0 && (
                <SectionCard>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.4492px]">Scoring Logic Preview</h2>
                    <p className="text-[13px] text-[#6b7280] leading-5">See how the AI calculates fit scores based on your configuration</p>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex-1 bg-[#f7f7f7] rounded-[14px] p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#0e3d27]" /><span className="text-[14px] font-semibold text-[#0e3d27]">Formula</span></div>
                      <p className="text-[13px] text-[#6b7280]">Fit Score (0–100) = Sum of (criterion score × weight)</p>
                      <div className="flex flex-col gap-2">
                        <p className="text-[12px] font-medium text-[#0e3d27]">Example Breakdown:</p>
                        {exampleScores.map((s, i) => (
                          <div key={i} className="flex items-center justify-between text-[13px]">
                            <span className="text-[#4b5563]">{s.criterion}: {s.score}/5 × {s.weight}%</span>
                            <span className="font-semibold text-[#111827]">= {s.weighted}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-[14px] font-bold text-[#0e3d27] border-t border-[#e2e8e5] pt-2 mt-1">
                          <span>Final Score</span><span>{totalScore}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-[13px] text-[#6b7280] leading-6">This is a preview using sample scores. Actual candidate scores will be calculated using real evidence from resumes, interviews, and micro-screens.</p>
                    </div>
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* ── Bottom actions ── */}
          <div className="flex items-center justify-between w-full pt-2 pb-4">
            <Link href="/recruiter/roles" className="text-[14px] font-medium text-[#6b7280] hover:text-[#111827] transition-colors">
              Cancel
            </Link>
            <button
              onClick={handlePublish}
              disabled={!title.trim() || isSaving}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-all active:scale-[0.97]"
              style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Save className="w-4 h-4 shrink-0" />}
              Save &amp; Publish
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

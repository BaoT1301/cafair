"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────── */
type Round = {
  id: string;
  name: string;
  count: number;
};

const DEFAULT_ROUNDS: Round[] = [
  { id: "shortlist",    name: "Shortlisted (by AI)",   count: 20 },
  { id: "phone",        name: "Phone Screen",           count: 10 },
  { id: "technical",   name: "Technical Interview",     count: 5  },
];

/* ─── Rounds Builder ─────────────────────────────────────────── */
function RoundsBuilder({
  rounds,
  onChange,
}: {
  rounds: Round[];
  onChange: (rounds: Round[]) => void;
}) {
  const updateRound = (id: string, field: keyof Round, value: string | number) => {
    onChange(rounds.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRound = () => {
    onChange([
      ...rounds,
      { id: `round-${Date.now()}`, name: "", count: 5 },
    ]);
  };

  const removeRound = (id: string) => {
    onChange(rounds.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {rounds.map((round, idx) => (
        <div
          key={round.id}
          className="flex items-center gap-3 bg-[#f7f7f7] border border-[#e2e8e5] rounded-[10px] px-4 py-3"
          style={{ borderWidth: "1.25px" }}
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
            onChange={(e) => updateRound(round.id, "name", e.target.value)}
            placeholder="Round name (e.g. Phone Screen)"
            className="flex-1 h-8 bg-white border border-[#e2e8e5] rounded-[8px] px-3 text-sm text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43]"
            style={{ borderWidth: "1.25px" }}
          />

          {/* Candidate count */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[#6b7280] whitespace-nowrap">
              {idx === 0 ? "Shortlist" : "Take"}
            </span>
            <input
              type="number"
              min={1}
              max={999}
              value={round.count}
              onChange={(e) =>
                updateRound(round.id, "count", parseInt(e.target.value) || 1)
              }
              className="w-16 h-8 bg-white border border-[#e2e8e5] rounded-[8px] px-2 text-sm text-[#111827] text-center outline-none focus:border-[#1f6b43]"
              style={{ borderWidth: "1.25px" }}
            />
            <span className="text-xs text-[#6b7280]">candidates</span>
          </div>

          {/* Remove (not first round) */}
          {rounds.length > 1 && (
            <button
              onClick={() => removeRound(round.id)}
              className="text-[#9ca3af] hover:text-[#991b1b] transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}

      {/* Add round button */}
      <button
        onClick={addRound}
        className="flex items-center gap-2 text-sm font-medium text-[#0e3d27] hover:text-[#1f6b43] transition-colors self-start"
      >
        <Plus className="w-4 h-4" />
        Add round
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function NewRoleAlignmentPage() {
  const trpc   = useTRPC();
  const router = useRouter();

  const [title,          setTitle]          = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [rounds,         setRounds]         = useState<Round[]>(DEFAULT_ROUNDS);
  const [mode,           setMode]           = useState<"ai" | "manual" | "publish" | null>(null);

  const createMutation = useMutation(
    trpc.recruiter.createRole.mutationOptions({
      onSuccess: (role) => {
        // Save shortlist limit to localStorage (top round count)
        if (rounds[0]) {
          localStorage.setItem("shortlist-limit", String(rounds[0].count));
        }
        if (mode === "publish") {
          router.push("/roles");
        } else {
          router.push(`/roles/${role.id}/alignment`);
        }
      },
    }),
  );

  const handleSubmit = (submitMode: "ai" | "manual" | "publish") => {
    if (!title.trim()) return;
    setMode(submitMode);
    createMutation.mutate({
      title:          title.trim(),
      jobDescription: jobDescription.trim() || undefined,
    });
  };

  const isPending = createMutation.isPending;

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
            onClick={() => handleSubmit("publish")}
            disabled={!title.trim() || isPending}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {isPending && mode === "publish" ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            Save &amp; Publish
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] flex-1 min-h-0 overflow-y-auto pl-[88px] pr-[60px] py-5">
        <div className="bg-white rounded-[16px] p-6 flex flex-col gap-8 w-full">

          {/* ── Position Details ── */}
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
                className="h-9 w-full max-w-[448px] bg-[#f7f7f7] border border-[#e2e8e5] rounded-[8px] px-3 py-1 text-[14px] text-[#4b5563] placeholder:text-[#9ca3af] leading-5 outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors"
                style={{ borderWidth: "1.25px" }}
              />
              <p className="text-[12px] font-normal text-[#4b5563] leading-4">
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
                className="w-full h-[200px] bg-[#f7f7f7] border border-[#e2e8e5] rounded-[8px] px-3 py-2 text-[14px] text-[#4b5563] placeholder:text-[#9ca3af] leading-5 outline-none focus:border-[#1f6b43] focus:ring-1 focus:ring-[#1f6b43] transition-colors resize-none"
                style={{ borderWidth: "1.25px" }}
              />
              <p className="text-[12px] font-normal text-[#4b5563] leading-4">
                The AI will analyze this to suggest alignment criteria below
              </p>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-[#e2e8e5]" />

          {/* ── Interview Rounds ── */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] font-semibold text-[#0e3d27] leading-7">
                Interview Rounds
              </h2>
              <p className="text-[13px] text-[#6b7280] leading-5">
                Set up your hiring funnel. The AI will shortlist the top candidates and route them through each round.
              </p>
            </div>

            <RoundsBuilder rounds={rounds} onChange={setRounds} />

            {/* Shortlist summary */}
            {rounds[0] && (
              <div className="flex items-center gap-2 bg-[#e8f5ee] rounded-[10px] px-4 py-3">
                <span className="text-sm text-[#0e3d27]">
                  AI will automatically shortlist the top{" "}
                  <span className="font-bold">{rounds[0].count}</span> candidates from your candidate pool
                </span>
              </div>
            )}
          </div>

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleSubmit("ai")}
              disabled={!title.trim() || isPending}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em] disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(173deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
            >
              {isPending && mode === "ai" ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              Generate Criteria with AI
            </button>

            <button
              onClick={() => handleSubmit("manual")}
              disabled={!title.trim() || isPending}
              className="h-10 px-[17px] py-[13px] rounded-[14px] border border-[#0e3d27] text-[14px] font-normal text-[#0e3d27] leading-5 tracking-[-0.015em] shadow-[0px_4px_12px_0px_rgba(46,139,87,0.25)] disabled:opacity-50 transition-opacity hover:bg-[#e8f5ee] whitespace-nowrap"
            >
              {isPending && mode === "manual" ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : (
                "Set Criteria Manually"
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

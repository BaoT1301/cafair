"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  Mic,
  Code,
  PenLine,
  ChevronRight,
  Star,
} from "lucide-react";
import { FitScoreBar } from "@/components/recruiter/FitScoreBar";
import { RiskBadge } from "@/components/recruiter/RiskBadge";
import { getInitials } from "@/lib/recruiter-utils";

// ─── Evidence Tags ───────────────────────────────────────
const evidenceConfig: Record<string, { icon: React.ElementType; label: string }> = {
  resume: { icon: FileText, label: "Resume" },
  screen: { icon: Mic, label: "Screen" },
  code: { icon: Code, label: "Code" },
  essay: { icon: PenLine, label: "Essay" },
};

function EvidenceTag({ type }: { type: string }) {
  const config = evidenceConfig[type] ?? evidenceConfig.resume;
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border text-muted-foreground bg-secondary">
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}


// ─── Stage + Lane Badge ─────────────────────────────────
function StageLaneBadge({
  stage,
  lane,
}: {
  stage: string | null;
  lane: string | null;
}) {
  const stageLabel = stage === "day1" ? "Day 1" : stage ?? "fair";
  const laneLabel = lane?.replace(/_/g, " ") ?? "";

  const laneColors: Record<string, string> = {
    recruiter_now: "bg-primary/10 text-primary border-primary/20",
    quick_screen: "bg-amber-50 text-amber-700 border-amber-200",
    redirect: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground capitalize">
        {stageLabel}
      </span>
      {lane && (
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border capitalize w-fit ${
            laneColors[lane ?? ""] ?? laneColors.redirect
          }`}
        >
          <Star className="w-2.5 h-2.5" />
          {laneLabel}
        </span>
      )}
    </div>
  );
}


// ─── Main Page ───────────────────────────────────────────
export default function CandidatesPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Filter state ────────────────────────────────────
  const [roleFilter, setRoleFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  // ─── Search from URL ─────────────────────────────────
  const search = searchParams.get("search") ?? "";

  // ─── Data fetching ────────────────────────────────────
  const { data: candidates, isLoading } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );

  const { data: roles } = useQuery(trpc.recruiter.getRoles.queryOptions());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Filtering logic ──────────────────────────────────
  const filtered = candidates?.filter((c) => {
    const matchesSearch = search
      ? c.name.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesRole =
      roleFilter === "all" || c.roleId === roleFilter;
    const matchesRisk =
      riskFilter === "all" || c.riskLevel === riskFilter;
    return matchesSearch && matchesRole && matchesRisk;
  });

  // Simulate owners & last touch
  const owners = ["Jamie R.", "Sam T."];
  const touchLabels = [
    "Offer being prepared",
    "Screen completed",
    "Research interview completed",
    "Interview scheduled",
    "Pre-screen passed",
    "Director interview scheduled",
    "Offer extended",
    "Application reviewed",
    "Technical screen completed",
    "Registered",
    "Pre-screen completed",
    "Verification complete",
    "Portfolio review completed",
    "Interview scheduled",
    "Application reviewed",
  ];
  const timeLabels = [
    "4h ago", "2h ago", "1d ago", "5h ago", "1h ago",
    "6h ago", "1d ago", "8h ago", "3h ago", "3h ago",
    "1h ago", "4h ago", "1d ago", "3h ago", "2h ago",
  ];
  const nextActions = [
    "Extend senior engineer offer",
    "Schedule final interview",
    "Final round with research team",
    "Prepare interview panel",
    "Begin micro-screen",
    "Executive interview with CPO",
    "Await response",
    "Schedule technical screen",
    "Schedule final interview",
    "Invite to priority lane",
    "Technical deep-dive",
    "Schedule technical screen",
    "Design challenge assignment",
    "Prepare panel",
    "Review application",
  ];

  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-sm text-muted-foreground">
            {filtered?.length ?? 0} candidates
            {search && (
              <span className="ml-1 text-primary">
                matching "{search}"
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* All Roles filter — wired to real roles from DB */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground"
          >
            <option value="all">All Roles</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>

          {/* All Risk filter — wired to riskLevel */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground"
          >
            <option value="all">All Risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <div className="flex items-center gap-0.5 bg-secondary border border-border rounded-lg px-1 py-0.5">
            <button className="text-xs font-medium px-2.5 py-1 rounded bg-card text-foreground shadow-sm">
              List Mode
            </button>
            <button className="text-xs font-medium px-2.5 py-1 rounded text-muted-foreground">
              Graph Mode
            </button>
            <button className="text-xs font-medium px-2.5 py-1 rounded text-muted-foreground">
              Match View
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {[
                "", "Candidate", "Role(s)", "Fit Score",
                "Stage / Lane", "Last Touch", "Evidence",
                "Risk", "Owner", "Next Action", "",
              ].map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="text-left text-[10px] font-semibold text-muted-foreground px-3 py-3 uppercase tracking-wider first:pl-4 last:pr-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered?.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">
                  No candidates match your filters
                </td>
              </tr>
            ) : (
              filtered?.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/recruiter/candidates/${c.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {/* Checkbox */}
                  <td className="pl-4 pr-1 py-3">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-border accent-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>

                  {/* Candidate */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">
                            {getInitials(c.name)}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                          {c.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {c.school}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {c.role}
                  </td>

                  {/* Fit Score */}
                  <td className="px-3 py-3">
                    <FitScoreBar score={c.fitScore ?? 0} />
                  </td>

                  {/* Stage / Lane */}
                  <td className="px-3 py-3">
                    <StageLaneBadge stage={c.stage} lane={c.lane} />
                  </td>

                  {/* Last Touch */}
                  <td className="px-3 py-3">
                    <p className="text-xs text-foreground">
                      {touchLabels[i % touchLabels.length]}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {timeLabels[i % timeLabels.length]}
                    </p>
                  </td>

                  {/* Evidence */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <EvidenceTag type="resume" />
                      <EvidenceTag type="screen" />
                      <EvidenceTag type="code" />
                      {i % 3 === 0 && <EvidenceTag type="essay" />}
                    </div>
                  </td>

                  {/* Risk */}
                  <td className="px-3 py-3">
                    <RiskBadge risk={(c.riskLevel as "low" | "medium" | "high") ?? "low"} />
                  </td>

                  {/* Owner */}
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {owners[i % owners.length]}
                  </td>

                  {/* Next Action */}
                  <td className="px-3 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                    {nextActions[i % nextActions.length]}
                  </td>

                  {/* Arrow */}
                  <td className="pr-4 py-3">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
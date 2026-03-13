"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, ChevronDown, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: Math.min(i, 10) * 0.045, ease: [0.22, 1, 0.36, 1] as const },
  }),
};
import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/* ─── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; dot: string; text: string; label: string }> = {
    on_track: {
      bg:   "bg-[#e8f5ee]",
      dot:  "bg-[#1f6b43]",
      text: "text-[#1f6b43]",
      label: "Healthy",
    },
    at_risk: {
      bg:   "bg-[#fef3c7]",
      dot:  "bg-[#92400e]",
      text: "text-[#92400e]",
      label: "At Risk",
    },
    critical: {
      bg:   "bg-[#fee2e2]",
      dot:  "bg-[#991b1b]",
      text: "text-[#991b1b]",
      label: "Stalled",
    },
  };
  const c = cfg[status] ?? cfg.on_track;
  return (
    <span
      className={`inline-flex items-center gap-2 px-[9px] py-[2px] rounded-[14px] text-[12px] font-normal leading-4 ${c.bg} ${c.text}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ─── Pipeline Row ───────────────────────────────────────────── */
function PipelineRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(Math.round((count / max) * 100), 100) : 0;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between h-5">
        <span className="text-[14px] font-medium text-[#4b5563] leading-5 tracking-[-0.015em]">
          {label}
        </span>
        <span className="text-[14px] font-bold text-[#111827] leading-5 tracking-[-0.015em]">
          {count}
        </span>
      </div>
      <div className="h-2 w-full bg-[#e2e8e5] rounded-full overflow-hidden">
        {pct > 0 && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Role Card ──────────────────────────────────────────────── */
function RoleCard({
  role,
  candidateCounts,
  onDelete,
}: {
  role: {
    id: string;
    title: string;
    department?: string | null;
    status?: string | null;
    createdAt?: string | Date | null;
  };
  candidateCounts: {
    applied: number;
    screened: number;
    reviewing: number;
    interview: number;
  };
  onDelete?: (id: string) => void;
}) {
  const openDays = role.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(role.createdAt).getTime()) / 86400000))
    : 0;

  const max = Math.max(candidateCounts.applied, 1);
  const status = role.status ?? "on_track";

  let alertMsg = "";
  let alertStyle = "";
  if (status === "critical") {
    alertMsg = `No activity in ${openDays} days`;
    alertStyle = "bg-[#fee2e2] text-[#991b1b]";
  } else if (status === "at_risk") {
    alertMsg = `${candidateCounts.reviewing} candidates in Reviewing for 6+ days`;
    alertStyle = "bg-[#fee2e2] text-[#991b1b]";
  } else {
    const total =
      candidateCounts.applied + candidateCounts.screened +
      candidateCounts.reviewing + candidateCounts.interview;
    if (total > 0) {
      alertMsg = `${total} pending actions`;
      alertStyle = "bg-[#fef3c7] text-[#92400e]";
    }
  }

  return (
    <div className="bg-white rounded-[16px] p-[25px] flex flex-col gap-4 w-full min-w-0 h-full">
      {/* Title row */}
      <div className="flex items-start justify-between h-[54px]">
        <div className="flex flex-col gap-[2px] flex-1 min-w-0">
          <h3 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.045em] truncate">
            {role.title}
          </h3>
          <p className="text-[14px] font-normal text-[#4b5563] leading-5 tracking-[-0.015em] truncate">
            {role.department ?? "General"}&nbsp;·&nbsp;Open {openDays} days
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} />
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(role.id); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#9ca3af] hover:bg-red-50 hover:text-red-500 transition-all active:scale-[0.9]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Pipeline bars */}
      <div className="flex flex-col gap-2 w-full">
        <PipelineRow label="Applied"   count={candidateCounts.applied}   max={max} />
        <PipelineRow label="Screened"  count={candidateCounts.screened}  max={max} />
        <PipelineRow label="Reviewing" count={candidateCounts.reviewing} max={max} />
        <PipelineRow label="Interview" count={candidateCounts.interview} max={max} />
      </div>

      {/* Alert banner */}
      {alertMsg && (
        <div className={`px-[17px] py-[13px] rounded-[14px] text-[14px] font-normal leading-5 tracking-[-0.015em] ${alertStyle}`}>
          {alertMsg}
        </div>
      )}

      {/* View Candidates link — pushed to bottom */}
      <div className="flex justify-end mt-auto">
        <Link
          href={`/candidate-queue?role=${role.id}`}
          className="text-[14px] font-semibold text-[#0e3d27] leading-5 tracking-[-0.015em] underline decoration-solid"
        >
          View Candidates →
        </Link>
      </div>
    </div>
  );
}

/* ─── Filter Button ──────────────────────────────────────────── */
function FilterButton({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative h-[42px]">
      <div className="flex items-center gap-2 bg-white rounded-[14px] h-full px-[14px] py-[6px] cursor-pointer pointer-events-none">
        <span className="text-[14px] font-medium text-[#4b5563] leading-5 tracking-[-0.015em] whitespace-nowrap">
          {value !== "all" ? options.find((o) => o.value === value)?.label ?? label : label}
        </span>
        <ChevronDown className="w-4 h-4 text-[#4b5563] shrink-0" />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
      >
        <option value="all">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Mock Data ──────────────────────────────────────────────── */
const MOCK_ROLES = [
  { id: "mock-1", title: "Software Engineer", department: "Engineering", status: "on_track",  createdAt: new Date(Date.now() - 24 * 86400000) },
  { id: "mock-2", title: "Product Manager",   department: "Product",     status: "at_risk",   createdAt: new Date(Date.now() - 35 * 86400000) },
  { id: "mock-3", title: "Head of Design",    department: "Design",      status: "critical",  createdAt: new Date(Date.now() - 51 * 86400000) },
];
const MOCK_COUNTS: Record<string, { applied: number; screened: number; reviewing: number; interview: number }> = {
  "mock-1": { applied: 12, screened: 8, reviewing: 4, interview: 2 },
  "mock-2": { applied: 7,  screened: 4, reviewing: 3, interview: 0 },
  "mock-3": { applied: 5,  screened: 2, reviewing: 2, interview: 0 },
};

/* ─── Page ───────────────────────────────────────────────────── */
export default function RoleManagementPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: roles, isLoading: rolesLoading } = useQuery(trpc.recruiter.getRoles.queryOptions());
  const { data: candidates }                      = useQuery(trpc.recruiter.getCandidates.queryOptions());

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const deleteMutation = useMutation(
    trpc.recruiter.deleteRole.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.recruiter.getRoles.queryOptions().queryKey });
      },
      onError: (_err, vars) => {
        setDeletedIds(prev => { const next = new Set(prev); next.delete(vars.id); return next; });
      },
    }),
  );

  function handleDelete(id: string) {
    setDeletedIds(prev => new Set(prev).add(id));
    // Fire mutation after exit animation completes (~300ms)
    setTimeout(() => deleteMutation.mutate({ id }), 300);
  }

  const [search,       setSearch]       = useState("");
  const [deptFilter,   setDeptFilter]   = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

  const departments = useMemo(() => {
    if (!roles) return [];
    const depts = new Set(
      (roles as { department?: string | null }[]).map((r) => r.department ?? "General")
    );
    return Array.from(depts).map((d) => ({ value: d, label: d }));
  }, [roles]);

  const countsByRole = useMemo(() => {
    const map: Record<string, { applied: number; screened: number; reviewing: number; interview: number }> = {};
    if (!candidates) return map;
    for (const c of candidates as { roleId?: string | null; stage?: string | null }[]) {
      const rid = c.roleId ?? "none";
      if (!map[rid]) map[rid] = { applied: 0, screened: 0, reviewing: 0, interview: 0 };
      if (c.stage === "fair")                          map[rid].applied++;
      else if (c.stage === "screen")                   map[rid].screened++;
      else if (c.stage === "interview")                map[rid].reviewing++;
      else if (c.stage === "offer" || c.stage === "day1") map[rid].interview++;
    }
    return map;
  }, [candidates]);

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return (roles as typeof MOCK_ROLES).filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (deptFilter !== "all" && (r.department ?? "General") !== deptFilter) return false;
      if (healthFilter !== "all" && r.status !== healthFilter) return false;
      return true;
    });
  }, [roles, search, deptFilter, healthFilter]);

  const displayRoles  = filteredRoles.length > 0 ? filteredRoles : MOCK_ROLES;
  const isMock        = filteredRoles.length === 0;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header card ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex flex-col gap-[23px] shrink-0">
        <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.006em]">
          Role Management
        </h1>
        <Link href="/roles/new/alignment">
          <button
            className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.015em]"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add  New Position
          </button>
        </Link>
      </motion.div>

      {/* ── Content card ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex flex-col gap-9 flex-1 min-h-0 overflow-y-auto">

        {/* Search + filters */}
        <div className="flex items-center gap-5 shrink-0">
          {/* Search */}
          <div className="relative flex-1 h-[42px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280] pointer-events-none" />
            <input
              type="text"
              placeholder="Search  opening roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-full bg-white rounded-[14px] pl-10 pr-4 text-[14px] text-[#111827] placeholder:text-[#6b7280] tracking-[-0.015em] outline-none leading-5"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-3">
            <FilterButton
              label="Department"
              value={deptFilter}
              onChange={setDeptFilter}
              options={departments}
            />
            <FilterButton
              label="Recruiter"
              value="all"
              onChange={() => {}}
              options={[]}
            />
            <FilterButton
              label="Health"
              value={healthFilter}
              onChange={setHealthFilter}
              options={[
                { value: "on_track", label: "Healthy" },
                { value: "at_risk",  label: "At Risk" },
                { value: "critical", label: "Stalled" },
              ]}
            />
          </div>
        </div>

        {/* Role cards */}
        {rolesLoading ? (
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[16px] p-[25px] animate-pulse space-y-4">
                <div className="h-5 bg-gray-100 rounded-lg w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-2 bg-gray-100 rounded-full w-full mt-4" />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="h-8 bg-gray-100 rounded-lg" />
                  <div className="h-8 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {displayRoles.filter(r => !deletedIds.has(r.id)).map((role, i) => (
              <motion.div
                key={role.id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const } }}
                layout
                className="h-full"
              >
                <RoleCard
                  role={role}
                  candidateCounts={
                    isMock
                      ? (MOCK_COUNTS[role.id] ?? { applied: 0, screened: 0, reviewing: 0, interview: 0 })
                      : (countsByRole[role.id]  ?? { applied: 0, screened: 0, reviewing: 0, interview: 0 })
                  }
                  onDelete={isMock ? undefined : handleDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        )}

      </motion.div>
    </div>
  );
}

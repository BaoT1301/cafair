"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */
type Severity = "HIGH" | "MED" | "LOW";

type RiskFlag = {
  id: string;
  severity: Severity;
  title: string;
  candidate: string;
  role: string;
  detectedDate: string;
  evidence: string;
  claim: string;
  conflictingSignal: string;
  recommendedAction: string;
  req: string;
  flagType: string;
};

/* ─── Mock Data ──────────────────────────────────────────────── */
const MOCK_FLAGS: RiskFlag[] = [
  {
    id: "1",
    severity: "HIGH",
    title: "Skill Claim Mismatch",
    candidate: "Priya Nair",
    role: "Software Engineer",
    detectedDate: "Feb 19",
    req: "SWE-001",
    flagType: "Skill",
    evidence:
      "Claimed 5 years Python experience; micro-screen responses suggest beginner-level familiarity",
    claim:
      '"Led Python infrastructure at scale for 5 years, including async processing and distributed systems."',
    conflictingSignal:
      'Micro-screen Q2 ("Describe a Python async pattern you\'ve used") received a response describing basic threading, not async/io or coroutine-based patterns expected at 5+ year level.',
    recommendedAction:
      'Ask directly in technical interview. Consider: "Walk me through the most complex async Python system you\'ve built"',
  },
  {
    id: "2",
    severity: "MED",
    title: "Employment Date Gap",
    candidate: "Marcus Chen",
    role: "Software Engineer",
    detectedDate: "Feb 17",
    req: "SWE-001",
    flagType: "Employment",
    evidence:
      "Resume shows 8-month gap between Airbnb (Jun 2018) and Stripe (Feb 2019). No explanation provided.",
    claim:
      '"Continuous employment history in software engineering roles from 2015 to present."',
    conflictingSignal:
      "Resume dates show an 8-month gap between Airbnb (Jun 2018) and Stripe (Feb 2019) that was not mentioned in the application or micro-screen.",
    recommendedAction:
      'Ask candidate to clarify: "Can you walk me through what you were doing between June 2018 and February 2019?"',
  },
  {
    id: "3",
    severity: "LOW",
    title: "Date Inconsistency",
    candidate: "Alex Torres",
    role: "Software Engineer",
    detectedDate: "Feb 15",
    req: "SWE-002",
    flagType: "Dates",
    evidence:
      "LinkedIn end date for role (Jan 2022) differs from resume (Mar 2022) — minor discrepancy",
    claim: '"Left previous role in March 2022 to pursue new opportunities."',
    conflictingSignal:
      "LinkedIn profile shows end date of January 2022 for the same position listed as March 2022 on the resume.",
    recommendedAction:
      "Minor discrepancy — note for reference. Can clarify briefly during interview if needed.",
  },
];

/* ─── Severity Badge ─────────────────────────────────────────── */
function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = {
    HIGH: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]", label: "HIGH" },
    MED:  { bg: "bg-[#fef3c7]", text: "text-[#991b1b]", label: "MED" },
    LOW:  { bg: "bg-[#e2e8e5]", text: "text-[#4b5563]",  label: "LOW" },
  }[severity];

  return (
    <span
      className={`inline-flex items-center justify-center h-[22px] px-[9px] py-[3px] rounded-[8px] border border-[#e2e8e5] text-[12px] font-semibold leading-4 whitespace-nowrap ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

/* ─── Outline Action Button ──────────────────────────────────── */
function OutlineBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-[13px] py-px rounded-[8px] border border-[#0e3d27] bg-white text-[14px] font-medium text-[#0e3d27] leading-5 whitespace-nowrap hover:bg-[#e8f5ee] transition-colors"
    >
      {children}
    </button>
  );
}

/* ─── Filter Dropdown ────────────────────────────────────────── */
function FilterBtn({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative h-full">
      <div className="flex items-center justify-between gap-1 bg-white rounded-[14px] h-full px-3 py-[6px] pointer-events-none">
        <span className="text-[14px] font-medium text-[#111827] leading-5 whitespace-nowrap">
          {value === "all" ? label : value}
        </span>
        <ChevronDown className="w-4 h-4 text-[#111827] shrink-0" />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
      >
        <option value="all">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Flag Card ──────────────────────────────────────────────── */
function FlagCard({
  flag,
  isSelected,
  onSelect,
  onMarkReviewed,
}: {
  flag: RiskFlag;
  isSelected: boolean;
  onSelect: () => void;
  onMarkReviewed: (id: string) => void;
}) {
  const borderColor =
    flag.severity === "HIGH" ? "border-l-[#0e3d27]" : "border-l-[#f7f7f7]";

  return (
    <div
      className={`bg-white rounded-[14px] px-7 py-6 flex flex-col gap-[14px] border-l-4 cursor-pointer transition-shadow hover:shadow-sm ${borderColor} ${isSelected ? "ring-1 ring-[#0e3d27]/20" : ""}`}
      onClick={onSelect}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        {/* Left: badge + title + candidate */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={flag.severity} />
            <h3 className="text-[18px] font-semibold text-[#111827] leading-7 whitespace-nowrap">
              {flag.title}
            </h3>
          </div>
          <p className="text-[14px] font-normal text-[#4b5563] leading-5 whitespace-nowrap">
            {flag.candidate}&nbsp;·&nbsp;{flag.role}
          </p>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-3 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
          <OutlineBtn>View Detail →</OutlineBtn>
          <OutlineBtn onClick={() => onMarkReviewed(flag.id)}>
            Mark Reviewed
          </OutlineBtn>
          {flag.severity === "HIGH" && (
            <OutlineBtn>Escalate</OutlineBtn>
          )}
        </div>
      </div>

      {/* Evidence box */}
      <div className="bg-white border border-[#e2e8e5] rounded-[8px] p-4">
        <p className="text-[14px] font-normal text-[#111827] leading-5">
          {flag.evidence}
        </p>
      </div>
    </div>
  );
}

/* ─── Flag Detail Panel ──────────────────────────────────────── */
function FlagDetail({
  flag,
  onMarkReviewed,
}: {
  flag: RiskFlag | null;
  onMarkReviewed: (id: string) => void;
}) {
  if (!flag) {
    return (
      <div className="bg-[#f7f7f7] rounded-[16px] p-6 flex items-center justify-center h-full">
        <p className="text-[14px] text-[#6b7280]">
          Select a flag to view details
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f7f7] rounded-[16px] p-6 flex flex-col gap-[22px] h-full overflow-y-auto">
      {/* Section label */}
      <div>
        <p className="text-[14px] font-bold text-[#111827] leading-5 tracking-[0.35px] uppercase">
          Flag Detail
        </p>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.045em]">
          {flag.candidate} — {flag.title}
        </h2>
        <p className="text-[14px] font-normal text-[#4b5563] leading-5">
          {flag.role}&nbsp;·&nbsp;Detected {flag.detectedDate}
        </p>
      </div>

      {/* Claim */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold text-[#6b7280] leading-4 tracking-[0.35px] uppercase">
          Claim
        </p>
        <p className="text-[14px] font-normal text-[#111827] leading-5">
          {flag.claim}
        </p>
      </div>

      {/* Conflicting Signal */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold text-[#6b7280] leading-4 tracking-[0.35px] uppercase">
          Conflicting Signal
        </p>
        <p className="text-[14px] font-normal text-[#111827] leading-5">
          {flag.conflictingSignal}
        </p>
      </div>

      {/* Recommended Action */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold text-[#6b7280] leading-4 tracking-[0.35px] uppercase">
          Recommended Action
        </p>
        <div className="bg-white rounded-[8px] p-[17px]">
          <p className="text-[14px] font-normal text-[#111827] leading-5">
            {flag.recommendedAction}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button
          className="h-10 px-4 py-3 rounded-[14px] text-[14px] font-medium text-white leading-5 whitespace-nowrap"
          style={{ background: "linear-gradient(164deg, #0e3d27 16.3%, #156139 71.8%)" }}
        >
          Escalate
        </button>
        <button
          onClick={() => onMarkReviewed(flag.id)}
          className="h-10 px-[17px] py-[13px] rounded-[14px] border border-[#0e3d27] text-[14px] font-medium text-[#111827] leading-5 whitespace-nowrap shadow-[0px_4px_12px_0px_rgba(46,139,87,0.25)] hover:bg-[#e8f5ee] transition-colors"
        >
          Mark Reviewed
        </button>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function RiskFlagsPage() {
  const [search,       setSearch]       = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [reqFilter,    setReqFilter]    = useState("all");
  const [flagTypeFilter, setFlagTypeFilter] = useState("all");
  const [roleSort,     setRoleSort]     = useState("All");
  const [selectedId,   setSelectedId]   = useState<string>("1");
  const [flags,        setFlags]        = useState<RiskFlag[]>(MOCK_FLAGS);

  const handleMarkReviewed = (id: string) => {
    setFlags((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) {
      const remaining = flags.filter((f) => f.id !== id);
      setSelectedId(remaining[0]?.id ?? "");
    }
  };

  const filtered = useMemo(() => {
    return flags.filter((f) => {
      if (search && !f.candidate.toLowerCase().includes(search.toLowerCase()) &&
          !f.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (reqFilter !== "all" && f.req !== reqFilter) return false;
      if (flagTypeFilter !== "all" && f.flagType !== flagTypeFilter) return false;
      if (roleSort !== "All" && f.role !== roleSort) return false;
      return true;
    });
  }, [flags, search, severityFilter, reqFilter, flagTypeFilter, roleSort]);

  const selectedFlag = filtered.find((f) => f.id === selectedId) ?? filtered[0] ?? null;

  const uniqueReqs      = [...new Set(flags.map((f) => f.req))];
  const uniqueFlagTypes = [...new Set(flags.map((f) => f.flagType))];
  const uniqueRoles     = [...new Set(flags.map((f) => f.role))];

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header card ── */}
      <div className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex items-start justify-between shrink-0">
        {/* Left: title + subtitle */}
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.006em]">
            Verification Risk Flags
          </h1>
          <p className="text-[14px] font-normal text-[#6b7280] leading-5 tracking-[-0.015em]">
            {filtered.length} active flag{filtered.length !== 1 ? "s" : ""}&nbsp;·&nbsp;
            {uniqueReqs.length} req{uniqueReqs.length !== 1 ? "s" : ""}&nbsp;·&nbsp;sorted by severity
          </p>
        </div>

        {/* Right: search */}
        <div className="relative h-[42px] w-[318px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5563] pointer-events-none" />
          <input
            type="text"
            placeholder="Search  candidate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-full bg-white rounded-[14px] pl-10 pr-4 text-[14px] text-[#111827] placeholder:text-[#4b5563] leading-5 outline-none"
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Left panel: filters + flag list ── */}
        <div className="bg-[#f7f7f7] rounded-[16px] flex-1 min-w-0 flex flex-col gap-9 px-4 py-5 overflow-y-auto">

          {/* Filters row */}
          <div className="flex items-center justify-between shrink-0">
            {/* Left filters */}
            <div className="flex items-center gap-2 h-9">
              <FilterBtn
                label="Severity"
                value={severityFilter}
                options={["HIGH", "MED", "LOW"]}
                onChange={setSeverityFilter}
              />
              <FilterBtn
                label="Req"
                value={reqFilter}
                options={uniqueReqs}
                onChange={setReqFilter}
              />
              <FilterBtn
                label="Flag Type"
                value={flagTypeFilter}
                options={uniqueFlagTypes}
                onChange={setFlagTypeFilter}
              />
            </div>

            {/* Sort by role */}
            <div className="flex items-center h-[34px]">
              <span className="text-[14px] font-normal text-[#111827] leading-5 tracking-[-0.015em] px-2">
                Sort by role
              </span>
              <div className="relative w-[200px] h-full">
                <div className="flex items-center justify-between bg-white rounded-[14px] h-full px-4 py-2 pointer-events-none">
                  <span className="text-[14px] font-medium text-[#111827] leading-5 tracking-[-0.015em]">
                    {roleSort}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#111827] shrink-0" />
                </div>
                <select
                  value={roleSort}
                  onChange={(e) => setRoleSort(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                >
                  <option value="All">All</option>
                  {uniqueRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Flag cards */}
          <div className="flex flex-col gap-[13px] pb-[60px]">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-[14px] text-[#6b7280]">
                No flags match the current filters.
              </div>
            ) : (
              filtered.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  isSelected={selectedFlag?.id === flag.id}
                  onSelect={() => setSelectedId(flag.id)}
                  onMarkReviewed={handleMarkReviewed}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: flag detail ── */}
        <div className="w-[340px] shrink-0 flex flex-col min-h-0">
          <FlagDetail flag={selectedFlag} onMarkReviewed={handleMarkReviewed} />
        </div>

      </div>
    </div>
  );
}

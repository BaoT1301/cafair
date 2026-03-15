"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors, rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight } from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";

type Stage = "fair" | "screen" | "interview" | "offer" | "day1";

interface Candidate {
  id: string;
  name: string;
  role?: string | null;
  school?: string | null;
  avatarUrl?: string | null;
  fitScore?: number | null;
  stage?: string | null;
  lane?: string | null;
  riskLevel?: string | null;
  [key: string]: unknown;
}

/* ─── Stage config using the app's green design system ─────── */

const STAGES: {
  key: Stage;
  label: string;
  header: { bg: string; text: string; border: string };
  count: { bg: string; text: string };
  pill: { bg: string; text: string; border: string };
  drop: { bg: string; border: string };
  actionLabel: string;
}[] = [
  {
    key: "fair",
    label: "Fair",
    header: { bg: "#f7f7f7", text: "#6b7280", border: "#e2e8e5" },
    count: { bg: "#e2e8e5", text: "#4b5563" },
    pill: { bg: "#f7f7f7", text: "#6b7280", border: "#e2e8e5" },
    drop: { bg: "#f0f0f0", border: "#d1d5db" },
    actionLabel: "Invite",
  },
  {
    key: "screen",
    label: "Screen",
    header: { bg: "#e8f5ee", text: "#1f6b43", border: "#c5e4d1" },
    count: { bg: "#c5e4d1", text: "#0e3d27" },
    pill: { bg: "#e8f5ee", text: "#1f6b43", border: "#c5e4d1" },
    drop: { bg: "#f0faf4", border: "#6fbf9a" },
    actionLabel: "Schedule",
  },
  {
    key: "interview",
    label: "Interview",
    header: { bg: "#d4eddf", text: "#0e3d27", border: "#a3d9b8" },
    count: { bg: "#a3d9b8", text: "#0e3d27" },
    pill: { bg: "#d4eddf", text: "#0e3d27", border: "#a3d9b8" },
    drop: { bg: "#e8f5ee", border: "#6fbf9a" },
    actionLabel: "Review",
  },
  {
    key: "offer",
    label: "Offer",
    header: { bg: "#1f6b43", text: "#ffffff", border: "#0e3d27" },
    count: { bg: "rgba(255,255,255,0.25)", text: "#ffffff" },
    pill: { bg: "#1f6b43", text: "#ffffff", border: "#0e3d27" },
    drop: { bg: "#e8f5ee", border: "#1f6b43" },
    actionLabel: "Follow up",
  },
  {
    key: "day1",
    label: "Day 1",
    header: { bg: "#0e3d27", text: "#abdd64", border: "#0a2e1d" },
    count: { bg: "rgba(171,221,100,0.25)", text: "#abdd64" },
    pill: { bg: "#0e3d27", text: "#abdd64", border: "#0a2e1d" },
    drop: { bg: "#e8f5ee", border: "#0e3d27" },
    actionLabel: "Onboard",
  },
];

const LAST_TOUCH: Record<string, string[]> = {
  fair:      ["Registered", "Arrived at fair", "Checked in"],
  screen:    ["Pre-screen passed", "Verification complete", "Technical screen completed"],
  interview: ["Screen completed", "Interview scheduled", "Portfolio review completed"],
  offer:     ["Offer extended", "Offer being prepared"],
  day1:      ["Onboarding started"],
};

const TIME_LABELS = ["3h ago", "1h ago", "30m ago", "45m ago", "2h ago", "1d ago", "4h ago", "5h ago"];

/* ─── Candidate Card ─────────────────────────────────────────── */

function CandidateCard({
  candidate, stage, index, isDragging = false,
}: {
  candidate: Candidate; stage: Stage; index: number; isDragging?: boolean;
}) {
  const stageConf = STAGES.find(s => s.key === stage)!;
  const score = candidate.fitScore ?? 0;
  const touch = LAST_TOUCH[stage]?.[index % (LAST_TOUCH[stage]?.length ?? 1)] ?? "Registered";
  const time = TIME_LABELS[index % TIME_LABELS.length];
  const initials = getInitials(candidate.name);

  const scoreStyle = score >= 85
    ? { background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", color: "#fff" }
    : { background: "#f7f7f7", color: "#0e3d27" };

  return (
    <div
      className="bg-white rounded-[14px] border p-4 flex flex-col gap-3 transition-all select-none"
      style={{
        borderColor: "#e2e8e5",
        boxShadow: isDragging
          ? "0 16px 32px rgba(0,0,0,0.15)"
          : "0px 1px 4px rgba(0,0,0,0.05)",
        transform: isDragging ? "rotate(1.5deg) scale(1.03)" : undefined,
        opacity: isDragging ? 0.95 : 1,
      }}
    >
      {/* Avatar + Name */}
      <div className="flex items-center gap-3">
        {candidate.avatarUrl ? (
          <img src={candidate.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#e8f5ee" }}
          >
            <span className="text-[11px] font-bold" style={{ color: "#1f6b43" }}>{initials}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#111827" }}>
            {candidate.name}
          </p>
          <p className="text-[11px] truncate" style={{ color: "#6b7280" }}>
            {candidate.role ?? "—"}
          </p>
        </div>
        {/* Score badge */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
          style={scoreStyle}
        >
          {score}
        </div>
      </div>

      {/* Stage pill + score bar */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-[6px] border whitespace-nowrap shrink-0"
          style={{
            background: stageConf.pill.bg,
            color: stageConf.pill.text,
            borderColor: stageConf.pill.border,
          }}
        >
          {stageConf.label}
        </span>
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#f0f0f0" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${score}%`,
              background: score >= 80
                ? "linear-gradient(90deg, #1f6b43, #2e8b57)"
                : score >= 65
                ? "#6fbf9a"
                : "#e2e8e5",
            }}
          />
        </div>
      </div>

      {/* Last touch */}
      <p className="text-[11px]" style={{ color: "#9ca3af" }}>
        {touch} · {time}
      </p>

      {/* Action button */}
      <button
        className="w-full text-[12px] font-semibold py-1.5 rounded-[10px] border transition-colors"
        style={{
          borderColor: stageConf.pill.border,
          background: "transparent",
          color: stageConf.pill.text === "#ffffff" ? stageConf.header.bg : stageConf.pill.text,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = stageConf.pill.bg;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
      >
        {stageConf.actionLabel}
      </button>
    </div>
  );
}

/* ─── Sortable wrapper ────────────────────────────────────────── */

function SortableCard({ candidate, stage, index }: { candidate: Candidate; stage: Stage; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: candidate.id, data: { stage },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes} {...listeners}
    >
      <CandidateCard candidate={candidate} stage={stage} index={index} />
    </div>
  );
}

/* ─── Column ──────────────────────────────────────────────────── */

function Column({ stage, candidates, isOver }: {
  stage: (typeof STAGES)[number]; candidates: Candidate[]; isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage.key });

  return (
    <div className="flex flex-col" style={{ minWidth: 248, width: 248 }}>
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-[12px] border mb-3"
        style={{
          background: stage.header.bg,
          borderColor: stage.header.border,
        }}
      >
        <span className="text-[13px] font-bold" style={{ color: stage.header.text }}>
          {stage.label}
        </span>
        <span
          className="text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
          style={{ background: stage.count.bg, color: stage.count.text }}
        >
          {candidates.length}
        </span>
      </div>

      {/* Drop zone */}
      <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="flex flex-col gap-2.5 flex-1 rounded-[14px] p-2 transition-all"
          style={{
            minHeight: 200,
            background: isOver ? stage.drop.bg : "transparent",
            border: isOver ? `2px dashed ${stage.drop.border}` : "2px solid transparent",
          }}
        >
          {candidates.map((c, i) => (
            <SortableCard key={c.id} candidate={c} stage={stage.key} index={i} />
          ))}

          {candidates.length === 0 && !isOver && (
            <div
              className="flex items-center justify-center h-20 rounded-[12px] border-2 border-dashed"
              style={{ borderColor: "#e2e8e5" }}
            >
              <span className="text-[11px]" style={{ color: "#d1d5db" }}>Drop here</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function PipelinePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  const [dragSnapshot, setDragSnapshot] = useState<Candidate[] | null>(null);
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);

  const updateStage = useMutation(
    trpc.recruiter.updateCandidateStage.mutationOptions({
      onSuccess: () => {
        setLocalCandidates([]);
        queryClient.invalidateQueries({ queryKey: trpc.recruiter.getCandidates.queryKey() });
      },
      onError: () => {
        if (dragSnapshot) setLocalCandidates(dragSnapshot);
      },
    })
  );

  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | null>(null);
  const [overColumn, setOverColumn] = useState<Stage | null>(null);

  const displayCandidates = localCandidates.length > 0 ? localCandidates : candidates;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function getCandidatesByStage(stage: Stage) {
    return displayCandidates.filter(c => (c.stage ?? "fair") === stage);
  }

  function handleDragStart(event: DragStartEvent) {
    const candidate = displayCandidates.find(c => c.id === event.active.id) ?? null;
    setActiveCandidate(candidate);
    setActiveStage((event.active.data.current?.stage as Stage) ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) { setOverColumn(null); return; }
    const overId = over.id as string;
    const stageKey = STAGES.find(s => s.key === overId)?.key;
    if (stageKey) {
      setOverColumn(stageKey);
    } else {
      const overCandidate = displayCandidates.find(c => c.id === overId);
      if (overCandidate) setOverColumn((overCandidate.stage ?? "fair") as Stage);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCandidate(null);
    setActiveStage(null);
    setOverColumn(null);
    if (!over) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    let targetStage: Stage | null = STAGES.find(s => s.key === overId)?.key ?? null;
    if (!targetStage) {
      const overCandidate = displayCandidates.find(c => c.id === overId);
      targetStage = (overCandidate?.stage ?? null) as Stage | null;
    }
    if (!targetStage) return;

    const dragged = displayCandidates.find(c => c.id === draggedId);
    if (!dragged || dragged.stage === targetStage) return;

    setDragSnapshot(displayCandidates as Candidate[]);
    setLocalCandidates(prev => {
      const base = prev.length > 0 ? prev : (candidates as Candidate[]);
      return base.map(c => c.id === draggedId ? { ...c, stage: targetStage! } : c);
    });

    updateStage.mutate({ id: draggedId, stage: targetStage });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#1f6b43", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const totalCount = displayCandidates.length;

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Page Header ── */}
      <div
        className="rounded-2xl px-5 py-4 shrink-0"
        style={{ background: "#f7f7f7", boxShadow: "0px 1px 4px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold" style={{ color: "#111827" }}>
              Pipeline
            </h1>
            {/* Stage breadcrumb */}
            <div className="flex items-center gap-1.5 mt-1">
              {STAGES.map((s, i) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span
                    className="text-[12px] font-medium px-2 py-0.5 rounded-[6px] border"
                    style={{
                      background: s.pill.bg,
                      color: s.pill.text,
                      borderColor: s.pill.border,
                    }}
                  >
                    {s.label}
                    <span className="ml-1.5 opacity-60 font-normal">
                      {getCandidatesByStage(s.key).length}
                    </span>
                  </span>
                  {i < STAGES.length - 1 && (
                    <ChevronRight className="w-3 h-3" style={{ color: "#d1d5db" }} />
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="text-[12px] font-medium px-3 py-1.5 rounded-[10px] border"
              style={{ borderColor: "#e2e8e5", color: "#6b7280", background: "#fff" }}
            >
              {totalCount} candidates total
            </div>
            {updateStage.isPending && (
              <div className="flex items-center gap-2 text-[12px]" style={{ color: "#1f6b43" }}>
                <div
                  className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#1f6b43", borderTopColor: "transparent" }}
                />
                Saving…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Kanban Board ── */}
      <div
        className="rounded-2xl flex-1 overflow-hidden"
        style={{ background: "#f7f7f7", boxShadow: "0px 1px 1px rgba(0,0,0,0.05)" }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto h-full p-4">
            {STAGES.map(stage => (
              <Column
                key={stage.key}
                stage={stage}
                candidates={getCandidatesByStage(stage.key)}
                isOver={overColumn === stage.key}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCandidate && activeStage ? (
              <CandidateCard candidate={activeCandidate} stage={activeStage} index={0} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

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
import { getInitials, getScoreColor } from "@/lib/recruiter-utils";

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

const STAGES = [
  {
    key: "fair" as Stage,
    label: "Fair",
    pillColor: "bg-background text-foreground border-border",
    headerBg: "bg-slate-100",
    headerBorder: "border-slate-200",
    headerText: "text-slate-700",
    countBg: "bg-slate-200",
    countText: "text-slate-600",
    dropBg: "bg-slate-50/50",
    dropBorder: "border-slate-300",
  },
  {
    key: "screen" as Stage,
    label: "Screen",
    pillColor: "bg-blue-50 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50",
    headerBorder: "border-blue-200",
    headerText: "text-blue-800",
    countBg: "bg-blue-100",
    countText: "text-blue-700",
    dropBg: "bg-blue-50/50",
    dropBorder: "border-blue-300",
  },
  {
    key: "interview" as Stage,
    label: "Interview",
    pillColor: "bg-purple-50 text-purple-700 border-purple-200",
    headerBg: "bg-purple-50",
    headerBorder: "border-purple-200",
    headerText: "text-purple-800",
    countBg: "bg-purple-100",
    countText: "text-purple-700",
    dropBg: "bg-purple-50/50",
    dropBorder: "border-purple-300",
  },
  {
    key: "offer" as Stage,
    label: "Offer",
    pillColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    headerBg: "bg-emerald-50",
    headerBorder: "border-emerald-200",
    headerText: "text-emerald-800",
    countBg: "bg-emerald-100",
    countText: "text-emerald-700",
    dropBg: "bg-emerald-50/50",
    dropBorder: "border-emerald-300",
  },
  {
    key: "day1" as Stage,
    label: "Day 1",
    pillColor: "bg-teal-50 text-teal-700 border-teal-200",
    headerBg: "bg-teal-50",
    headerBorder: "border-teal-200",
    headerText: "text-teal-800",
    countBg: "bg-teal-100",
    countText: "text-teal-700",
    dropBg: "bg-teal-50/50",
    dropBorder: "border-teal-300",
  },
];

const ACTION_LABELS: Record<Stage, string> = {
  fair: "Invite", screen: "Schedule", interview: "Review", offer: "Follow up", day1: "Onboard",
};

const LAST_TOUCH: Record<string, string[]> = {
  fair:      ["Registered", "Arrived at fair", "Checked in"],
  screen:    ["Pre-screen passed", "Verification complete", "Technical screen completed"],
  interview: ["Screen completed", "Interview scheduled", "Portfolio review completed"],
  offer:     ["Offer extended", "Offer being prepared"],
  day1:      ["Onboarding started"],
};

const TIME_LABELS = ["3h ago", "1h ago", "30m ago", "45m ago", "2h ago", "1d ago", "4h ago", "5h ago"];


function CandidateCard({
  candidate, stage, index, isDragging = false,
}: {
  candidate: Candidate; stage: Stage; index: number; isDragging?: boolean;
}) {
  const stageConf = STAGES.find(s => s.key === stage)!;
  const score = candidate.fitScore ?? 0;
  const touch = LAST_TOUCH[stage]?.[index % (LAST_TOUCH[stage]?.length ?? 1)] ?? "Registered";
  const time = TIME_LABELS[index % TIME_LABELS.length];

  return (
    <div className={`bg-card rounded-xl border border-border p-4 shadow-sm transition-all ${
      isDragging ? "shadow-xl rotate-1 opacity-90 scale-[1.02]" : "hover:shadow-md hover:-translate-y-0.5"
    }`}>
      <div className="flex items-center gap-3 mb-3">
        {candidate.avatarUrl ? (
          <img src={candidate.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{getInitials(candidate.name)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{candidate.name}</p>
          <p className="text-xs text-muted-foreground truncate">{candidate.role ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${stageConf.pillColor}`}>
          {stageConf.label}
        </span>
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${getScoreColor(score)}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-sm font-bold text-foreground tabular-nums">{score}</span>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">{touch} · {time}</p>

      <button className="w-full text-xs font-medium py-1.5 rounded-lg border border-border bg-gray-200 hover:bg-muted/50 text-foreground transition-colors">
        {ACTION_LABELS[stage]}
      </button>
    </div>
  );
}

function SortableCard({ candidate, stage, index }: { candidate: Candidate; stage: Stage; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: candidate.id, data: { stage },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes} {...listeners}
    >
      <CandidateCard candidate={candidate} stage={stage} index={index} />
    </div>
  );
}

function Column({ stage, candidates, isOver }: {
  stage: (typeof STAGES)[number]; candidates: Candidate[]; isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage.key });
  return (
    <div className="flex flex-col min-w-[240px] w-[240px]">
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border mb-3 ${stage.headerBg} ${stage.headerBorder}`}>
        <span className={`text-sm font-semibold ${stage.headerText}`}>{stage.label}</span>
        <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${stage.countBg} ${stage.countText}`}>
          {candidates.length}
        </span>
      </div>
      <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2.5 flex-1 min-h-[200px] rounded-xl p-2 transition-all ${
            isOver ? `${stage.dropBg} border-2 border-dashed ${stage.dropBorder}` : ""
          }`}
        >
          {candidates.map((c, i) => (
            <SortableCard key={c.id} candidate={c} stage={stage.key} index={i} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelinePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  const updateStage = useMutation(
    trpc.recruiter.updateCandidateStage.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.recruiter.getCandidates.queryKey() }),
    })
  );

  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);
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

    setLocalCandidates(prev => {
      const base = prev.length > 0 ? prev : (candidates as Candidate[]);
      return base.map(c => c.id === draggedId ? { ...c, stage: targetStage! } : c);
    });

    updateStage.mutate({ id: draggedId, stage: targetStage });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          {STAGES.map((s, i) => (
            <span key={s.key} className="flex items-center gap-2">
              {s.label}
              {i < STAGES.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
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
  );
}
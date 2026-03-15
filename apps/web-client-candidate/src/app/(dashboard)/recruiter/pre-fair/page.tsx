"use client";

import { useState, useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { getInitials, getScoreColor } from "@/lib/recruiter-utils";
import {
  FileText, Mic, Code2, PenLine, Undo2, Redo2, Copy,
  ZoomIn, ZoomOut, Zap, Play, ChevronRight, X, Trash2,
  Shield, BarChart2, HelpCircle, UserCheck, CornerDownRight,
  CheckCircle2, Users, Send, Layers,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────
type Template = "conservative" | "high-volume" | "engineering";
type NodeType = "filter" | "action";

interface TreeNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  borderColor: string;
  textColor: string;
  icon: React.ElementType;
  x: number;
  y: number;
  count?: number;
  threshold?: number;
}

interface TreeEdge {
  from: string;
  to: string;
  label: string;
  x1: number; y1: number;
  x2: number; y2: number;
  mx: number; my: number;
}

// ─── Tree templates ───────────────────────────────────────
const TREES: Record<Template, { nodes: TreeNode[]; edges: TreeEdge[] }> = {
  conservative: {
    nodes: [
      { id: "fit", label: "Fit >= 80", type: "filter", color: "bg-pink-50", borderColor: "border-pink-300", textColor: "text-pink-700", icon: BarChart2, x: 310, y: 60, count: 138, threshold: 80 },
      { id: "risk", label: "Risk = High?", type: "filter", color: "bg-red-50", borderColor: "border-red-300", textColor: "text-red-700", icon: Shield, x: 190, y: 180, count: 82 },
      { id: "portfolio", label: "Has portfolio?", type: "filter", color: "bg-yellow-50", borderColor: "border-yellow-300", textColor: "text-yellow-700", icon: FileText, x: 450, y: 180, count: 56 },
      { id: "invite", label: "Auto-invite", type: "action", color: "bg-emerald-50", borderColor: "border-emerald-300", textColor: "text-emerald-700", icon: UserCheck, x: 110, y: 300, count: 82 },
      { id: "screen", label: "3-min screen", type: "action", color: "bg-blue-50", borderColor: "border-blue-300", textColor: "text-blue-700", icon: Mic, x: 290, y: 300, count: 41 },
      { id: "redirect", label: "Redirect", type: "action", color: "bg-slate-50", borderColor: "border-slate-300", textColor: "text-slate-600", icon: CornerDownRight, x: 420, y: 300, count: 15 },
      { id: "assign", label: "Assign recruiter", type: "action", color: "bg-purple-50", borderColor: "border-purple-300", textColor: "text-purple-700", icon: Users, x: 540, y: 300, count: 38 },
    ],
    edges: [
      { from: "fit", to: "risk", label: "Yes", x1: 340, y1: 88, x2: 230, y2: 180, mx: 265, my: 134 },
      { from: "fit", to: "portfolio", label: "No", x1: 380, y1: 88, x2: 480, y2: 180, mx: 445, my: 134 },
      { from: "risk", to: "invite", label: "No", x1: 200, y1: 208, x2: 145, y2: 300, mx: 162, my: 254 },
      { from: "risk", to: "screen", label: "Yes", x1: 240, y1: 208, x2: 315, y2: 300, mx: 293, my: 254 },
      { from: "portfolio", to: "redirect", label: "No", x1: 465, y1: 208, x2: 445, y2: 300, mx: 450, my: 254 },
      { from: "portfolio", to: "assign", label: "Yes", x1: 510, y1: 208, x2: 565, y2: 300, mx: 553, my: 254 },
    ],
  },
  "high-volume": {
    nodes: [
      { id: "musthave", label: "Must-have met?", type: "filter", color: "bg-blue-50", borderColor: "border-blue-300", textColor: "text-blue-700", icon: CheckCircle2, x: 300, y: 60 },
      { id: "fit70", label: "Fit >= 70", type: "filter", color: "bg-pink-50", borderColor: "border-pink-300", textColor: "text-pink-700", icon: BarChart2, x: 200, y: 180 },
      { id: "redirect2", label: "Redirect", type: "action", color: "bg-slate-50", borderColor: "border-slate-300", textColor: "text-slate-600", icon: CornerDownRight, x: 420, y: 180 },
      { id: "invite2", label: "Auto-invite", type: "action", color: "bg-emerald-50", borderColor: "border-emerald-300", textColor: "text-emerald-700", icon: UserCheck, x: 110, y: 300 },
      { id: "screen2", label: "3-min screen", type: "action", color: "bg-blue-50", borderColor: "border-blue-300", textColor: "text-blue-700", icon: Mic, x: 300, y: 300 },
      { id: "assign2", label: "Assign recruiter", type: "action", color: "bg-purple-50", borderColor: "border-purple-300", textColor: "text-purple-700", icon: Users, x: 390, y: 380 },
    ],
    edges: [
      { from: "musthave", to: "fit70", label: "Yes", x1: 310, y1: 88, x2: 230, y2: 180, mx: 255, my: 134 },
      { from: "musthave", to: "redirect2", label: "No", x1: 360, y1: 88, x2: 440, y2: 180, mx: 415, my: 134 },
      { from: "fit70", to: "invite2", label: "Yes", x1: 200, y1: 208, x2: 140, y2: 300, mx: 155, my: 254 },
      { from: "fit70", to: "screen2", label: "No", x1: 245, y1: 208, x2: 320, y2: 300, mx: 298, my: 254 },
      { from: "screen2", to: "assign2", label: "", x1: 340, y1: 328, x2: 415, y2: 380, mx: 390, my: 354 },
    ],
  },
  engineering: {
    nodes: [
      { id: "hascode", label: "Has code?", type: "filter", color: "bg-yellow-50", borderColor: "border-yellow-300", textColor: "text-yellow-700", icon: Code2, x: 300, y: 60 },
      { id: "fit85", label: "Fit >= 85", type: "filter", color: "bg-pink-50", borderColor: "border-pink-300", textColor: "text-pink-700", icon: BarChart2, x: 190, y: 180, threshold: 85, count: 96 },
      { id: "riskeng", label: "Risk = High?", type: "filter", color: "bg-red-50", borderColor: "border-red-300", textColor: "text-red-700", icon: Shield, x: 430, y: 180, count: 42 },
      { id: "inviteeng", label: "Auto-invite", type: "action", color: "bg-emerald-50", borderColor: "border-emerald-300", textColor: "text-emerald-700", icon: UserCheck, x: 100, y: 300 },
      { id: "assigneng", label: "Assign recruiter", type: "action", color: "bg-purple-50", borderColor: "border-purple-300", textColor: "text-purple-700", icon: Users, x: 290, y: 300 },
      { id: "verifyeng", label: "Verify question", type: "action", color: "bg-orange-50", borderColor: "border-orange-300", textColor: "text-orange-700", icon: HelpCircle, x: 480, y: 300 },
    ],
    edges: [
      { from: "hascode", to: "fit85", label: "Yes", x1: 305, y1: 88, x2: 220, y2: 180, mx: 248, my: 134 },
      { from: "hascode", to: "riskeng", label: "No", x1: 355, y1: 88, x2: 455, y2: 180, mx: 420, my: 134 },
      { from: "fit85", to: "inviteeng", label: "Yes", x1: 195, y1: 208, x2: 130, y2: 300, mx: 147, my: 254 },
      { from: "fit85", to: "assigneng", label: "No", x1: 235, y1: 208, x2: 315, y2: 300, mx: 290, my: 254 },
      { from: "riskeng", to: "verifyeng", label: "No", x1: 460, y1: 208, x2: 505, y2: 300, mx: 496, my: 254 },
    ],
  },
};

const SIDEBAR_FILTERS = [
  { label: "Must-have met?", icon: CheckCircle2, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { label: "Fit threshold", icon: BarChart2, color: "text-pink-600 bg-pink-50 border-pink-200" },
  { label: "Risk = High?", icon: Shield, color: "text-red-600 bg-red-50 border-red-200" },
  { label: "Has portfolio", icon: FileText, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { label: "Available?", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
];

const SIDEBAR_ACTIONS = [
  { label: "Auto-invite", icon: UserCheck, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { label: "3-min screen", icon: Mic, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { label: "Verify question", icon: HelpCircle, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { label: "Assign recruiter", icon: Users, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { label: "Redirect", icon: CornerDownRight, color: "text-slate-600 bg-slate-50 border-slate-200" },
];

// ─── Candidate Card ───────────────────────────────────────
function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: any;
  selected: boolean;
  onSelect: () => void;
}) {
  const initials = getInitials(candidate.name);
  const score = candidate.fitScore ?? 0;
  const scoreColor = getScoreColor(score);

  return (
    <div className={`relative border rounded-xl p-3.5 transition-all cursor-pointer ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
      <div className="flex items-start gap-2 mb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 accent-primary w-3.5 h-3.5 shrink-0"
        />
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{candidate.name}</p>
          <p className="text-xs text-muted-foreground truncate">{candidate.school}</p>
        </div>
        <button className="ml-auto">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-2 mb-2 pl-10">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-sm font-bold text-foreground tabular-nums w-6 text-right">{score}</span>
      </div>

      {/* Evidence + badges */}
      <div className="flex items-center gap-1.5 flex-wrap pl-10">
        {["resume", "screen", "code"].map((type) => (
          <span key={type} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-secondary">
            {type === "resume" ? <FileText className="w-2.5 h-2.5" /> : type === "screen" ? <Mic className="w-2.5 h-2.5" /> : <Code2 className="w-2.5 h-2.5" />}
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
          Low
        </span>
        <button className="ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
          <UserCheck className="w-2.5 h-2.5" />
          Invite
        </button>
      </div>
    </div>
  );
}

// ─── Tree Node component ──────────────────────────────────
function TreeNodeEl({
  node,
  selected,
  preview,
  onClick,
}: {
  node: TreeNode;
  selected: boolean;
  preview: boolean;
  onClick: () => void;
}) {
  const Icon = node.icon;
  return (
    <g onClick={onClick} className="cursor-pointer">
      <foreignObject x={node.x - 60} y={node.y} width={120} height={44}>
        <div className={`h-full flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 ${node.color} ${selected ? "border-primary shadow-lg" : node.borderColor} transition-all hover:shadow-md`}>
          <Icon className={`w-3 h-3 shrink-0 ${node.textColor}`} />
          <span className={`text-[11px] font-semibold ${node.textColor} truncate`}>{node.label}</span>
          {preview && node.count !== undefined && (
            <span className="ml-auto text-[10px] font-bold bg-white/80 px-1 rounded shrink-0">{node.count}</span>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

// ─── Main Pre-Fair Page ───────────────────────────────────
export default function PreFairPage() {
  const trpc = useTRPC();
  const { data: candidates = [] } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  const [template, setTemplate] = useState<Template>("conservative");
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [showShortlist, setShowShortlist] = useState(false);
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fitFilter, setFitFilter] = useState(0);
  const [skillFilter, setSkillFilter] = useState<string[]>([]);

  const tree = TREES[template];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleCandidate = useCallback((id: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredCandidates = candidates.filter(c => (c.fitScore ?? 0) >= fitFilter);

  const skills = ["Python", "React", "TypeScript", "Java", "SQL", "PyTorch"];

  const handleSendInvites = () => {
    showToast(`${selectedCandidates.size} invites sent`);
    setSelectedCandidates(new Set());
    setShowShortlist(false);
  };

  const handleSparkTemplate = () => {
    const templates: Template[] = ["conservative", "high-volume", "engineering"];
    const next = templates[(templates.indexOf(template) + 1) % templates.length];
    setTemplate(next);
    showToast(`Loaded ${next} template`);
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-56px)] -mx-6 -mb-6 overflow-hidden">

      {/* ── Left: Candidate Pool ── */}
      <div className="w-[320px] shrink-0 border-r border-border flex flex-col bg-background">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Candidate Pool</h2>
            <span className="text-xs text-muted-foreground">{filteredCandidates.length} candidates</span>
          </div>

          {/* Fit score filter */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-muted-foreground w-5">Fit</span>
            <input
              type="range" min={0} max={100} value={fitFilter}
              onChange={e => setFitFilter(Number(e.target.value))}
              className="flex-1 accent-primary h-1"
            />
            <span className="text-[10px] font-medium text-foreground w-6 text-right">{fitFilter}</span>
          </div>

          {/* Skills filter */}
          <div className="flex flex-wrap gap-1 mb-2">
            {skills.map(skill => (
              <button
                key={skill}
                onClick={() => setSkillFilter(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${skillFilter.includes(skill) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/40"}`}
              >
                {skill}
              </button>
            ))}
          </div>

          {/* Quick filters */}
          <div className="flex gap-2">
            <button className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">High Fit ML</button>
            <button className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">Screen Needed</button>
            <button className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">+ Save</button>
          </div>
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {filteredCandidates.slice(0, 15).map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selectedCandidates.has(c.id)}
              onSelect={() => {
                toggleCandidate(c.id);
                setShowShortlist(true);
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Right: Decision Tree Builder ── */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">

        {/* Builder header */}
        <div className="flex items-center justify-between px-5 py-3 bg-background border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Decision Tree Builder</h2>
            <p className="text-[11px] text-muted-foreground">Drag nodes to build routing rules</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-primary" />
            138 candidates to route
          </div>
        </div>

        {/* Template tabs + toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-background border-b border-border shrink-0">
          <div className="flex gap-1">
            {(["conservative", "high-volume", "engineering"] as Template[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTemplate(t); showToast(`Loaded ${t} template`); setPreview(false); setSelectedNode(null); }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition-colors ${template === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[Undo2, Redo2, Copy].map((Icon, i) => (
              <button key={i} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <button className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground px-1">100%</span>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {template === "engineering" && (
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={handleSparkTemplate}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-400 text-amber-900 rounded-lg hover:bg-amber-300 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Spark
            </button>
            <button
              onClick={() => { setPreview(!preview); if (!preview) showToast("Preview mode on"); }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${preview ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"}`}
            >
              <Play className="w-3 h-3" />
              Preview
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex flex-1 overflow-hidden">

          {/* Node sidebar */}
          <div className="w-[180px] shrink-0 border-r border-border bg-background overflow-y-auto py-3 px-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Filters</p>
            <div className="space-y-1.5 mb-4">
              {SIDEBAR_FILTERS.map((f) => (
                <div key={f.label} className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing ${f.color}`}>
                  <f.icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{f.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Actions</p>
            <div className="space-y-1.5">
              {SIDEBAR_ACTIONS.map((a) => (
                <div key={a.label} className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing ${a.color}`}>
                  <a.icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="flex-1 relative overflow-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px]">

            {/* Spark suggestion */}
            {template === "conservative" && (
              <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full shadow-sm z-10">
                <Zap className="w-3 h-3" />
                SUGGESTIONS
                <span className="text-amber-600 font-semibold">Chain → Assign recruiter</span>
              </div>
            )}

            <svg width="700" height="480" className="absolute top-0 left-0">
              {/* Edges */}
              {tree.edges.map((edge, i) => (
                <g key={i}>
                  <path
                    d={`M ${edge.x1} ${edge.y1} Q ${edge.mx} ${edge.my} ${edge.x2} ${edge.y2}`}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    opacity={0.6}
                  />
                  {edge.label && (
                    <text x={edge.mx} y={edge.my - 4} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500">
                      {edge.label}
                    </text>
                  )}
                </g>
              ))}

              {/* Nodes */}
              {tree.nodes.map((node) => (
                <TreeNodeEl
                  key={node.id}
                  node={node}
                  selected={selectedNode?.id === node.id}
                  preview={preview}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                />
              ))}
            </svg>
          </div>

          {/* Node detail panel */}
          {selectedNode && (
            <div className="w-[220px] shrink-0 border-l border-border bg-background p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border ${selectedNode.color} ${selectedNode.borderColor} ${selectedNode.textColor}`}>
                  <selectedNode.icon className="w-3 h-3" />
                  {selectedNode.label}
                </div>
                <button onClick={() => setSelectedNode(null)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Node Type</p>
                  <p className="text-sm font-medium text-foreground capitalize">{selectedNode.type} Node</p>
                </div>

                {selectedNode.threshold !== undefined && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Threshold</p>
                    <p className="text-2xl font-bold text-foreground">{selectedNode.threshold}</p>
                    <input type="range" min={0} max={100} defaultValue={selectedNode.threshold} className="w-full accent-primary mt-1 h-1" />
                  </div>
                )}

                {selectedNode.count !== undefined && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3 h-3 text-primary" />
                      <p className="text-[9px] font-bold uppercase tracking-wider text-primary">Impact</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{selectedNode.count}</p>
                    <p className="text-[10px] text-muted-foreground">candidates affected</p>
                  </div>
                )}

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Connections</p>
                  <p className="text-sm text-foreground">3 connected branches</p>
                </div>

                {selectedNode.type === "filter" && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Gate Behavior</p>
                    <div className="space-y-1">
                      <p className="text-xs text-foreground">Block High Risk</p>
                      <p className="text-xs text-foreground">Flag for Review</p>
                    </div>
                  </div>
                )}

                <button className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors mt-4">
                  <Trash2 className="w-3 h-3" />
                  Delete node
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview footer */}
        {preview && (
          <div className="px-5 py-2.5 bg-background border-t border-border text-xs text-muted-foreground flex items-center gap-2 shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">Preview Routing:</span>
            82 → Auto-invite · 41 → 3-min screen · 15 → Redirect · 38 → Assign recruiter
          </div>
        )}
      </div>

      {/* ── Shortlist & Outreach panel ── */}
      {showShortlist && selectedCandidates.size > 0 && (
        <div className="w-[260px] shrink-0 border-l border-border bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Shortlist & Outreach</h3>
              <p className="text-xs text-muted-foreground">{selectedCandidates.size} selected</p>
            </div>
            <button onClick={() => { setShowShortlist(false); setSelectedCandidates(new Set()); }} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pre-fair plan stats */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Pre-Fair Plan</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Invites", value: selectedCandidates.size, color: "text-primary" },
                { label: "Screens", value: 0, color: "text-muted-foreground" },
                { label: "Assigned", value: selectedCandidates.size, color: "text-foreground" },
              ].map((s, i) => (
                <div key={i}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Selected candidates */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {candidates
              .filter(c => selectedCandidates.has(c.id))
              .map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {c.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-foreground">{c.fitScore}</span>
                      <span className="text-[10px] px-1 rounded-full bg-primary text-primary-foreground font-medium">Invite</span>
                    </div>
                  </div>
                  <button onClick={() => toggleCandidate(c.id)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
          </div>

          {/* Actions */}
          <div className="px-4 py-4 border-t border-border space-y-2">
            <button
              onClick={handleSendInvites}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              <Send className="w-3.5 h-3.5" />
              Send Invites
            </button>
            <button className="w-full flex items-center justify-center gap-2 text-xs font-medium py-2 border border-border rounded-xl text-foreground hover:bg-muted transition-colors">
              <Layers className="w-3.5 h-3.5" />
              Batch Request Screens
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-lg z-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-foreground">{toast}</span>
        </div>
      )}
    </div>
  );
}
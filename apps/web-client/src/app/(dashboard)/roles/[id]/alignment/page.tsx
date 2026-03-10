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

/* ─── Section Wrapper ────────────────────────────────────────── */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Main Form ──────────────────────────────────────────────── */
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

  // ─── Form State ──────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [expRange, setExpRange] = useState<ExperienceRange>({
    min: 3,
    max: 7,
    autoReject: false,
  });
  const [dealbreakers, setDealbreakers] = useState<Dealbreaker[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>({
    advance: 80,
    review: 65,
    reject: 65,
    autoReject: false,
  });
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [riskTolerance, setRiskTolerance] = useState(50);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [initialized, setInitialized] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Initialize from DB data
  if (role && !initialized) {
    setTitle(role.title ?? "");
    setJobDescription(role.jobDescription ?? "");
    setCriteria((role.criteria as Criterion[]) ?? []);
    setExpRange(
      (role.experienceRange as ExperienceRange) ?? {
        min: 3,
        max: 7,
        autoReject: false,
      },
    );
    setDealbreakers((role.dealbreakers as Dealbreaker[]) ?? []);
    setThresholds(
      (role.thresholds as Thresholds) ?? {
        advance: 80,
        review: 65,
        reject: 65,
        autoReject: false,
      },
    );
    setFocusAreas(role.interviewFocusAreas ?? []);
    setRiskTolerance(role.riskTolerance ?? 50);
    setInitialized(true);
  }

  // ─── Save Handler ────────────────────────────────────────
  const handleSave = useCallback(() => {
    setSaveStatus("saving");
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
  }, [
    roleId,
    title,
    jobDescription,
    criteria,
    expRange,
    dealbreakers,
    thresholds,
    focusAreas,
    riskTolerance,
    saveMutation,
  ]);

  // ─── Generate Criteria Stub ──────────────────────────────
  const handleGenerateCriteria = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      setCriteria([
        { criterion: "System Design", type: "Technical", weight: 25, minReq: 3, evidenceSource: "Interview, Micro-screen" },
        { criterion: "Core Programming", type: "Technical", weight: 25, minReq: 3, evidenceSource: "Resume, Micro-screen" },
        { criterion: "Communication", type: "Soft Skill", weight: 15, minReq: 2, evidenceSource: "Interview transcript" },
        { criterion: "Cloud Infrastructure", type: "Technical", weight: 10, minReq: 0, evidenceSource: "Resume" },
        { criterion: "Leadership", type: "Soft Skill", weight: 10, minReq: 0, evidenceSource: "Interview" },
        { criterion: "Domain Experience", type: "Domain", weight: 5, minReq: 0, evidenceSource: "Resume" },
      ]);
      setGenerating(false);
    }, 1500);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toleranceLabel =
    riskTolerance < 30
      ? "Conservative"
      : riskTolerance < 70
        ? "Balanced"
        : "Aggressive";
  const toleranceDesc =
    riskTolerance < 30
      ? "Conservative: AI considers only proven track record."
      : riskTolerance < 70
        ? "Balanced: AI considers both proven experience and high-potential candidates."
        : "Aggressive: AI is willing to bet on potential and upside.";

  // ─── Scoring Preview ─────────────────────────────────────
  const exampleScores = criteria.map((c) => {
    const score = Math.floor(Math.random() * 3) + 2; // 2-4
    return { ...c, score, weighted: score * (c.weight / 100) * 20 };
  });
  const totalScore = Math.round(
    exampleScores.reduce((sum, s) => sum + s.weighted, 0),
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/roles"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Role Alignment Setup
            </h1>
            <p className="text-xs text-muted-foreground">
              Define what &quot;good&quot; looks like before candidates arrive.
              Takes ~5 minutes.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saveStatus === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveStatus === "saved" ? "Saved!" : "Save & Publish"}
        </button>
      </div>

      {/* a. Position Details */}
      <Section title="Position Details">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground">
              Position Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="mt-1 h-9 w-full max-w-md rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              This will appear on all candidate cards and communications
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here, or write a brief overview of the role, responsibilities, and requirements..."
              rows={8}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              The AI will analyze this to suggest alignment criteria below
            </p>
          </div>
        </div>
      </Section>

      {/* b. Generate / Manual buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerateCriteria}
          disabled={generating}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Criteria with AI
        </button>
        <button
          onClick={() =>
            setCriteria((prev) => [
              ...prev,
              {
                criterion: "",
                type: "",
                weight: 10,
                minReq: 0,
                evidenceSource: "",
              },
            ])
          }
          className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
        >
          Set Criteria Manually
        </button>
      </div>

      {/* c. Success Profile */}
      {criteria.length > 0 && (
        <Section
          title="Success Profile"
          description="Define what a strong candidate looks like for this role"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase">
                  <th className="text-left py-2 font-medium" scope="col">
                    Criterion
                  </th>
                  <th className="text-left py-2 font-medium" scope="col">
                    Type
                  </th>
                  <th className="text-left py-2 font-medium" scope="col">
                    Weight
                  </th>
                  <th className="text-left py-2 font-medium" scope="col">
                    Min Requirement
                  </th>
                  <th className="text-left py-2 font-medium" scope="col">
                    Evidence Source
                  </th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {criteria.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <input
                        value={c.criterion}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[i] = { ...next[i], criterion: e.target.value };
                          setCriteria(next);
                        }}
                        className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={c.type}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[i] = { ...next[i], type: e.target.value };
                          setCriteria(next);
                        }}
                        className="h-8 w-24 rounded border border-border bg-background px-2 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={c.weight}
                          onChange={(e) => {
                            const next = [...criteria];
                            next[i] = {
                              ...next[i],
                              weight: Number(e.target.value),
                            };
                            setCriteria(next);
                          }}
                          className="h-8 w-14 rounded border border-border bg-background px-2 text-sm text-center"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={c.minReq}
                          min={0}
                          max={5}
                          onChange={(e) => {
                            const next = [...criteria];
                            next[i] = {
                              ...next[i],
                              minReq: Number(e.target.value),
                            };
                            setCriteria(next);
                          }}
                          className="h-8 w-12 rounded border border-border bg-background px-2 text-sm text-center"
                        />
                        <span className="text-xs text-muted-foreground">
                          /5
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={c.evidenceSource}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[i] = {
                            ...next[i],
                            evidenceSource: e.target.value,
                          };
                          setCriteria(next);
                        }}
                        className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() =>
                          setCriteria(criteria.filter((_, j) => j !== i))
                        }
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              setCriteria([
                ...criteria,
                {
                  criterion: "",
                  type: "",
                  weight: 10,
                  minReq: 0,
                  evidenceSource: "",
                },
              ])
            }
            className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add Criterion
          </button>
        </Section>
      )}

      {/* d. Experience Range */}
      <Section
        title="Experience Range"
        description="Years of relevant experience you're targeting. This filters candidates early."
      >
        <div className="flex items-center gap-6">
          <div>
            <label className="text-xs font-medium text-foreground">
              Minimum
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={0}
                max={15}
                value={expRange.min}
                onChange={(e) =>
                  setExpRange({ ...expRange, min: Number(e.target.value) })
                }
                className="w-40 accent-primary"
              />
              <span className="text-sm font-medium">{expRange.min} yrs</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Maximum
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={0}
                max={20}
                value={expRange.max}
                onChange={(e) =>
                  setExpRange({ ...expRange, max: Number(e.target.value) })
                }
                className="w-40 accent-primary"
              />
              <span className="text-sm font-medium">{expRange.max} yrs</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Target range: {expRange.min}&ndash;{expRange.max} years
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={expRange.autoReject}
            onChange={(e) =>
              setExpRange({ ...expRange, autoReject: e.target.checked })
            }
            className="rounded accent-primary"
          />
          Auto-reject candidates outside the range (requires recruiter batch
          approval)
        </label>
      </Section>

      {/* e. Dealbreakers */}
      <Section
        title="Dealbreakers"
        description="Conditions that automatically disqualify candidates"
      >
        <div className="space-y-3">
          {dealbreakers.map((d, i) => (
            <div
              key={i}
              className="rounded-xl border border-border p-4 space-y-2"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">
                    Rule
                  </label>
                  <input
                    value={d.rule}
                    onChange={(e) => {
                      const next = [...dealbreakers];
                      next[i] = { ...next[i], rule: e.target.value };
                      setDealbreakers(next);
                    }}
                    className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">
                    Trigger Condition
                  </label>
                  <input
                    value={d.triggerCondition}
                    onChange={(e) => {
                      const next = [...dealbreakers];
                      next[i] = {
                        ...next[i],
                        triggerCondition: e.target.value,
                      };
                      setDealbreakers(next);
                    }}
                    className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">
                    Action
                  </label>
                  <input
                    value={d.action}
                    onChange={(e) => {
                      const next = [...dealbreakers];
                      next[i] = { ...next[i], action: e.target.value };
                      setDealbreakers(next);
                    }}
                    className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  setDealbreakers(dealbreakers.filter((_, j) => j !== i))
                }
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setDealbreakers([
              ...dealbreakers,
              { rule: "", triggerCondition: "", action: "" },
            ])
          }
          className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
        >
          <Plus className="h-3 w-3" /> Add Dealbreaker
        </button>
      </Section>

      {/* f. Decision Thresholds */}
      <Section
        title="Decision Thresholds"
        description="Define when candidates should advance or be rejected"
      >
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-primary">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-semibold">Advance</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Score threshold</p>
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={thresholds.advance}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    advance: Number(e.target.value),
                  })
                }
                className="h-8 w-14 rounded border border-border bg-background px-2 text-sm text-center font-semibold"
              />
              <span className="text-xs text-muted-foreground">&ge;</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              AND all must-have criteria pass minimum requirement
            </p>
          </div>
          <div className="rounded-xl border border-border p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold">Review</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Score range</p>
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={thresholds.review}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    review: Number(e.target.value),
                  })
                }
                className="h-8 w-14 rounded border border-border bg-background px-2 text-sm text-center font-semibold"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <span className="text-sm font-semibold">
                {thresholds.advance - 1}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-border p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-red-500">
              <XCircle className="h-4 w-4" />
              <span className="text-xs font-semibold">Reject</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Score threshold</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-xs text-muted-foreground">&lt;</span>
              <input
                type="number"
                value={thresholds.reject}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    reject: Number(e.target.value),
                  })
                }
                className="h-8 w-14 rounded border border-border bg-background px-2 text-sm text-center font-semibold"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              OR dealbreaker triggered
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={thresholds.autoReject}
            onChange={(e) =>
              setThresholds({
                ...thresholds,
                autoReject: e.target.checked,
              })
            }
            className="rounded accent-primary"
          />
          Auto-reject candidates below threshold (requires recruiter batch
          approval)
        </label>
      </Section>

      {/* g. Interview Focus Areas */}
      <Section
        title="Interview Focus Areas"
        description="Key topics for interview prompts. The AI uses these to generate question guides."
      >
        <div className="space-y-2">
          {focusAreas.map((area, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <input
                value={area}
                onChange={(e) => {
                  const next = [...focusAreas];
                  next[i] = e.target.value;
                  setFocusAreas(next);
                }}
                className="h-8 flex-1 rounded border border-border bg-background px-2 text-sm"
              />
              <button
                onClick={() => setFocusAreas(focusAreas.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setFocusAreas([...focusAreas, ""])}
          className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
        >
          <Plus className="h-3 w-3" /> Add Focus Area
        </button>
        <p className="text-[10px] text-muted-foreground">
          Input type: Multi-entry text list. Recommended: 3-5 areas
        </p>
      </Section>

      {/* h. Risk Tolerance */}
      <Section
        title="Risk Tolerance"
        description="Conservative = proven track record only. Aggressive = willing to bet on potential."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={100}
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-lg font-bold text-foreground w-12 text-right">
              {riskTolerance}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Conservative (safe hire)</span>
            <span>Aggressive (high upside)</span>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{toleranceLabel}:</strong>{" "}
              {toleranceDesc}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Input type: Slider (0-100). Default: 50% (balanced)
          </p>
        </div>
      </Section>

      {/* i. Scoring Logic Preview */}
      {criteria.length > 0 && (
        <Section
          title="Scoring Logic Preview"
          description="See how the AI calculates fit scores based on your configuration"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="text-sm font-semibold">Formula</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fit Score (0-100) = Sum of (criterion score x weight)
              </p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-primary">
                  Example Breakdown:
                </p>
                {exampleScores.map((s, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {s.criterion}: {s.score}/5 x {s.weight}%
                    </span>
                    <span className="font-medium text-foreground">
                      = {Math.round(s.weighted)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold text-primary border-t border-border pt-1 mt-1">
                  <span>Final Score</span>
                  <span>{totalScore}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              This is a preview using sample scores. Actual candidate scores
              will be calculated using real evidence from resumes, interviews,
              and micro-screens.
            </div>
          </div>
        </Section>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Link href="/roles" className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50"
        >
          {saveStatus === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save & Publish
        </button>
      </div>
    </div>
  );
}

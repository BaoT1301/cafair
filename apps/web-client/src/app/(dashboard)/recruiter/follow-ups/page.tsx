"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Star, FileText, Calendar, CheckCircle, Clock, Mail } from "lucide-react";
import { FitScoreBar } from "@/components/recruiter/FitScoreBar";
import { getInitials } from "@/lib/recruiter-utils";

// ─── Follow-up status helpers ────────────────────────────
type FollowUpStatus = "drafted" | "sent" | "scheduled" | "pending";

const followUpConfig: Record<FollowUpStatus, { icon: React.ElementType; cls: string }> = {
  drafted: { icon: FileText, cls: "text-blue-600" },
  sent: { icon: CheckCircle, cls: "text-emerald-600" },
  scheduled: { icon: Calendar, cls: "text-purple-600" },
  pending: { icon: Clock, cls: "text-muted-foreground" },
};

function FollowUpBadge({ status }: { status: FollowUpStatus }) {
  const config = followUpConfig[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium capitalize ${config.cls}`}>
      <config.icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}


// ─── Main Page ───────────────────────────────────────────
export default function FollowUpsPage() {
  const trpc = useTRPC();
  const { data: candidates, isLoading } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Simulate follow-up statuses
  const statuses: FollowUpStatus[] = ["drafted", "sent", "scheduled", "pending"];
  const getFollowUpStatus = (i: number): FollowUpStatus => statuses[i % statuses.length];

  // Completion stats
  const total = candidates?.length ?? 0;
  const drafted = candidates?.filter((_, i) => getFollowUpStatus(i) === "drafted").length ?? 0;
  const sent = candidates?.filter((_, i) => getFollowUpStatus(i) === "sent").length ?? 0;
  const scheduled = candidates?.filter((_, i) => getFollowUpStatus(i) === "scheduled").length ?? 0;
  const pending = candidates?.filter((_, i) => getFollowUpStatus(i) === "pending").length ?? 0;
  const completedCount = drafted + sent + scheduled;
  const completionPct = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  const selected = candidates?.find(c => c.id === selectedId);

  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Post-fair candidate engagement & scheduling</p>
      </div>

      <div className="flex gap-5">
        {/* Left panel — candidate list */}
        <div className="flex-1 min-w-0">
          {/* Completion Progress */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Completion Progress</p>
              <span className="text-sm font-bold text-primary tabular-nums">{completionPct}%</span>
            </div>
            <div className="h-2.5 bg-border rounded-full overflow-hidden mb-2.5">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="flex items-center gap-5">
              <LegendDot color="bg-blue-500" label={`Drafted: ${drafted}`} />
              <LegendDot color="bg-emerald-500" label={`Sent: ${sent}`} />
              <LegendDot color="bg-purple-500" label={`Scheduled: ${scheduled}`} />
              <LegendDot color="bg-muted-foreground" label={`Pending: ${pending}`} />
            </div>
          </div>

          {/* Candidate Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["", "Candidate", "Fit", "Status", "Follow-up", "Action"].map((h, i) => (
                    <th key={i} scope="col" className="text-left text-[10px] font-semibold text-muted-foreground px-3 py-3 uppercase tracking-wider first:pl-4 last:pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates?.map((c, i) => {
                  const fStatus = getFollowUpStatus(i);
                  const isSelected = c.id === selectedId;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(isSelected ? null : c.id)}
                      className={`border-b border-border last:border-0 transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      <td className="pl-4 pr-1 py-3">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded border-border accent-primary" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-primary">
                                {getInitials(c.name)}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <FitScoreBar score={c.fitScore ?? 0} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <Star className="w-3 h-3" />
                          {c.verified ? "Verified" : "Priority"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <FollowUpBadge status={fStatus} />
                      </td>
                      <td className="px-3 py-3 pr-4">
                        <button className="text-xs font-medium text-primary hover:underline">
                          Preview Email
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right panel — email preview */}
        <div className="w-[300px] shrink-0">
          <div className="bg-card border border-border rounded-xl p-5 sticky top-20 shadow-sm">
            {selected ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Follow-up Email Preview</h3>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">To</p>
                    <p className="text-foreground">{selected.email || `${selected.name.toLowerCase().replace(/\s/g, ".")}@email.com`}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Subject</p>
                    <p className="text-foreground">Following up — {selected.role} at Tech Talent Expo</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-foreground leading-relaxed">
                      Hi {selected.name.split(" ")[0]},<br /><br />
                      Thank you for stopping by our booth at Tech Talent Expo 2026. We were impressed by your background
                      {selected.strengths && selected.strengths.length > 0 && `, especially your experience in ${selected.strengths[0]}`}.
                      <br /><br />
                      We&apos;d love to continue the conversation about the {selected.role} position. Would you be available for a follow-up call this week?
                      <br /><br />
                      Best regards,<br />
                      The Recruiting Team
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Select a candidate to preview the follow-up email</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Legend Dot ──────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

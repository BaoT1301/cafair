import { getScoreColor } from "@/lib/recruiter-utils";

interface FitScoreBarProps {
  score: number;
  width?: string;
}

export function FitScoreBar({ score, width = "w-16" }: FitScoreBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`${width} h-2 bg-border rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full ${getScoreColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold text-foreground tabular-nums">
        {score}
      </span>
    </div>
  );
}

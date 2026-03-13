/**
 * Shared utility functions and constants for the recruiter domain.
 * Extracted from duplicated inline definitions across pages.
 */

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 80) return "bg-primary";
  if (score >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

export const AVATAR_COLORS = [
  "bg-primary/80",
  "bg-purple-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-rose-500",
];

export const STAGE_ORDER = [
  "fair",
  "screen",
  "interview",
  "offer",
  "day1",
] as const;
export type Stage = (typeof STAGE_ORDER)[number];

/** Primary brand gradient — use this everywhere instead of inline style strings */
export const PRIMARY_GRADIENT = "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)";

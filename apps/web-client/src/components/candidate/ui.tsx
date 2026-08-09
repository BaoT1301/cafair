"use client";

/**
 * Candidate UI primitives.
 * ────────────────────────────────────────────────────────────────────────
 * The recruiter pages write every card and badge inline, which is why the
 * same 40-character class string appears ~80 times across the codebase. The
 * candidate app uses the identical visual language but factors it into these
 * primitives — same pixels, one definition.
 *
 * Values are lifted verbatim from the recruiter System A pages:
 *   surface  #f7f7f7   card #ffffff   border #e2e8e5
 *   brand    #0e3d27 → #1f6b43 → #2e8b57   tint #e8f5ee   lime-on-dark #abdd64
 *   text     #111827 / #4b5563 / #6b7280 / #9ca3af
 *   radius   16px panels & grid cards, 14px feed cards, 10px nav, 8px inputs
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const BRAND = "#0e3d27";
export const BRAND_2 = "#1f6b43";
export const BRAND_3 = "#2e8b57";
export const BRAND_TINT = "#e8f5ee";
export const LIME = "#abdd64";
export const PRIMARY_GRADIENT =
  "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)";

/** The house entrance animation. Copied from the recruiter list pages. */
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      delay: Math.min(i, 10) * 0.045,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

/**
 * Standard page frame: a fixed header panel plus a scrolling content panel,
 * both grey surfaces holding white cards.
 */
export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <motion.div
        initial="hidden"
        animate="visible"
        custom={0}
        variants={fadeUp}
        className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex items-start justify-between gap-4 shrink-0"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.006em]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[14px] font-normal text-[#4b5563] leading-5 tracking-[-0.015em]">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        custom={1}
        variants={fadeUp}
        className="bg-[#f7f7f7] rounded-[16px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto"
      >
        {children}
      </motion.div>
    </div>
  );
}

/** White grid card — `bg-white rounded-[16px] p-[25px]`. */
export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-[16px] p-[25px] flex flex-col gap-4 w-full min-w-0",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[18px] font-bold text-[#111827] leading-7 tracking-[-0.045em]">
      {children}
    </h2>
  );
}

export function CardSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] font-normal text-[#4b5563] leading-5 tracking-[-0.015em]">
      {children}
    </p>
  );
}

type Tone = "brand" | "amber" | "red" | "neutral";

const TONES: Record<Tone, { bg: string; dot: string; text: string }> = {
  brand: { bg: "bg-[#e8f5ee]", dot: "bg-[#1f6b43]", text: "text-[#1f6b43]" },
  amber: { bg: "bg-[#fef3c7]", dot: "bg-[#92400e]", text: "text-[#92400e]" },
  red: { bg: "bg-[#fee2e2]", dot: "bg-[#991b1b]", text: "text-[#991b1b]" },
  neutral: { bg: "bg-[#f7f7f7]", dot: "bg-[#6b7280]", text: "text-[#4b5563]" },
};

/** Dot-pill status badge. Matches `roles/page.tsx` StatusBadge exactly. */
export function Badge({
  tone = "brand",
  dot = true,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  const c = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-[9px] py-[2px] rounded-[14px] text-[12px] font-normal leading-4 whitespace-nowrap",
        c.bg,
        c.text,
      )}
    >
      {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />}
      {children}
    </span>
  );
}

/** Small square tag — `rounded-[6px]`, 10px bold. */
export function Tag({
  children,
  filled = false,
}: {
  children: React.ReactNode;
  filled?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-[10px] px-2 py-[2px] rounded-[6px] leading-[15px] tracking-[0.117px] whitespace-nowrap",
        filled
          ? "font-bold bg-[#1f6b43] text-white"
          : "font-medium bg-[#f7f7f7] text-[#4b5563]",
      )}
    >
      {children}
    </span>
  );
}

/** Primary CTA with the house gradient. */
export function PrimaryButton({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] px-5 py-2.5 text-[14px] font-semibold text-white tracking-[-0.015em] transition-all duration-150 active:scale-[0.97] hover:brightness-[1.05] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        className,
      )}
      style={{ background: PRIMARY_GRADIENT }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] px-5 py-2.5 text-[14px] font-semibold text-[#0e3d27] tracking-[-0.015em] bg-white border border-[#e2e8e5] transition-all duration-150 active:scale-[0.97] hover:bg-[#e8f5ee] disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Horizontal progress bar — the codebase's single most repeated micro-pattern. */
export function Meter({
  value,
  color = BRAND_2,
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 bg-[#e2e8e5] rounded-full overflow-hidden w-full", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Circular score dial used on the candidate's own assessment. */
export function ScoreRing({
  score,
  size = 132,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8e5"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={BRAND_2}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-bold text-[#111827] leading-none tabular-nums">
          {pct}
        </span>
        {label && (
          <span className="text-[11px] font-medium text-[#6b7280] mt-1">{label}</span>
        )}
      </div>
    </div>
  );
}

/** Bottom-centre toast with the house gradient. Hand-rolled, like the recruiter pages. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed bottom-6 left-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-[14px] shadow-xl"
      style={{
        transform: "translateX(-50%)",
        background: PRIMARY_GRADIENT,
        color: "#fff",
        minWidth: 240,
      }}
    >
      <span className="text-[13px] font-medium">{message}</span>
      <button
        onClick={onDone}
        className="ml-auto opacity-60 hover:opacity-100 text-[13px]"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </motion.div>
  );
}

/** Empty state. */
export function Empty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[16px] flex flex-col items-center justify-center py-20 gap-4 px-6">
      <div className="w-14 h-14 rounded-full bg-[#e8f5ee] flex items-center justify-center">
        <Icon className="w-7 h-7 text-[#1f6b43]" />
      </div>
      <div className="text-center">
        <p className="text-[16px] font-semibold text-[#111827]">{title}</p>
        <p className="text-[14px] text-[#6b7280] mt-1 max-w-sm">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** Inline skeleton matching the recruiter pages' `animate-pulse` blocks. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-[16px] p-[25px] animate-pulse flex flex-col gap-4">
          <div className="h-5 bg-[#e2e8e5] rounded w-2/3" />
          <div className="h-3 bg-[#e2e8e5] rounded w-1/2" />
          <div className="h-2 bg-[#e2e8e5] rounded-full w-full mt-2" />
          <div className="h-2 bg-[#e2e8e5] rounded-full w-4/5" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RefreshCcw,
  WifiOff,
  ShieldAlert,
  FileX2,
  Home,
  ArrowLeft,
  Bug,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ============================================================================
// Error Icon Map
// ============================================================================

const errorIcons = {
  general: AlertCircle,
  network: WifiOff,
  auth: ShieldAlert,
  notFound: FileX2,
  bug: Bug,
} as const;

type ErrorVariant = keyof typeof errorIcons;

// ============================================================================
// Full Page Error — Centered error with retry + navigation options
// ============================================================================

interface PageErrorProps {
  title?: string;
  message?: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  showHomeLink?: boolean;
  showBackButton?: boolean;
  className?: string;
}

export function PageError({
  title = "Something went wrong",
  message = "Something unexpected happened. Please try again.",
  variant = "general",
  onRetry,
  showHomeLink = true,
  showBackButton = true,
  className,
}: PageErrorProps) {
  const router = useRouter();
  const IconComponent = errorIcons[variant];

  return (
    <div
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-4",
        className,
      )}
    >
      {/* Error icon with animated ring */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-destructive/10 blur-xl scale-150 animate-pulse" />
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-full border border-destructive/20 bg-card shadow-lg"
          animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <IconComponent className="h-9 w-9 text-destructive" />
        </motion.div>
      </div>

      {/* Error text */}
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="default"
            size="default"
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Try Again
          </Button>
        )}
        {showBackButton && (
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="default"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        )}
        {showHomeLink && (
          <Button variant="ghost" size="default" asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
        )}
      </div>

      {/* Decorative error code lines */}
      <div className="mt-4 flex flex-col items-center gap-1 opacity-30">
        <div className="h-px w-32 bg-border" />
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {variant === "network"
            ? "ERR_NETWORK"
            : variant === "auth"
              ? "ERR_UNAUTHORIZED"
              : variant === "notFound"
                ? "ERR_NOT_FOUND"
                : "ERR_UNKNOWN"}
        </p>
        <div className="h-px w-32 bg-border" />
      </div>
    </div>
  );
}

// ============================================================================
// Card Error — Error state for card-sized sections
// ============================================================================

interface CardErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function CardError({
  title = "Failed to load",
  message = "We couldn't load this section. Give it another try!",
  onRetry,
  className,
}: CardErrorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground max-w-xs">
          {message}
        </p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Inline Error — Small inline error indicator
// ============================================================================

interface InlineErrorProps {
  message?: string;
  className?: string;
}

export function InlineError({
  message = "Error loading data",
  className,
}: InlineErrorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="h-3.5 w-3.5" />
      {message}
    </span>
  );
}

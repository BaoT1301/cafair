"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Suspense, type ReactNode } from "react";
import { Button } from "@starter/ui/button";
import { Skeleton } from "@starter/ui/skeleton";
import { PageLoading } from "@/components/loading";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface AsyncBoundaryProps {
  children: ReactNode;
  /** Custom loading UI. Defaults to a generic skeleton. */
  loadingFallback?: ReactNode;
  /** Custom error UI. Defaults to a generic error card. */
  errorFallback?: (props: FallbackProps) => ReactNode;
}

export function AsyncBoundary({
  children,
  loadingFallback = (
    <PageLoading variant="spinner" message="Loading content..." />
  ),
  errorFallback,
}: AsyncBoundaryProps) {
  return (
    // 1. Catches Retry logic from React Query
    <QueryErrorResetBoundary>
      {({ reset }: { reset: () => void }) => (
        // 2. Catches Errors (throwing)
        <ErrorBoundary
          onReset={reset}
          fallbackRender={errorFallback || DefaultError}
        >
          {/* 3. Catches Loading (suspending) */}
          <Suspense fallback={loadingFallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

// --- Default UI Components ---

function DefaultLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg h-full w-full">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-62.5" />
          <Skeleton className="h-4 w-50" />
        </div>
      </div>
      <Skeleton className="h-31.25 w-full rounded-xl" />
    </div>
  );
}

function DefaultError({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex items-center justify-center p-6 border border-destructive/50 bg-destructive/5 rounded-lg">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-destructive/10 rounded-full">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Failed to load data</h3>
          <p className="text-sm text-muted-foreground max-w-75">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={resetErrorBoundary}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}

"use client";

import { PageError } from "@/components/error-display";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <PageError
      title="Something went wrong"
      message={error.message || "An unexpected error occurred. Please try again."}
      onRetry={reset}
    />
  );
}

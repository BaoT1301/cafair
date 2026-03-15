"use client";

import { useCallback, useRef, useState } from "react";

export interface SocialScreenRunStartInput {
  candidateId?: string;
  candidateLabel: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  webQueries?: string[];
  roleTitle?: string;
  companyName?: string;
  localBrowser?: boolean;
  manualLinkedinLogin?: boolean;
  traceRedact?: "full" | "partial" | "off";
  useRealBedrock?: boolean;
}

export interface SocialScreenStreamEvent {
  type: "status" | "finding" | "log" | "done" | "error";
  timestampISO?: string;
  stage?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SocialScreenRunReportResponse {
  ok: boolean;
  ready?: boolean;
  runId?: string;
  status?: string;
  manifest?: unknown;
  report?: unknown;
  error?: string;
  details?: string;
}

export function useSocialScreenRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [events, setEvents] = useState<SocialScreenStreamEvent[]>([]);
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setRunId(null);
    setStatus("idle");
    setEvents([]);
    setReport(null);
    setError(null);
  }, []);

  const fetchReport = useCallback(async (reportUrl: string) => {
    const response = await fetch(reportUrl);
    const payload = (await response.json()) as SocialScreenRunReportResponse;
    if (payload.ok && payload.ready) {
      setReport(payload.report ?? null);
      setStatus(String(payload.status ?? "completed"));
    }
    return payload;
  }, []);

  const startRun = useCallback(async (input: SocialScreenRunStartInput) => {
    setStatus("starting");
    setError(null);
    setEvents([]);
    setReport(null);

    const response = await fetch("/api/aihire/social-screen/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      runId?: string;
      streamUrl?: string;
      reportUrl?: string;
      status?: string;
      error?: string;
      details?: string;
    };

    if (!payload.ok || !payload.runId || !payload.streamUrl || !payload.reportUrl) {
      setStatus("failed");
      setError(payload.details ?? payload.error ?? "Failed to start social screen run.");
      return payload;
    }

    setRunId(payload.runId);
    setStatus(payload.status ?? "queued");

    const source = new EventSource(payload.streamUrl);
    sourceRef.current = source;

    const handleEvent = (type: SocialScreenStreamEvent["type"]) => (event: MessageEvent<string>) => {
      const parsed = JSON.parse(event.data) as SocialScreenStreamEvent;
      setEvents((current) => [...current, parsed]);
      if (type === "status" && parsed.data?.status) {
        setStatus(String(parsed.data.status));
      }
      if (type === "done") {
        void fetchReport(payload.reportUrl!);
        source.close();
      }
      if (type === "error") {
        setStatus("failed");
        setError(parsed.message);
      }
    };

    source.addEventListener("status", handleEvent("status"));
    source.addEventListener("finding", handleEvent("finding"));
    source.addEventListener("log", handleEvent("log"));
    source.addEventListener("done", handleEvent("done"));
    source.addEventListener("error", handleEvent("error"));
    source.onerror = () => {
      source.close();
    };

    return payload;
  }, [fetchReport]);

  return {
    runId,
    status,
    events,
    report,
    error,
    startRun,
    fetchReport,
    reset,
  };
}


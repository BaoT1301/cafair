// Path: apps/web-client/src/app/api/aihire/apply-agent/history/route.ts

import { NextResponse } from "next/server";

type ApplyAgentHistoryItem = {
  id: string;
  createdAt: string;
  mode: "match" | "run";
  status: "queued" | "running" | "completed" | "failed";
  summary: string;
  targetUrl?: string;
  company?: string;
  roleTitle?: string;
  matchedKeywordCount?: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __aihireApplyAgentHistoryStore:
    | ApplyAgentHistoryItem[]
    | undefined;
}

const historyStore: ApplyAgentHistoryItem[] =
  globalThis.__aihireApplyAgentHistoryStore ?? [];

if (!globalThis.__aihireApplyAgentHistoryStore) {
  globalThis.__aihireApplyAgentHistoryStore = historyStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeHistoryId(): string {
  return `aah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getHistory(): ApplyAgentHistoryItem[] {
  return [...historyStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function addApplyAgentHistoryItem(
  item: Omit<ApplyAgentHistoryItem, "id" | "createdAt">,
): ApplyAgentHistoryItem {
  const nextItem: ApplyAgentHistoryItem = {
    id: makeHistoryId(),
    createdAt: nowIso(),
    ...item,
  };

  historyStore.unshift(nextItem);
  return nextItem;
}

export function updateApplyAgentHistoryItem(
  id: string,
  updates: Partial<Omit<ApplyAgentHistoryItem, "id" | "createdAt">>,
): ApplyAgentHistoryItem | null {
  const index = historyStore.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  historyStore[index] = {
    ...historyStore[index],
    ...updates,
  };

  return historyStore[index];
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    total: historyStore.length,
    items: getHistory(),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ApplyAgentHistoryItem>;

    if (!body?.mode || (body.mode !== "match" && body.mode !== "run")) {
      return NextResponse.json(
        {
          ok: false,
          error: 'mode is required and must be either "match" or "run".',
        },
        { status: 400 },
      );
    }

    if (
      !body?.status ||
      !["queued", "running", "completed", "failed"].includes(body.status)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'status is required and must be one of "queued", "running", "completed", or "failed".',
        },
        { status: 400 },
      );
    }

    if (!body?.summary || typeof body.summary !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "summary is required and must be a string.",
        },
        { status: 400 },
      );
    }

    const created = addApplyAgentHistoryItem({
      mode: body.mode,
      status: body.status,
      summary: body.summary.trim(),
      targetUrl:
        typeof body.targetUrl === "string" && body.targetUrl.trim()
          ? body.targetUrl.trim()
          : undefined,
      company:
        typeof body.company === "string" && body.company.trim()
          ? body.company.trim()
          : undefined,
      roleTitle:
        typeof body.roleTitle === "string" && body.roleTitle.trim()
          ? body.roleTitle.trim()
          : undefined,
      matchedKeywordCount:
        typeof body.matchedKeywordCount === "number"
          ? body.matchedKeywordCount
          : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        item: created,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create apply-agent history item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
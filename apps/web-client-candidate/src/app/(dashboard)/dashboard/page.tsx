"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { AsyncBoundary } from "@/components/async-boundary";

export default function DashboardPage() {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(trpc.protectedHello.queryOptions());

  return (
    <AsyncBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
          <p className="text-muted-foreground">
            Here&apos;s your dashboard overview.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Hello Message</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
              ) : (
                <p className="text-lg">{data?.greeting}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/theme-editor"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                🎨 Theme Editor
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Add your metrics and charts.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AsyncBoundary>
  );
}

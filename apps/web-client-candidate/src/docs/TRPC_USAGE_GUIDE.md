# tRPC Usage Guide

> How to use tRPC with TanStack Query in this project.

---

## Setup Overview

```
trpc/client.tsx      → useTRPC()       (client-side React hook)
trpc/server.tsx      → trpc            (server-side proxy, RSC)
                     → HydrateClient   (SSR dehydration boundary)

server/init.ts       → authedProcedure (requires Clerk session)
                     → publicProcedure (no auth)

server/routers/app.ts → appRouter      (root router merging all service routers)
```

---

## Key Imports

```tsx
// Client component
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { AsyncBoundary } from "@/components/async-boundary";
import { PageError, CardError, InlineError } from "@/components/error-display";

// Server component (RSC prefetch)
import { trpc } from "@/trpc/server";
import { HydrateClient } from "@/trpc/server";
```

---

## Queries

### Basic query

```tsx
"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

function MyComponent() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.yourFeature.list.queryOptions(),
  );

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

### Suspense query (with AsyncBoundary)

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { AsyncBoundary } from "@/components/async-boundary";

function Inner() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.yourFeature.list.queryOptions());
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

function Page() {
  return (
    <AsyncBoundary>
      <Inner />
    </AsyncBoundary>
  );
}
```

`AsyncBoundary` wraps `Suspense` + `ErrorBoundary`, showing `PageLoading` and `PageError` automatically.

---

## Mutations

```tsx
import { useMutation } from "@tanstack/react-query";

function CreateButton() {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.yourFeature.create.mutationOptions());

  return (
    <button
      onClick={() => mutation.mutate({ title: "New item" })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? "Creating..." : "Create"}
    </button>
  );
}
```

---

## SSR Prefetching

Prefetch data on the server for instant page loads:

```tsx
// app/(dashboard)/your-feature/page.tsx (Server Component)
import { trpc, HydrateClient } from "@/trpc/server";
import { YourClientComponent } from "./client";

export default async function Page() {
  // Prefetch — data is ready by the time the client renders
  void trpc.yourFeature.list.prefetch();

  return (
    <HydrateClient>
      <YourClientComponent />
    </HydrateClient>
  );
}
```

---

## Error Handling Pattern

```tsx
import { AsyncBoundary } from "@/components/async-boundary";
import { PageError, CardError, InlineError } from "@/components/error-display";

// Full-page error
<AsyncBoundary>
  <PageContent />
</AsyncBoundary>

// Card-level error
<AsyncBoundary
  errorFallback={(error, reset) => (
    <CardError
      title="Failed to load"
      message={error.message}
      onRetry={reset}
    />
  )}
>
  <CardContent />
</AsyncBoundary>

// Inline error
{error && <InlineError message={error.message} />}
```

---

## Available Routers

| Router           | Procedures                                      | Auth     |
| ---------------- | ----------------------------------------------- | -------- |
| `hello`          | inline greeting                                 | public   |
| `protectedHello` | auth test                                       | required |
| `users`          | getMe, update, etc.                             | required |
| `examples`       | list, create, etc.                              | required |
| `uploads`        | upload, list, remove                            | required |
| `recruiter`      | getCandidates, scoreCandidate, getActions, etc. | required |

---

## `useSuspenseQuery` vs `useQuery`

| Hook               | Suspense? | Error Boundary? | When to use                  |
| ------------------ | --------- | --------------- | ---------------------------- |
| `useSuspenseQuery` | Yes       | Yes             | Inside `<AsyncBoundary>`     |
| `useQuery`         | No        | No              | Manual loading/error control |

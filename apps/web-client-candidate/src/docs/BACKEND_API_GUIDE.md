# Backend API Guide — FairSignal Recruiter

> For frontend developers. All procedures are on the `recruiter` router.

## Quick Start

```tsx
"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```

Every example below assumes this import block.

---

## Available Procedures

### Queries (read data)

| Procedure                   | Input             | Returns                      | When to use                        |
| --------------------------- | ----------------- | ---------------------------- | ---------------------------------- |
| `getCandidates`             | —                 | `Candidate[]`                | Candidate list page, dashboard     |
| `getCandidateById`          | `{ id }`          | `Candidate`                  | Candidate detail view              |
| `getCandidateWithEvidence`  | `{ id }`          | `Candidate & { evidence[] }` | Detail view with resume/code links |
| `getRoles`                  | —                 | `JobRole[]`                  | Role list, dropdowns               |
| `getEvents`                 | —                 | `Event[]`                    | Event selector                     |
| `getActiveEvent`            | —                 | `Event \| null`              | Dashboard live banner              |
| `getDashboardStats`         | —                 | Stats object                 | Dashboard cards                    |
| `getActions`                | —                 | `RecruiterAction[]`          | Action queue table                 |
| **`getActionsByCandidate`** | `{ candidateId }` | `RecruiterAction[]`          | Candidate detail — action history  |

### Mutations (write data)

| Procedure                  | Input                                                            | Returns           | When to use                           |
| -------------------------- | ---------------------------------------------------------------- | ----------------- | ------------------------------------- |
| `updateCandidateStage`     | `{ id, stage }`                                                  | `Candidate`       | Pipeline drag-and-drop                |
| `updateCandidateLane`      | `{ id, lane }`                                                   | `Candidate`       | Lane routing toggle                   |
| `createAction`             | `{ candidateId, actionType, notes? }`                            | `RecruiterAction` | Queue an ATS action                   |
| **`markFollowUpSent`**     | `{ actionId }`                                                   | `RecruiterAction` | Mark email as sent on follow-ups page |
| **`updateCandidateOwner`** | `{ candidateId, ownerId }`                                       | `Candidate`       | Assign recruiter dropdown             |
| **`updateCandidateScore`** | `{ candidateId, fitScore, strengths, gaps, riskLevel, summary }` | `Candidate`       | Manual score override (admin)         |
| **`scoreCandidate`**       | `{ candidateId, resume, jobDescription }`                        | `Candidate`       | **One-click Nova AI scoring**         |

**Bold** = new procedures added in this PR.

---

## Usage Examples

### 1. Score a Candidate with Nova AI

This is the main integration point. One button fires one mutation — the server
calls the LLM and persists results automatically.

```tsx
export function ScoreButton({
  candidateId,
  resume,
  jobDescription,
}: {
  candidateId: string;
  resume: string;
  jobDescription: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const scoreMutation = useMutation(
    trpc.recruiter.scoreCandidate.mutationOptions({
      onSuccess: () => {
        // Refresh the candidate list to show new scores
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getCandidates.queryKey(),
        });
      },
    }),
  );

  return (
    <button
      onClick={() =>
        scoreMutation.mutate({ candidateId, resume, jobDescription })
      }
      disabled={scoreMutation.isPending}
    >
      {scoreMutation.isPending ? "Scoring..." : "Score with Nova"}
    </button>
  );
}
```

**Where to get the inputs:**

- `resume`: From `getCandidateWithEvidence` → filter `evidence` where
  `type === "resume"`, use `content` field (or fetch from `url`)
- `jobDescription`: From `getRoles` → match by candidate's `roleId`, use
  `jobDescription` field

### 2. Mark a Follow-Up as Sent

```tsx
function MarkSentButton({ actionId }: { actionId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.recruiter.markFollowUpSent.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getActions.queryKey(),
        });
      },
    }),
  );

  return (
    <button
      onClick={() => mutation.mutate({ actionId })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? "Updating..." : "Mark Sent"}
    </button>
  );
}
```

### 3. Assign a Recruiter to a Candidate

```tsx
function AssignRecruiter({ candidateId }: { candidateId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.recruiter.updateCandidateOwner.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.recruiter.getCandidates.queryKey(),
        });
      },
    }),
  );

  // ownerId is the Clerk user ID of the recruiter being assigned
  const handleAssign = (ownerId: string) => {
    mutation.mutate({ candidateId, ownerId });
  };

  return (
    <select onChange={(e) => handleAssign(e.target.value)}>
      <option value="">Unassigned</option>
      {/* Populate with team member Clerk IDs */}
    </select>
  );
}
```

### 4. View Actions for a Candidate

```tsx
function CandidateActions({ candidateId }: { candidateId: string }) {
  const trpc = useTRPC();
  const { data: actions, isLoading } = useQuery(
    trpc.recruiter.getActionsByCandidate.queryOptions({ candidateId }),
  );

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {actions?.map((a) => (
        <li key={a.id}>
          {a.actionType} — {a.status} — {a.createdAt?.toLocaleDateString()}
        </li>
      ))}
    </ul>
  );
}
```

---

## Nova Scoring — End-to-End Flow

```
User clicks "Score"
       │
       ▼
Frontend: useMutation(trpc.recruiter.scoreCandidate)
       │
       ▼
tRPC server (Next.js) ──fetch──▶ LLM service POST /api/score
       │                                    │
       │                         Nova AI scores candidate
       │                                    │
       │◀────── JSON { fit_score, ... } ────┘
       │
       ▼
tRPC server: UPDATE candidates SET fitScore, strengths, gaps, riskLevel, summary
       │
       ▼
Returns updated candidate row to frontend
       │
       ▼
Frontend: invalidateQueries → table re-renders with new scores
```

## Error Handling

All mutations can throw. Wrap in try/catch or use `onError`:

```tsx
const mutation = useMutation(
  trpc.recruiter.scoreCandidate.mutationOptions({
    onError: (err) => {
      // err.message will contain "Nova scoring failed: ..." if LLM is down
      toast.error(err.message);
    },
  }),
);
```

## Environment Requirements

| Service        | Env Var                 | Where  | Purpose                                                     |
| -------------- | ----------------------- | ------ | ----------------------------------------------------------- |
| `@starter/web` | `LLM_URL`               | `.env` | Points to the LLM service (default `http://localhost:3001`) |
| `@starter/llm` | `AWS_ACCESS_KEY_ID`     | `.env` | Bedrock credentials                                         |
| `@starter/llm` | `AWS_SECRET_ACCESS_KEY` | `.env` | Bedrock credentials                                         |
| `@starter/llm` | `AWS_REGION`            | `.env` | Bedrock region (default `us-east-1`)                        |

Both services must be running for Nova scoring to work:

```bash
# Terminal 1 — Web client
npm run dev --workspace=@starter/web

# Terminal 2 — LLM service
npm run dev --workspace=@starter/llm
```

## DB Reset

To wipe all data and re-seed:

```bash
npm run db:reset --workspace=@starter/web
```

Deletes in cascade order: evidence → recruiterActions → candidates → jobRoles → events, then re-seeds.

## LLM Direct Testing (curl)

Test the LLM `/score` endpoint independently:

```bash
curl -X POST http://localhost:3001/api/score \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "test-123",
    "resume": "3 years Python, PyTorch, published NeurIPS paper, AWS certified",
    "jobDescription": "ML Engineer: Python, PyTorch, 2+ years production ML, AWS experience preferred"
  }'
```

Expected response:

```json
{
  "success": true,
  "candidateId": "test-123",
  "fit_score": 78,
  "strengths": [
    "Strong Python and PyTorch skills",
    "Research depth with NeurIPS"
  ],
  "gaps": ["No production ML deployment experience"],
  "risk_level": "medium",
  "summary": "Solid academic ML profile with relevant framework experience..."
}
```

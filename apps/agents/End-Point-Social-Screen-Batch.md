# AI Hire Social Screen Batch API 

## Current Status

### Verified
- **Social Screen Batch API — Verified**

### Important Limitation
- **Scoring logic is still mock heuristic logic**

This means the batch pipeline, persistence, polling, and retry flow are working, but the candidate scoring is **not** yet powered by a real AI model or Nova Act endpoint. The current scoring is still based on local keyword heuristics inside the batch runner.

---

# What is Working

The following API flow has been validated successfully in local development:

1. Create a batch job
2. Persist the batch job in Supabase/Postgres
3. Run the async batch processor
4. Poll batch status
5. Fetch batch results
6. Retry the batch job
7. Re-poll and confirm updated timestamps/results

The working endpoints are:

- `POST /api/aihire/social-screen/batch`
- `GET /api/aihire/social-screen/batch/[batchJobId]`
- `GET /api/aihire/social-screen/batch/[batchJobId]/results`
- `POST /api/aihire/social-screen/batch/[batchJobId]/retry`

---

# What Was Verified

## 1) Batch creation works

A batch job can be created successfully with candidate input.

### Verified behavior
- Accepts JSON input
- Normalizes candidate fields
- Creates a unique `batchJobId`
- Saves job state to the database
- Starts async batch execution
- Returns `202 Accepted`

### Example successful response
```json
{
  "ok": true,
  "batchJobId": "ssb_1772591095000_2397ld",
  "status": "running",
  "totalCandidates": 2,
  "createdAt": "2026-03-04T02:24:55.001Z"
}
```

## 2) Batch status polling works

A created batch can be fetched later using the same batchJobId.

Verified behavior
	•	Job remains available after the initial request
	•	State is durable because it is stored in the database
	•	Status updates correctly from running to completed

Example successful response
```json
{
  "ok": true,
  "batchJobId": "ssb_1772591095000_2397ld",
  "status": "completed",
  "totalCandidates": 2,
  "completedCandidates": 2,
  "failedCandidates": 0,
  "createdAt": "2026-03-04T02:24:55.001Z",
  "updatedAt": "2026-03-04T02:24:55.305Z"
}
```

## 3) Batch results endpoint works

Completed batch results can be retrieved successfully.

Verified behavior
	•	Returns candidate-by-candidate screening output
	•	Includes fitScore, risk, summary, flags, and error
	•	Results persist in DB-backed storage

Example successful response
```json
{
  "ok": true,
  "batchJobId": "ssb_1772591095000_2397ld",
  "status": "completed",
  "totalCandidates": 2,
  "completedCandidates": 2,
  "failedCandidates": 0,
  "results": [
    {
      "candidateId": "cand_001",
      "name": "Nguyen Phan Nguyen",
      "ok": true,
      "status": "completed",
      "fitScore": 83,
      "risk": "low",
      "summary": "Nguyen Phan Nguyen initial social screen fit score is 83/100 with low risk.",
      "flags": [],
      "error": null
    },
    {
      "candidateId": "cand_002",
      "name": "Lam Anh Truong",
      "ok": true,
      "status": "completed",
      "fitScore": 97,
      "risk": "low",
      "summary": "Lam Anh Truong initial social screen fit score is 97/100 with low risk.",
      "flags": [],
      "error": null
    }
  ]
}
```

## 4) Retry endpoint works

A previously completed batch can be reset and re-run.

Verified behavior
	•	Existing batch is found by batchJobId
	•	Results are reset to queued state
	•	Batch status changes back to running
	•	Async processor re-executes
	•	updatedAt changes after retry completion

Example retry response
```json
{
  "ok": true,
  "batchJobId": "ssb_1772593048454_2tyt99",
  "status": "running",
  "totalCandidates": 2,
  "completedCandidates": 0,
  "failedCandidates": 0,
  "message": "Batch retry started"
}
```

Example post-retry status response
```json
{
  "ok": true,
  "batchJobId": "ssb_1772593048454_2tyt99",
  "status": "completed",
  "totalCandidates": 2,
  "completedCandidates": 2,
  "failedCandidates": 0,
  "createdAt": "2026-03-04T02:57:28.454Z",
  "updatedAt": "2026-03-04T02:59:04.795Z"
}
```

Persistence Status

Durable persistence is now working

The earlier in-memory Map issue has been replaced by database-backed persistence using Supabase/Postgres.

What this fixes
	•	Batch jobs no longer disappear after dev server reloads
	•	Polling works reliably after the initial POST request
	•	Retry works on persisted jobs
	•	Results remain available through the API
	•	Teammates can inspect records directly in Supabase Table Editor

⸻

## Database Table

Table used
	•	social_screen_batch_jobs

Confirmed columns
	•	id
	•	batch_job_id
	•	status
	•	total_candidates
	•	completed_candidates
	•	failed_candidates
	•	candidates_json
	•	results_json
	•	created_at
	•	updated_at

Verified DB state after successful run

For a tested batch row, the following were confirmed:
	•	status = completed
	•	completed_candidates = 2
	•	failed_candidates = 0
	•	results_json is populated
	•	updated_at changes after retry

⸻

## Commands Used to Validate the Flow

1) Start local app

Run from project root:
```bash
pnpm dev:web
```

Expected:
	•	Next.js starts on http://localhost:3000
	•	.env loads successfully
	•	no fatal DB startup errors

## 2) Create a batch job
```bash
curl -X POST http://localhost:3000/api/aihire/social-screen/batch \
  -H "Content-Type: application/json" \
  -d '{
    "candidates": [
      {
        "candidateId": "cand_001",
        "name": "Nguyen Phan Nguyen",
        "roleTitle": "Software Engineer",
        "school": "Virginia Tech",
        "resumeText": "Built real-time systems and AI projects."
      },
      {
        "candidateId": "cand_002",
        "name": "Lam Anh Truong",
        "roleTitle": "Software Engineer",
        "school": "George Mason University",
        "resumeText": "Full-stack developer with cloud and AI experience."
      }
    ]
  }'
```

Expected:
	•	JSON response with ok: true
	•	a real batchJobId
	•	status: "running"
Example

```json
{
  "ok": true,
  "batchJobId": "ssb_1772591095000_2397ld",
  "status": "running",
  "totalCandidates": 2,
  "createdAt": "2026-03-04T02:24:55.001Z"
}
```

## 3) Save the returned batch ID
```bash
BATCH_ID="ssb_1772591095000_2397ld"
echo $BATCH_ID
```

expected
```bash
ssb_1772591095000_2397ld
```
Important:
	•	Use the actual returned ID
	•	Do not use placeholders like NEW_BATCH_JOB_ID


4) Check batch status
```bash
curl -i "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID"
```
Expected:
	•	HTTP/1.1 200 OK
	•	JSON showing current job state

```json
{
  "ok": true,
  "batchJobId": "ssb_1772591095000_2397ld",
  "status": "completed",
  "totalCandidates": 2,
  "completedCandidates": 2,
  "failedCandidates": 0,
  "createdAt": "2026-03-04T02:24:55.001Z",
  "updatedAt": "2026-03-04T02:24:55.305Z"
}
```

5) Check batch results

```bash
curl -i "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID/results"
```

Expected:
	•	HTTP/1.1 200 OK
	•	JSON result payload for each candidate

Example
```json
{
  "ok": true,
  "batchJobId": "ssb_1772591095000_2397ld",
  "status": "completed",
  "totalCandidates": 2,
  "completedCandidates": 2,
  "failedCandidates": 0,
  "results": [
    {
      "candidateId": "cand_001",
      "name": "Nguyen Phan Nguyen",
      "ok": true,
      "status": "completed",
      "fitScore": 83,
      "risk": "low",
      "summary": "Nguyen Phan Nguyen initial social screen fit score is 83/100 with low risk.",
      "flags": [],
      "error": null
    },
    {
      "candidateId": "cand_002",
      "name": "Lam Anh Truong",
      "ok": true,
      "status": "completed",
      "fitScore": 97,
      "risk": "low",
      "summary": "Lam Anh Truong initial social screen fit score is 97/100 with low risk.",
      "flags": [],
      "error": null
    }
  ]
}
```


6) Retry the batch

```bash
curl -i -X POST "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID/retry"
```

Expected:
	•	HTTP/1.1 202 Accepted
	•	batch resets and starts again

Example:
```json
{
  "ok": true,
  "batchJobId": "ssb_1772593048454_2tyt99",
  "status": "running",
  "totalCandidates": 2,
  "completedCandidates": 0,
  "failedCandidates": 0,
  "message": "Batch retry started"
}
```

7) Re-check status after retry finishes

```bash
curl -i "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID"
```

Expected:
	•	status becomes completed again
	•	updatedAt is newer than before retry
Example:
```json
{
  "ok": true,
  "batchJobId": "ssb_1772593048454_2tyt99",
  "status": "completed",
  "totalCandidates": 2,
  "completedCandidates": 2,
  "failedCandidates": 0,
  "createdAt": "2026-03-04T02:57:28.454Z",
  "updatedAt": "2026-03-04T02:59:04.795Z"
}
```


Manual DB Validation Steps

Verify in Supabase Table Editor
	1.	Open Supabase project
	2.	Go to Table Editor
	3.	Open social_screen_batch_jobs
	4.	Find the row matching the tested batch_job_id

Example:
	•	ssb_1772591095000_2397ld

Confirm these values
	•	status = completed
	•	completed_candidates = 2
	•	failed_candidates = 0
	•	results_json is populated
	•	updated_at reflects the retry completion time

If all of those look correct, DB persistence is fully validated.

⸻

Current Implementation Notes

The scoring is still mock logic

The current batch processor still uses local heuristic scoring in:
	•	apps/web-client/src/lib/aihire/runSocialScreenBatchJob.ts

Current behavior
	•	Keyword-based fitScore
	•	Derived risk (low, medium, high)
	•	Simple generated summary string
	•	No Bedrock / Nova Act / LLM scoring yet

Example of current heuristic rules
	•	Adds points for keywords like:
	•	software
	•	engineer
	•	cloud
	•	ai
	•	full-stack
	•	Deducts points if resume text is missing

This is acceptable for API plumbing validation, but it is not production AI scoring.

⸻

What Is Not Yet Verified

Nova Act endpoints are not verified

At the time of this handoff:
	•	there are no dedicated API route files explicitly for Nova Act
	•	the verified system is the Social Screen Batch API
	•	the batch runner currently uses mock heuristic logic, not a real Nova Act integration endpoint

So teammates should not label Nova Act endpoints as completed unless separate Nova Act route/service work is added and tested.

⸻

Recommended Next Step

Replace the mock scorer with the real AI scoring service

The clean next milestone is:
	1.	Keep the batch DB flow exactly as-is
	2.	Keep the existing endpoints exactly as-is
	3.	Replace the mock scoring section inside:
	•	apps/web-client/src/lib/aihire/runSocialScreenBatchJob.ts
	4.	Call the real recruiter/social-screen AI service instead

That gives you:
	•	the same API contract
	•	the same durable persistence
	•	the same retry flow
	•	but real model-backed screening output

⸻

Suggested Next Engineering Tasks

Immediate next tasks
	1.	Clean up any leftover old in-memory batch store imports/files
	2.	Ensure all batch routes consistently use the DB-backed store
	3.	Keep retry/status/results paths unchanged
	4.	Swap heuristic scoring to real AI scoring

After real AI scoring is wired
	1.	Re-run the exact same curl validation flow
	2.	Confirm results now come from real model output
	3.	Update this handoff doc to mark:
	•	Social Screen Batch API — Verified
	•	Real AI scoring — Verified
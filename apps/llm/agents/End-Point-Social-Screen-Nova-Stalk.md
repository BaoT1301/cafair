# AI Endpoint Handoff Notes

## Status
The **Social Screen Batch API is partially working in local development**.

### 1) Batch creation endpoint works
The following endpoint is working:

- `POST /api/aihire/social-screen/batch`

It is good to:
- accept a JSON payload with candidates
- create a batch job
- return a real `batchJobId`
- start the batch runner in the background
f
A successful response looks like this:

```json
{
  "ok": true,
  "batchJobId": "ssb_1772426727353_wydcxm",
  "status": "running",
  "totalCandidates": 2,
  "createdAt": "2026-03-02T04:45:27.353Z"
}
```

That means:
	•	route file is being picked up by Next.js
	•	request parsing is correct
	•	the batch store create function is being called
	•	the job runner is being invoked

### 2) Health check for the base batch route works

The following endpoint is also working:
	•	GET /api/aihire/social-screen/batch

This returns a simple confirmation that the route is live.

#### Expected response:
```json
{
  "ok": true,
  "message": "Social screen batch endpoint is live.",
  "methods": ["GET", "POST"]
}
```

This confirms:
	•	the route is loaded
	•	exports are valid
	•	Next app router recognizes both GET and POST on the base path

---

3) Nested route files now exist

These route files are now present and readable by the app:
	•	apps/web-client/src/app/api/aihire/social-screen/batch/route.ts
	•	apps/web-client/src/app/api/aihire/social-screen/batch/[batchJobId]/route.ts
	•	apps/web-client/src/app/api/aihire/social-screen/batch/[batchJobId]/results/route.ts
	•	apps/web-client/src/app/api/aihire/social-screen/batch/[batchJobId]/retry/route.ts

This is important because earlier they were either:
	•	missing
	•	empty
	•	not created due to zsh bracket expansion issues

That file-creation issue has been fixed.

---

Current limitation

In-memory store is causing batch lookup failures

Batch jobs are currently stored in:
	•	apps/web-client/src/lib/aihire/socialScreenBatchStore.ts

This file uses an in-memory Map, which means batch jobs only live inside the current server process memory.

So if the Next dev server:
	•	recompiles
	•	hot reloads
	•	refreshes route modules
	•	restarts
	•	invalidates module state during development

then the stored batch job can disappear.

Because of that, these endpoints may return:
	•	404 Batch job not found

even if a batch job was successfully created just moments earlier.

Affected endpoints:
	•	GET /api/aihire/social-screen/batch/[batchJobId]
	•	GET /api/aihire/social-screen/batch/[batchJobId]/results
	•	POST /api/aihire/social-screen/batch/[batchJobId]/retry

So the endpoint shape is correct, but persistence is not durable yet.

⸻

Root cause summary

The main problem is not route wiring anymore.

The current blocker is:
	•	batch state is stored only in RAM
	•	Next.js dev mode can re-evaluate modules
	•	the Map gets reset
	•	later polling requests cannot find the same batchJobId

So the app behaves like this:
	1.	create batch job successfully
	2.	receive valid batch ID
	3.	poll later
	4.	get 404 Batch job not found

That is expected with the current in-memory prototype store.

⸻

Commands run and expected output

### 1) Verify the base batch route is live
```bash
curl -i http://localhost:3000/api/aihire/social-screen/batch
```

Expect:
```bash
HTTP/1.1 200 OK
content-type: application/json
. . . . . 
{"ok":true,"message":"Social screen batch endpoint is live.","methods":["GET","POST"]}
```
What this proves:
	•	the route exists
	•	GET is exported correctly
	•	Next is loading the file successfully


### 2) Create a new batch job

Command:
```bash
curl -i -X POST http://localhost:3000/api/aihire/social-screen/batch \
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

Expect:

```bash
HTTP/1.1 202 Accepted
content-type: application/json
. . . . . . 
{"ok":true,"batchJobId":"ssb_1772426727353_wydcxm","status":"running","totalCandidates":2,"createdAt":"2026-03-02T04:45:27.353Z"}
```

What this proves:
	•	POST works
	•	request body validation works
	•	batch job creation works
	•	the async runner is being started
	•	a real batch ID is generated


### 3) Save the returned batch ID in shell

From the example above, the real batch ID is:

Expected result:
	•	no terminal output
	•	just sets a shell variable for reuse

Important:
	•	do not use placeholders like NEW_BATCH_JOB_ID
	•	do not use paste_the_real_id_here
	•	use the exact returned value from the POST response

### 4) Check batch status
```bash
curl -i "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID"
```

Expect:
```bash
HTTP/1.1 404 Not Found
content-type: application/json
. . . . . . 
{"ok":false,"error":"Batch job not found"}
```

What this currently means:
	•	the nested route is now recognized
	•	the handler is running
	•	but the in-memory store no longer contains that batch ID

So this is not a route-not-found problem anymore.
It is a state persistence problem.

### 5) Check batch results

```bash
curl -i "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID/results"
```

Stephen output Now!?
```bash
HTTP/1.1 404 Not Found
content-type: application/json
. . . . . 
{"ok":false,"error":"Batch job not found"}
```

What this means:
	•	results route is mounted
	•	GET handler is valid
	•	but the batch lookup fails because the job is no longer in memory

### 6) Retry an existing batch
```bash
curl -i -X POST "http://localhost:3000/api/aihire/social-screen/batch/$BATCH_ID/retry"
```

Current Stephen output:
```json
HTTP/1.1 404 Not Found
content-type: application/json
. . . . . 

{"ok":false,"error":"Batch job not found"}
```

What this means:
	•	retry route is mounted
	•	POST handler is valid
	•	but the original batch is missing from the in-memory Map

### 7) Confirm the store exports exist

Command:
```bash
grep -n "export function createSocialScreenBatchJob" "apps/web-client/src/lib/aihire/socialScreenBatchStore.ts"
```

Expected output: 47:export function createSocialScreenBatchJob(

What this proves:
	•	earlier “no exports” problem is fixed
	•	the store file is no longer empty
	•	the base route can import the expected function

### 8) Inspect the store contents manually

Expected output:
	•	TypeScript source code showing:
	•	batchStore = new Map<string, SocialScreenBatchJob>()
	•	createSocialScreenBatchJob(...)
	•	getSocialScreenBatchJob(...)
	•	updateSocialScreenBatchJob(...)
	•	resetSocialScreenBatchJob(...)

What this proves:
	•	storage is currently memory-only
	•	there is no DB / Redis / file persistence yet


### 9) Inspect nested route handlers

Expected output:
	•	TypeScript code for each route
	•	imports from @/lib/aihire/socialScreenBatchStore
	•	handlers using getSocialScreenBatchJob(...)

What this proves:
	•	the files are no longer blank
	•	route handlers are present
	•	404s are coming from app logic, not missing files

⸻

What was broken earlier and is now fixed

Fixed: missing or blank route files

Previously:
	•	some route files printed nothing with sed
	•	they were either empty or not properly created

Now:
	•	they contain working TypeScript handlers

⸻

Fixed: incorrect import names

Previously:
	•	nested routes tried importing getBatchJob
	•	but the store exports getSocialScreenBatchJob

Now:
	•	imports were corrected to the actual exported function names

⸻

Fixed: base route compilation issue

Previously:
	•	Next reported createSocialScreenBatchJob did not exist
	•	because the target file had no exports at that time

Now:
	•	the export exists
	•	the base route responds correctly

⸻

Fixed: zsh path creation issue with [batchJobId]

Previously:
	•	mkdir and touch failed because zsh treated square brackets as glob patterns

Now:
	•	quoting the paths solved it

Correct pattern:
```bash
mkdir -p "apps/web-client/src/app/api/aihire/social-screen/batch/[batchJobId]/retry"
mkdir -p "apps/web-client/src/app/api/aihire/social-screen/batch/[batchJobId]/results"
```


What is still not production-ready

1) No durable persistence

Current store is only a local in-memory Map.

That means:
	•	jobs do not survive reloads
	•	teammates cannot reliably poll old jobs
	•	frontend polling is fragile

⸻

2) No shared state across processes

If the app runs:
	•	in another process
	•	in another server instance
	•	in serverless environments
	•	after a restart

the in-memory Map will be empty.

So current behavior is not suitable for:
	•	deployment
	•	shared QA
	•	stable frontend polling
	•	team handoff beyond local prototype

⸻

3) Retry depends on the original in-memory job

The retry endpoint needs the old batch to still exist in the Map.
If it is gone, retry cannot work.

So retry is structurally implemented, but not reliable yet.

⸻

Recommended next fix

Replace the in-memory Map with durable storage.

Best options:
	•	Supabase table
	•	Postgres
	•	Redis / Upstash
	•	another server-side persistent store

After that:
	•	batchJobId will remain valid after reloads
	•	status polling will work consistently
	•	results polling will work
	•	retry will work reliably
	•	teammates can test the same job from their own requests

⸻

Recommended next implementation target

Minimum production-safe upgrade

Create a social_screen_batch_jobs table with fields like:
	•	batch_job_id
	•	status
	•	created_at
	•	updated_at
	•	total_candidates
	•	completed_candidates
	•	failed_candidates
	•	payload_json
	•	results_json

Then update these functions to read/write from the DB instead of a Map:
	•	createSocialScreenBatchJob
	•	getSocialScreenBatchJob
	•	updateSocialScreenBatchJob
	•	resetSocialScreenBatchJob

That will preserve the exact same API contract while making state durable.
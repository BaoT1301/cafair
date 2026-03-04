# Apply Agent (Web Client) Notes

## Scope completed

This handoff covers the **web-client side** of the Apply Agent pipeline up to the point where the system is ready to connect to a real Python/Nova Act backend runner.

At this stage, the TypeScript and API layer is working for:

- scanning jobs
- keyword-based fit matching
- heuristic AI reranking
- provider detection
- provider-specific apply planning
- run history logging
- stubbed Nova Act runner orchestration

The only major remaining gap is the **real Python browser execution layer**.

---

## What is working now

### 1) Job source fetch
The API can fetch a Simplify-style job pool.

Implemented route:
- `apps/web-client/src/app/api/aihire/apply-agent/source/simplify/route.ts`

Implemented source logic:
- `apps/web-client/src/lib/aihire/apply-agent/fetchSimplifySummer2026Jobs.ts`

Current behavior:
- returns working seed/fallback jobs
- includes real seeded examples:
  - Flagship Pioneering
  - New York Post
  - OpenAI
- supports future replacement with real GitHub/Simplify parsing

Verified:
- `GET /api/aihire/apply-agent/source/simplify` returns `200 OK`

---

### 2) Resume-to-job keyword matching
The API can compare resume keywords against a list of jobs and decide whether each role passes a threshold.

Implemented route:
- `apps/web-client/src/app/api/aihire/apply-agent/match/route.ts`

Core logic:
- `apps/web-client/src/lib/aihire/apply-agent/rankJobsByKeyword.ts`
- `apps/web-client/src/lib/aihire/technicalKeywords.ts`

Current behavior:
- extracts matching technical keywords from resume text
- compares against job title/company/location/description
- computes:
  - `matchedKeywords`
  - `matchedKeywordCount`
  - `keywordScore`
  - `shouldApply`
  - human-readable `reason`

Verified:
- `POST /api/aihire/apply-agent/match` returns `200 OK`
- threshold-based filtering works

---

### 3) Scan pipeline
The API can scan source jobs, run keyword filtering, and then rerank shortlisted jobs.

Implemented route:
- `apps/web-client/src/app/api/aihire/apply-agent/scan/route.ts`

Core logic:
- `apps/web-client/src/lib/aihire/apply-agent/fetchSimplifySummer2026Jobs.ts`
- `apps/web-client/src/lib/aihire/apply-agent/fetchSerpApiJobs.ts`
- `apps/web-client/src/lib/aihire/apply-agent/rankJobsByKeyword.ts`
- `apps/web-client/src/lib/aihire/apply-agent/rerankJobsWithBedrock.ts`

Current behavior:
- scans Simplify source first
- uses keyword filtering first
- if no strong matches, can fall back to SerpAPI job search logic
- reranks shortlisted jobs with:
  - heuristic mode by default
  - optional Bedrock path if AWS creds are present

Output includes:
- `sourceUsed`
- `fallbackUsed`
- `aiMode`
- `keywordRankedJobs`
- `recommendedJobs`
- `aiRankedJobs`

Verified:
- `POST /api/aihire/apply-agent/scan` returns `200 OK`
- current heuristic reranker is stable

---

### 4) Application provider detection
The system can detect which apply platform a job uses from the target URL.

Core logic:
- `apps/web-client/src/lib/aihire/apply-agent/detectApplicationProvider.ts`

Supported providers:
- `greenhouse`
- `workday`
- `ashby`
- `unknown`

This is used by the run endpoint to choose provider-specific selectors and steps.

---

### 5) Provider-specific execution planning
The system builds a safe browser execution plan before any real browser automation happens.

Core logic:
- `apps/web-client/src/lib/aihire/apply-agent/buildApplyExecutionPlan.ts`

Current behavior:
- builds provider-specific selectors
- builds provider-specific step list
- always keeps:
  - `safeStopBeforeSubmit: true`

Examples:
- Workday plan includes guest apply / sign-in branch
- Greenhouse plan includes opening application form
- Ashby plan can stop early if threshold is not met

---

### 6) Run endpoint orchestration
The API can accept a selected job and produce a provider-specific execution run payload.

Implemented route:
- `apps/web-client/src/app/api/aihire/apply-agent/run/route.ts`

Current behavior:
- validates `targetUrl`
- normalizes:
  - `company`
  - `roleTitle`
  - `matchedKeywordCount`
  - `threshold`
  - `mode`
- determines `shouldApply`
- detects provider
- builds execution plan
- calls the Nova Act runner stub
- returns:
  - `plan`
  - `executionSteps`
  - `runner`
  - `safeStopBeforeSubmit`
  - `executed`
  - `message`

Supported modes:
- `demo`
- `plan`
- `live`

Current actual execution:
- still stubbed
- no real browser launched yet
- `live` is not truly live yet

Verified:
- `POST /api/aihire/apply-agent/run` returns `200 OK`
- `mode: "plan"` works consistently
- provider-specific plan is returned
- `executionSteps` is included
- `runner` metadata is included

---

### 7) Nova Act runner stub
There is now a stubbed runner that represents the bridge point to the future Python backend.

Core logic:
- `apps/web-client/src/lib/aihire/apply-agent/novaActApplyRunner.ts`

Current behavior:
- accepts:
  - run id
  - provider
  - mode
  - plan
  - apply decision
- returns:
  - runner metadata
  - execution steps
  - safe-stop metadata
  - status (`planned`, `queued`, `running`, `completed`)

Important:
- this file is the clean integration point where the real Python/Nova Act bridge should replace stub logic

---

### 8) Run history
The system records each run in an in-memory history list.

Implemented route:
- `apps/web-client/src/app/api/aihire/apply-agent/history/route.ts`

Current behavior:
- `GET` returns list of history items
- `run/route.ts` appends a history item for every run
- `plan` runs are stored as `queued` in history for compatibility with current history status types

Verified:
- history records every run successfully
- repeated tests show history count increasing correctly

---

## Files currently involved

### API routes
- `apps/web-client/src/app/api/aihire/apply-agent/source/simplify/route.ts`
- `apps/web-client/src/app/api/aihire/apply-agent/match/route.ts`
- `apps/web-client/src/app/api/aihire/apply-agent/scan/route.ts`
- `apps/web-client/src/app/api/aihire/apply-agent/run/route.ts`
- `apps/web-client/src/app/api/aihire/apply-agent/history/route.ts`
- `apps/web-client/src/app/api/aihire/apply-agent/runApplyBrowserSession.ts` *(placeholder / next integration point if used)*

### Core apply-agent logic
- `apps/web-client/src/lib/aihire/technicalKeywords.ts`
- `apps/web-client/src/lib/aihire/apply-agent/types.ts`
- `apps/web-client/src/lib/aihire/apply-agent/applyAgentTypes.ts`
- `apps/web-client/src/lib/aihire/apply-agent/fetchSimplifySummer2026Jobs.ts`
- `apps/web-client/src/lib/aihire/apply-agent/fetchSerpApiJobs.ts`
- `apps/web-client/src/lib/aihire/apply-agent/rankJobsByKeyword.ts`
- `apps/web-client/src/lib/aihire/apply-agent/rerankJobsWithBedrock.ts`
- `apps/web-client/src/lib/aihire/apply-agent/detectApplicationProvider.ts`
- `apps/web-client/src/lib/aihire/apply-agent/buildApplyExecutionPlan.ts`
- `apps/web-client/src/lib/aihire/apply-agent/novaActApplyRunner.ts`

---

## What has been verified manually

The following have been manually tested with `curl` and returned valid responses:

### Simplify source fetch
```bash
curl -i http://localhost:3000/api/aihire/apply-agent/source/simplify
```

#### Job scan
```bash
curl -i -X POST http://localhost:3000/api/aihire/apply-agent/scan \
  -H "Content-Type: application/json" \
  -d '{
    "resumeText": "Python JavaScript TypeScript React Next.js Node.js AWS Supabase PostgreSQL Drizzle AI automation APIs cloud infrastructure Git GitHub VS Code Playwright",
    "threshold": 3,
    "limit": 10
  }'
```

#### Run endpoint in plan mode
```bash
curl -i -X POST http://localhost:3000/api/aihire/apply-agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://dowjones.wd1.myworkdayjobs.com/New_York_Post_Careers/job/NYC---1211-Ave-of-the-Americas/Software-Engineering-Intern_Job_Req_51878",
    "company": "New York Post",
    "roleTitle": "Software Engineering Intern",
    "matchedKeywordCount": 6,
    "threshold": 3,
    "mode": "plan"
  }'
```

#### Run history
```bash
curl -i http://localhost:3000/api/aihire/apply-agent/history
```

Confirmed from responses
	•	mode: "plan" returns 200
	•	executionSteps is present
	•	runner metadata is present
	•	safeStopBeforeSubmit is present
	•	history records each run
	•	provider detection works for Workday / Greenhouse / Ashby URLs

⸻

Current limitations

1) No real browser automation yet

The runner is still a stub.

That means:
	•	no real browser opens
	•	no real clicks happen
	•	no actual forms are read
	•	no actual fields are filled
	•	no upload or submit happens

The current run endpoint is only producing:
	•	execution plan
	•	simulated execution metadata
	•	safe-stop structure

⸻

2) Bedrock reranking is optional, not guaranteed live

rerankJobsWithBedrock.ts supports a future real Bedrock path, but the current stable behavior is still heuristic unless AWS credentials and model access are properly configured.

So today:
	•	keyword filtering is real
	•	reranking logic is functional
	•	but “AI reranking” may still be heuristic in practice

⸻

3) Simplify source is still partially seeded

fetchSimplifySummer2026Jobs.ts is designed for future real source fetching, but current stable behavior relies on seed/fallback jobs for predictability.

So today:
	•	source route works
	•	output is deterministic
	•	but it is not yet a fully live parser over the full GitHub internship board

⸻

4) History is in-memory only

History survives only while the server process is running.

It is not yet:
	•	database-backed
	•	durable
	•	tied to a real job execution record

⸻

### Our next step"

The next milestone is the Python Nova Act backend integration.

Goal

Replace the stub logic in:
	•	apps/web-client/src/lib/aihire/apply-agent/novaActApplyRunner.ts

with a real bridge to a Python service/script that can:
	•	open a browser
	•	navigate to the target URL
	•	identify provider-specific apply flow
	•	click through steps
	•	inspect visible form fields
	•	prefill known candidate data
	•	stop before final submit

Suggested Python entrypoint
	•	nova_act_apply_runner.py

Flow
	1.	Keep run/route.ts as the TypeScript orchestrator
	2.	Keep buildApplyExecutionPlan.ts for provider-specific plan generation
	3.	Change novaActApplyRunner.ts from stub to bridge
	4.	Have it call Python
	5.	Return structured execution output back into the same JSON contract

⸻

Safety rule that should remain

The system should continue to enforce:
	•	safeStopBeforeSubmit: true

until the team explicitly decides to allow real submissions.

That means even after Python integration:
	•	real navigation is okay
	•	real field detection is okay
	•	real prefilling is okay
	•	final submit should still be blocked by default

⸻

Quick status summary

Completed
	•	source fetch route
	•	match route
	•	scan route
	•	provider detection
	•	execution plan builder
	•	run route
	•	history route
	•	Nova Act runner stub integration

Verified
	•	stable 200 OK responses
	•	consistent plan mode behavior
	•	history logging works
	•	provider-specific plans work

Not completed yet
	•	real Python/Nova Act browser execution
	•	durable persistence for apply runs
	•	full live Simplify board parsing
	•	true Bedrock production reranking
	•	actual form filling / final submission pipeline
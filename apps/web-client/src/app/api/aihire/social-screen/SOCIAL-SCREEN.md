# Social Screen API

Recruiter-side Social Screen endpoints for AI Hire AI.

## Endpoints

### `POST /api/aihire/social-screen/run`

Starts a run and returns the URLs the frontend should use next.

Request body:

Required

- `mode`: `nova | deterministic | replay | demo`
- `candidateId`
- `candidateLabel`

Optional

- `linkedinUrl`
- `githubUrl`
- `portfolioUrl`
- `webQueries` (`string[]`)

Example:

```bash
curl -s -X POST http://localhost:3002/api/aihire/social-screen/run \
  -H "Content-Type: application/json" \
  -d '{
    "mode":"deterministic",
    "candidateId":"cand_np_001",
    "candidateLabel":"Nguyen Phan Nguyen",
    "linkedinUrl":"https://www.linkedin.com/in/nguyenpn1/",
    "githubUrl":"https://github.com/ngstephen1",
    "portfolioUrl":"https://lamanhtruong.com",
    "webQueries":["Nguyen Phan Nguyen Virginia Tech"]
  }' | jq .
```

Response:

```json
{
  "ok": true,
  "runId": "ssr_nguyen-phan-nguyen_20260314T024645Z",
  "runDir": "/abs/path/to/run",
  "streamUrl": "/api/aihire/social-screen/stream?runId=...",
  "reportUrl": "/api/aihire/social-screen/report?runId=...",
  "status": "queued"
}
```

Modes:

- `nova`: run Nova capture first, then deterministic enrichment if needed.
- `deterministic`: skip Nova and use deterministic public-profile checks only.
- `replay`: copy a previous run.
- `demo`: return the stable demo run.

Demo mode:

```bash
curl -s -X POST http://localhost:3002/api/aihire/social-screen/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"demo"}' | jq .
```

### `GET /api/aihire/social-screen/stream?runId=...&candidate=...`

Server-Sent Events stream for live updates.

Aliases:

- `runId=latest&candidate=<slug>`
- `runId=demo`

Query params:

- `runId=<real-run-id>`: stream that exact run
- `runId=latest&candidate=<slug>`: stream the latest run for that candidate slug folder
- `runId=demo`: stream the stable demo run

`candidate` means the candidate slug folder, for example `nguyen-phan-nguyen`. It is only used when `runId=latest`. When `runId=<real-run-id>`, `candidate` is optional.

Example:

```bash
curl -N "http://localhost:3002/api/aihire/social-screen/stream?runId=latest&candidate=nguyen-phan-nguyen"
```

### Event types:

- `status`
- `finding`
- `log`
- `error`
- `done`
- `ping`

## SSE payloads:

| Event | Shape |
| --- | --- |
| `status` | `{ type:"status", stage, phase, message, data, eventId, timestampISO }` |
| `finding` | `{ type:"finding", stage, message, data:{ severity, text/title, citations[] }, eventId, timestampISO }` |
| `done` | `{ type:"done", message, data:{ reportPath, risk, recommendation, flags }, eventId, timestampISO }` |
| `error` | `{ type:"error", message, stage, data?, eventId, timestampISO }` |
| `ping` | `{ type:"ping", message, data:{ nowISO }, eventId, timestampISO }` |

### `GET /api/aihire/social-screen/report?runId=...&candidate=...`

Returns the final report JSON once ready.

Example:

```bash
curl -s "http://localhost:3002/api/aihire/social-screen/report?runId=latest&candidate=nguyen-phan-nguyen" | jq .
```

### `GET /api/aihire/social-screen/status?runId=...&candidate=...`

Lightweight polling endpoint for run status.

Example:

```bash
curl -s "http://localhost:3002/api/aihire/social-screen/status?runId=latest&candidate=nguyen-phan-nguyen" | jq .
```

## Frontend Reference

## Bao Tran Handoff

What Bao needs to wire the button:

- Start run on button click with `POST /api/aihire/social-screen/run`
- Read `runId`, `streamUrl`, `reportUrl`, and `status` from the response
- Open `EventSource(streamUrl)` immediately for live updates
- Listen for `status`, `finding`, `log`, `error`, and `done`
- After `done`, fetch `reportUrl` and render the final report

Best modes for demos:

- Demo mode: always works, no live run required
  - `POST /run` with `{ "mode":"demo" }`
  - or use `/stream?runId=demo` and `/report?runId=demo`
- Latest alias: useful for repeat demos without copying a run id
  - `/stream?runId=latest&candidate=<candidateSlug>`
  - `/report?runId=latest&candidate=<candidateSlug>`
  - example candidate slug: `nguyen-phan-nguyen`

## UI contract to build around:

- Live event payloads
  - `status`: stage and phase progress, such as capture started or reasoner started
  - `finding`: incremental cards to render with severity, text/title, and citations
  - `done`: final risk, recommendation, flags, and report path
  - `error`: show a toast or inline error state and stop streaming
- Final report JSON
  - stable fields: `socialScore`, `risk`, `recommendation`
  - collections: `verifiedFindings[]`, `concerns[]`, `nextSteps[]`
  - supporting fields: `citations[]`, `flags[]`, `stageStatus`
  - execution metadata: `provider`, `modelId`, `parseOk`, `validationOk`, `usedFallback`, `degraded`, `metrics`

Minimal browser flow:

1. `POST /run`
2. Open `EventSource(streamUrl)`
3. Render `status.message` as progress
4. Render `finding.data` into a live findings list
5. On `done`, close SSE and fetch `reportUrl`
6. If SSE disconnects or fails, fallback to polling `/status` every 1-2 seconds until `completed` or `failed`, then fetch `/report`

Recommended UI behavior:

- Prefer SSE as the primary live transport.
- If the user clicks Run twice, either disable the button while a run is active or treat the newest `runId` as authoritative.
- If `/report` is not ready yet, keep polling `/status` and retry `/report` after status becomes `completed`.

EventSource gotcha:

- `streamUrl` is relative. `new EventSource(streamUrl)` only works when the frontend is on the same origin as the API.
- If the UI is running on another origin, such as Storybook or a different port, convert `streamUrl` to an absolute URL first.

Demo flow:

- Start with `POST /api/aihire/social-screen/run` and `{ "mode": "demo" }`
- Stream from `/api/aihire/social-screen/stream?runId=demo`
- Fetch the final report from `/api/aihire/social-screen/report?runId=demo`

Important behavior and gotchas:

- The run is async. `/run` returns immediately with `status: "queued"`. The UI must stream or poll.
- LinkedIn may be blocked. Treat that as normal and show manual verification messaging instead of a hard failure.
- Findings can arrive before the final report exists. Do not fetch `reportUrl` until you receive `done`, or poll `/status` until `completed`.
- `provider`, `usedFallback`, and `degraded` tell you whether the backend used real Bedrock reasoning or a deterministic fallback path.
- `artifactPath` values are local file paths for debugging only. In UI, prefer displaying citation `source`, `url`, and `quote`.

```ts
const runRes = await fetch("/api/aihire/social-screen/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "deterministic",
    candidateId: "cand_np_001",
    candidateLabel: "Nguyen Phan Nguyen",
    linkedinUrl: "https://www.linkedin.com/in/nguyenpn1/",
    githubUrl: "https://github.com/ngstephen1",
    portfolioUrl: "https://lamanhtruong.com",
  }),
});

const run = await runRes.json();
const es = new EventSource(run.streamUrl);

es.addEventListener("finding", (event) => {
  const payload = JSON.parse((event as MessageEvent).data);
  console.log("finding", payload);
});

es.addEventListener("done", async () => {
  es.close();
  const reportRes = await fetch(run.reportUrl);
  const report = await reportRes.json();
  console.log("report", report);
});
```

Minimal integration snippet:

```ts
const run = await fetch("/api/aihire/social-screen/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}).then((r) => r.json());

const es = new EventSource(run.streamUrl);

es.addEventListener("finding", (e) => addFinding(JSON.parse((e as MessageEvent).data)));
es.addEventListener("status", (e) => setStatus(JSON.parse((e as MessageEvent).data)));
es.addEventListener("error", () => {
  es.close();
  showError();
});

es.addEventListener("done", async () => {
  es.close();
  const report = await fetch(run.reportUrl).then((r) => r.json());
  renderReport(report.report ?? report);
});
```

## Local Test Commands

Start a deterministic run:

```bash
curl -s -X POST http://localhost:3002/api/aihire/social-screen/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"deterministic","candidateId":"cand_np_001","candidateLabel":"Nguyen Phan Nguyen","linkedinUrl":"https://www.linkedin.com/in/nguyenpn1/","githubUrl":"https://github.com/ngstephen1","portfolioUrl":"https://lamanhtruong.com"}' | jq .
```

Stream without copying a run id:

```bash
curl -N "http://localhost:3002/api/aihire/social-screen/stream?runId=latest&candidate=nguyen-phan-nguyen"
```

Fetch the final report:

```bash
curl -s "http://localhost:3002/api/aihire/social-screen/report?runId=latest&candidate=nguyen-phan-nguyen" | jq .
```

## Integration Notes

- The web app assumes same-origin API calls. If Bao tests from another frontend origin, convert relative `streamUrl` and `reportUrl` into absolute URLs.
- `runId=demo` is now a self-contained demo bundle under `apps/llm/agents/.runs/social/demo/demo`, so it is safe for demos and does not depend on the latest real run path.
- `runId=latest&candidate=<slug>` depends on the candidate slug folder under `apps/llm/agents/.runs/social/<slug>/`.
- The stream is SSE, not JSON polling. Use `EventSource` in browser code, and keep `/status` as the fallback path if SSE disconnects.
- The backend writes artifacts into the llm run directory. If the UI needs a human-readable debug link, point internal users to the run folder, not to raw `artifactPath` values in the candidate-facing UI.
- If Bao needs a deterministic demo, use `mode: "demo"` or `mode: "deterministic"`. Use `mode: "nova"` only when live capture is actually needed.

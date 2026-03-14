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

Event types:

- `status`
- `finding`
- `log`
- `error`
- `done`
- `ping`

SSE payloads:

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

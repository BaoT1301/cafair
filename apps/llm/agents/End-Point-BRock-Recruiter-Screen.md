# AI Endpoint Handoff

## Bedrock Recruiter Screen
Note for the recruiter-side Bedrock screening flow.  
Covers local testing, app wrapper usage, API route usage, input/output.....

---

## What is working now

The recruiter Bedrock screen is working end to end in local development.

Confirmed working:
- AWS auth with `AWS_PROFILE=local-iam`
- real Amazon Bedrock model listing
- real Bedrock Converse call
- model `amazon.nova-lite-v1:0`
- prompt builder
- parser
- schema validation
- app wrapper
- local REST API route

Last confirmed successful result:
- `provider: bedrock-converse`
- `degraded: false`
- `usedFallback: false`
- `parseOk: true`
- `validationOk: true`

---

## Main endpoint for frontend handoff

### Local REST endpoint
```bash
POST http://localhost:3000/api/aihire/bedrock-screen
```

### Local health check

tRPC mutation used by recruiter UI
recruiter.getBedrockScreen

Use this when:
	•	recruiter clicks Run AI Screen
	•	recruiter opens candidate detail drawer/page and wants on-demand AI evaluation


### Local test commands
1) Core Bedrock script test

Run the raw Bedrock screening agent directly.
```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx apps/llm/agents/scripts/run-bedrock-local.ts
```

2) App wrapper script test

Run the app-level wrapper that frontend/backend will call.
```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx apps/llm/agents/scripts/run-app-bedrock-wrapper-local.ts
```

3) Start web app with real Bedrock env

Run this before testing the HTTP route.
```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npm run dev:web
```

4) Test route health
```bash
curl http://localhost:3000/api/aihire/bedrock-screen
```

Expected:
```bash
{
  "ok": true,
  "route": "/api/aihire/bedrock-screen",
  "method": "POST",
  "requiredFields": ["candidateId", "name", "roleTitle", "resumeText"],
  "optionalFields": ["companyName", "roleRequirements", "transcriptText", "notes"]
}
```

5) Test real POST request
```bash
curl -X POST http://localhost:3000/api/aihire/bedrock-screen \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "cand_np_001",
    "name": "Nguyen Phan Nguyen",
    "roleTitle": "AI Music Engineer",
    "companyName": "AI Hire AI",
    "resumeText": "Developed real-time AI music transcription engine with <100ms latency. Built React-based music visualization dashboard used by 10K+ users. 3 years of ML and web development experience with strong PyTorch and full-stack skills.",
    "roleRequirements": ["PyTorch", "full-stack", "real-time systems"]
  }'
```

Files used in the recruiter Bedrock screen flow

API route

apps/web-client/src/app/api/aihire/bedrock-screen/route.ts

This is the HTTP route for frontend or manual curl testing.

What it does:
	•	supports GET for route health check
	•	supports POST for recruiter Bedrock screen requests
	•	validates required fields
	•	returns JSON response
	•	calls the app wrapper


App wrapper

apps/web-client/src/server/aihire/bedrock.ts

Main function

getBedrockScreen(input)

This is the stable app-level wrapper.

What it does:
	•	validates required input
	•	trims and normalizes strings
	•	calls the Bedrock screening agent
	•	returns either:
	•	{ ok: true, result }
	•	or { ok: false, error, details }

This is the safest backend function for teammate integration.

⸻

#### 
Underlying Bedrock screening agent

apps/llm/agents/src/agents/bedrockScreen.ts

Main function

runBedrockCandidateScreen(input)

What it does:
	•	builds the recruiter screening prompt
	•	calls the Bedrock service wrapper
	•	parses JSON from model output
	•	validates final structure
	•	returns a normalized recruiter-screen result

This is the AI logic core for recruiter screening.

⸻

#### Supporting files

Prompt builder

apps/llm/agents/src/prompts/candidateScreen.ts

Builds:
	•	recruiter screening system prompt
	•	user prompt
	•	schema hint for structured JSON output

⸻

### Parser

apps/llm/agents/src/parsers/candidateScreenParser.ts

Handles:
	•	extracting JSON from plain text
	•	extracting JSON from fenced code blocks
	•	recovering usable structured output from model text

⸻

### Schema

apps/llm/agents/src/schema/candidateScreenSchema.ts

Handles:
	•	validation of Bedrock screen output
	•	normalization of missing or malformed fields
	•	final safe object shape for app usage

⸻

### Bedrock service wrapper

apps/llm/agents/src/services/bedrockClient.ts

Handles:
	•	Bedrock Converse calls
	•	retries
	•	timeout wrapper
	•	metrics logging
	•	fallback handling
	•	structured JSON generation helper

This is the more production-style Bedrock wrapper.

⸻

### Bedrock adapter

apps/llm/agents/src/adapters/bedrock.ts

Handles:
	•	model listing
	•	generic invoke
	•	text generation
	•	stub mode vs real mode
	•	low-level Bedrock runtime integration

This is the lower-level adapter layer.


### Input contract

The Bedrock recruiter screen expects this request body:
```json
{
  "candidateId": "cand_np_001",
  "name": "Nguyen Phan Nguyen",
  "roleTitle": "AI Music Engineer",
  "companyName": "AI Hire AI",
  "resumeText": "Developed real-time AI music transcription engine...",
  "roleRequirements": ["PyTorch", "full-stack", "real-time systems"],
  "transcriptText": "",
  "notes": ""
}
```

Required fields
	•	candidateId
	•	name
	•	roleTitle
	•	resumeText

Optional fields
	•	companyName
	•	roleRequirements
	•	transcriptText
	•	notes


### Success response shape!!
```json
{
  "ok": true,
  "result": {
    "candidateId": "cand_np_001",
    "score": 90,
    "strengths": [
      "Developed real-time AI music transcription engine processing audio with <100ms latency.",
      "Built React-based music visualization dashboard used by 10K+ users.",
      "3 years ML + web dev. Strong PyTorch and full-stack experience."
    ],
    "concerns": [
      "No additional information from transcript or recruiter notes."
    ],
    "summary": "Nguyen Phan Nguyen has a strong background in real-time AI systems and full-stack development, with specific experience in PyTorch and React, aligning well with the role requirements.",
    "recommendation": "INTERVIEW",
    "modelId": "amazon.nova-lite-v1:0",
    "provider": "bedrock-converse",
    "degraded": false,
    "usedFallback": false,
    "parseOk": true,
    "validationOk": true,
    "metrics": {
      "feature": "candidate_screen",
      "provider": "bedrock-converse",
      "modelId": "amazon.nova-lite-v1:0",
      "latencyMs": 1314,
      "attempts": 1,
      "usedFallback": false,
      "degraded": false,
      "inputTokensEstimated": 332,
      "outputTokensEstimated": 151,
      "timestampISO": "2026-02-28T16:42:35.845Z",
      "requestId": "f6b7b0a9-5fca-49fe-a19c-d3c4de08604d"
    }
  }
}
```

### Failed Response:
```json
{
  "ok": false,
  "error": "Failed to run Bedrock recruiter screen",
  "details": "Error message here"
}
```

What frontend should render

Frontend can safely render:
	•	fit score
	•	strengths
	•	concerns
	•	summary
	•	recommendation badge
	•	optional model/provider/latency info

Frontend does not need to know about:
	•	prompt logic
	•	parsing
	•	schema validation
	•	retries
	•	fallback behavior
	•	raw Bedrock payload shape

⸻

Important note about stub vs real mode

If the API returns:
	•	"provider": "stub"

then the web server was started without the real Bedrock env loaded.

To force real Bedrock mode, restart the dev server with:

```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npm run dev:web
```

Then test again.

A correct real-mode response should show:
	•	provider: bedrock-converse
or
	•	provider: bedrock-invoke

Preferred current path:
	•	provider: bedrock-converse

⸻

Quick teammate handoff note

If teammate only needs the usable backend integration point:

Use this route
```bash
POST /api/aihire/bedrock-screen
```

Or call this backend function
```typescript
getBedrockScreen(input)
```

Or use this recruiter tRPC mutation
```typescript
recruiter.getBedrockScreen
```

### Current status summary

Stephen confirmed:
	•	Bedrock auth works
	•	local Bedrock scripts work
	•	app wrapper works
	•	local HTTP route works
	•	real Bedrock screening works in local mode
	•	frontend/backend can now integrate against a stable response contract


### Nexttt useful endpoints to build

Follow the same pattern for these next:
	1.	recruiter.getSocialScreen
	2.	candidate.getResumeTailor
	3.	candidate.getApplicationPlan

Each should reuse the same architecture:
	•	prompt
	•	service wrapper
	•	parser
	•	schema
	•	app wrapper
	•	HTTP route or tRPC procedure

### Suggested next step for fullstack

Add the next REST route and tRPC hook for social screen

Why:
	•	recruiter side already has Bedrock screen
	•	social screen is the most natural next recruiter feature
	•	it reuses the exact same architecture pattern

After that:
	•	add candidate-side resume tailor
	•	add candidate-side application plan
	•	then wire all three into the UI
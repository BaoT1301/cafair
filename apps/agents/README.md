# AI HIRE AI Agents

This folder contains the agent-side logic, local runners, and integration notes for the **AI Hire AI** app. It supports:

- **recruiter-side screening**
- **candidate-side planning**
- **social signal capture + social screening**
- **Bedrock-based structured reasoning**
- **Nova Act / local browser automation experiments**

Outputs are designed for UI rendering, backend integration, and future ATS sync.

---

What’s implemented

Recruiter-side agents
	•	Triage Agent (src/agents/triage.ts)
Routes candidates into:
	•	RECRUITER_NOW
	•	QUICK_ASYNC_SCREEN
	•	POLITE_REDIRECT
	•	Verify Agent (src/agents/verify.ts)
Detects artifact mismatches, suspicious patterns, and verification risk across resume, transcript, and essay.
	•	Micro-Screen Agent (src/agents/microscreen.ts)
Scores short transcript-based screens on communication, role fit, and depth.
	•	Candidate Packet Orchestrator (src/agents/candidatePacket.ts)
Combines triage, verification, and micro-screen into one recruiter-ready packet.
	•	ATS Payload Adapter (src/agents/atsPayload.ts)
Converts recruiter-side outputs into ATS-ready notes, tags, tasks, email drafts, and action previews.
	•	Bedrock Recruiter Screen (src/agents/bedrockScreen.ts)
Runs a structured recruiter screen using Bedrock and returns validated scoring output.
	•	Social Screen Agent (src/agents/socialScreen.ts)
Produces deterministic social verification output for LinkedIn, GitHub, and web-style signals.
This is the base local scoring layer used before optional LLM enrichment.

---

Candidate-side agents
	•	Candidate Plan Agent (src/agents/candidatePlan.ts)
Generates a step-by-step plan for job search, resume tailoring, referrals, applications, and follow-ups.

---

Adapters
	•	Nova Act Adapter (src/adapters/novaAct.ts)
Starts and checks Nova Act workflow runs for action automation.
	•	Bedrock Adapter (src/adapters/bedrock.ts)
Handles Bedrock model listing, text generation, and invoke calls in stub or real mode.
	•	Embeddings Adapter (src/adapters/embeddings.ts)
Placeholder/helper layer for future semantic matching and retrieval.

---

Services
	•	Bedrock Service Wrapper (src/services/bedrockClient.ts)
Adds retries, metrics, guardrails, model/profile selection, and fallback handling around Bedrock calls.
	•	Social Screen Service (src/services/socialScreenService.ts)
Stable service wrapper for social screening:
	•	runs deterministic base social screen first
	•	optionally enriches with Bedrock
	•	normalizes final output for recruiter UI
	•	Local Social Capture Service (src/services/socialCaptureLocal.ts)
Helper layer for local social capture experiments / wrappers.

---

Contracts
	•	Social Screen Contract (src/contracts/socialScreen.ts)
Shared contract/type definitions for social screen request/response shapes and app integration stability.

---

Prompts, parsers, and schema

Prompts
	•	src/prompts/candidateScreen.ts
	•	src/prompts/socialScreen.ts
	•	src/prompts/resumeTailor.ts

These keep prompt construction modular and reusable.

Parsers
	•	src/parsers/candidateScreenParser.ts
	•	src/parsers/socialScreenParser.ts

These normalize and parse model output into reliable internal structures.

Schema
	•	src/schema/candidateScreenSchema.ts

Used for validation of structured Bedrock recruiter-screen output.

---

### Scripts / local runners

Run these from the agents folder unless you intentionally run from repo root with adjusted paths.

TypeScript local demos

```bash
npx tsx scripts/run-local.ts
npx tsx scripts/run-verify-local.ts
npx tsx scripts/run-microscreen-local.ts
npx tsx scripts/run-packet-local.ts
npx tsx scripts/run-social-screen-local.ts
npx tsx scripts/run-social-capture-local.ts
```

---

Bedrock local demos
```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx scripts/run-bedrock-local.ts
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx scripts/run-app-bedrock-wrapper-local.ts
```

Python automation / browser capture experiments

```bash
python scripts/run-social-capture-nova.py --help
python scripts/run-social-screen-public-page.py --help
```

---

These Python scripts are used for:
	•	Nova Act workflow polling experiments
	•	local visible browser crawling
	•	public-page recruiter-style scanning
	•	social capture prototyping

---

Key paths
	•	src/types.ts — shared base types
	•	src/index.ts — public exports
	•	src/agents/* — core agent logic
	•	src/adapters/* — AWS/model adapters
	•	src/services/* — orchestration wrappers
	•	src/contracts/* — stable service contracts
	•	src/prompts/* — reusable prompt builders
	•	src/parsers/* — model output parsers
	•	src/schema/* — validation schema
	•	scripts/* — local runners and debugging scripts

---

Social capture stack

There are now two separate layers in the social pipeline:

1. Social capture

This is the data collection layer.

Current script options:
	•	Local capture: scripts/run-social-capture-local.ts
	•	Nova workflow / API-key capture: scripts/run-social-capture-nova.py
	•	Generic public-page recruiter crawl: scripts/run-social-screen-public-page.py

Capture is responsible for gathering:
	•	LinkedIn signals
	•	GitHub signals
	•	public web / portfolio signals

2. Social screen

This is the reasoning + scoring layer.

Main files:
	•	src/agents/socialScreen.ts
	•	src/services/socialScreenService.ts
	•	src/prompts/socialScreen.ts
	•	src/parsers/socialScreenParser.ts
	•	src/contracts/socialScreen.ts

Flow:
	1.	capture public signals
	2.	pass signals into social screen service
	3.	optionally enrich with Bedrock
	4.	return normalized recruiter-ready result

---

Current Bedrock status

The Bedrock recruiter screening flow is working in real mode with:
	•	Bedrock Converse
	•	Amazon Nova Lite (amazon.nova-lite-v1:0)
	•	structured JSON output
	•	parser + schema validation
	•	metrics logging

Current stable app wrapper:
	•	getBedrockScreen(...)

This wraps:
	•	runBedrockCandidateScreen(...)


---

Current social screen status

The social screen stack is now split into:
	•	deterministic base scoring in src/agents/socialScreen.ts
	•	optional Bedrock enrichment in src/services/socialScreenService.ts
	•	prompt generation in src/prompts/socialScreen.ts
	•	response parsing in src/parsers/socialScreenParser.ts

Current Bedrock social-screen enrichment is designed to work with:
	•	base signal input (LinkedIn / GitHub / web)
	•	normalized structured output
	•	recruiter UI-friendly summaries, flags, and score

---

Nova Act / automation status

Workflow mode

run-social-capture-nova.py supports workflow polling and repeated fetch attempts, but workflow runs may remain RUNNING if:
	•	the remote workflow is still executing
	•	the workflow definition does not yet emit a structured output payload
	•	the workflow is missing a final output mapping

API-key mode

API-key mode is currently the easier local path for visible experiments and debugging.

Local browser mode

For visible browser debugging, current experiments support:
	•	Chrome preference (best effort)
	•	human-observable scrolling / clicking
	•	local HTML + screenshot logs in the public-page script

--- 

### App integration

Current recruiter-side route
	•	POST /api/aihire/bedrock-screen

Current recruiter-side health/info route
	•	GET /api/aihire/bedrock-screen

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

The route returns:
	•	ok: true with recruiter screen result
	•	or ok: false with error details

---

### Documentation files in this folder
	•	AWS-DOC.md — AWS setup / notes
	•	End-Point-BRock-Recruiter-Screen.md — recruiter screen endpoint notes
	•	End-Point-BRock-Stalker-AI.md — stalker / social endpoint notes
	•	Nova-Auto-Action.md — Nova / automation notes
	•	ai-stalker.md — social / stalking feature notes
	•	plan-for-agent.md — planning / roadmap notes

These are project notes and integration references alongside the source code.

⸻

How this connects to the product

These agents are designed to plug into:
	•	Recruiter UI
lane routing, AI scorecards, social checks, risk popups, ATS actions
	•	Candidate UI
application plans, resume tailoring, referral and follow-up guidance
	•	Nova Act / browser automation
workflow automation, public-page crawling, future action execution
	•	Bedrock
reasoning, screening, and structured output generation

AI Hire AI is an automation and intelligence layer, not a replacement for an existing ATS.

⸻

Next steps
	•	Add a stable app wrapper for social screen
	•	Add a stable app wrapper for social capture
	•	Expose a backend procedure for capture + social screen end-to-end
	•	Map real Nova workflow structured output into:
	•	LinkedIn fields
	•	GitHub fields
	•	web results
	•	Add frontend wiring for recruiter candidate drawer to use real social-screen output
	•	Add stronger structured parsing for local browser/public-page crawlers
	•	Add exportable recruiter summaries (JSON / markdown / HTML)


## Current structure

```bash
(.venv) macbook@Stephens-McDonalds-air agents % tree
.
├── ai-stalker.md
├── AWS-DOC.md
├── End-Point-BRock-Recruiter-Screen.md
├── End-Point-BRock-Stalker-AI.md
├── Nova-Auto-Action.md
├── plan-for-agent.md
├── README.md
├── requirements.txt
├── scripts
│   ├── agents
│   │   └── scripts
│   ├── run-app-bedrock-wrapper-local.ts
│   ├── run-bedrock-local.ts
│   ├── run-local.ts
│   ├── run-microscreen-local.ts
│   ├── run-packet-local.ts
│   ├── run-social-capture-local.ts
│   ├── run-social-capture-nova.py
│   ├── run-social-screen-local.ts
│   ├── run-social-screen-public-page.py
│   └── run-verify-local.ts
└── src
    ├── adapters
    │   ├── bedrock.ts
    │   ├── embeddings.ts
    │   └── novaAct.ts
    ├── agents
    │   ├── atsPayload.ts
    │   ├── bedrockScreen.ts
    │   ├── candidatePacket.ts
    │   ├── candidatePlan.ts
    │   ├── microscreen.ts
    │   ├── socialScreen.ts
    │   ├── triage.ts
    │   └── verify.ts
    ├── contracts
    │   └── socialScreen.ts
    ├── index.ts
    ├── parsers
    │   ├── candidateScreenParser.ts
    │   └── socialScreenParser.ts
    ├── prompts
    │   ├── candidateScreen.ts
    │   ├── resumeTailor.ts
    │   └── socialScreen.ts
    ├── schema
    │   └── candidateScreenSchema.ts
    ├── services
    │   ├── bedrockClient.ts
    │   ├── socialCaptureLocal.ts
    │   └── socialScreenService.ts
    └── types.ts

12 directories, 41 files
```
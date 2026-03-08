# AI Endpoint Handoff Notes

## Status
The **Social Screen API endpoint is working** end-to-end in local development and has been validated with a real Bedrock call.

Confirmed behavior:
- REST route responds successfully
- App wrapper calls agent service correctly
- Agent returns structured recruiter-ready JSON
- Bedrock enrichment is active
- Parser succeeds (`parseOk: true`)
- No fallback used
- No degraded mode

---

## Working Endpoint

### REST
`POST /api/aihire/social-screen`

### Health / shape check
`GET /api/aihire/social-screen`

Returns:
- route info
- method
- required fields
- optional fields

---

## Current File Flow

### REST route
`apps/web-client/src/app/api/aihire/social-screen/route.ts`

Responsibilities:
- exposes GET + POST
- accepts JSON request body
- calls app wrapper
- returns JSON success/error response

---

### App wrapper
`apps/web-client/src/server/aihire/social-screen.ts`

Responsibilities:
- validates required fields
- normalizes request body
- builds safe `linkedin`, `github`, `web` payloads
- calls `runSocialScreenService(...)`
- returns stable app-layer response

---

### Service wrapper
`apps/llm/agents/src/services/socialScreenService.ts`

Responsibilities:
- stable entrypoint for social screening
- runs deterministic local baseline first
- optionally enriches with Bedrock reasoning
- parses Bedrock JSON
- merges Bedrock patch into baseline result
- returns provider / parse / metrics metadata

Current behavior:
- local deterministic social findings are preserved
- Bedrock currently improves:
  - summary
  - fitScore / socialScore patch behavior
  - risk
  - strengths / concerns / flags style patch fields
- final merged result is stable and UI-safe

---

### Deterministic agent
`apps/llm/agents/src/agents/socialScreen.ts`

Responsibilities:
- builds baseline social intelligence report
- uses provided LinkedIn / GitHub / Web inputs
- generates:
  - findings
  - counts
  - recommendation
  - signals
  - evidence
  - flags
  - recommended actions

This is the current main source of the detailed `findings[]` list.

---

### Prompt builder
`apps/llm/agents/src/prompts/socialScreen.ts`

Responsibilities:
- builds Bedrock prompt bundle
- includes:
  - candidate info
  - role info
  - school
  - resume
  - linkedin
  - github
  - web
- defines strict JSON schema hint for model output

Important:
- this now passes real social inputs into Bedrock prompt
- Bedrock no longer assumes LinkedIn/GitHub are missing when they are provided

---

### Parser
`apps/llm/agents/src/parsers/socialScreenParser.ts`

Responsibilities:
- parses fenced JSON or raw JSON
- normalizes findings
- derives counts
- derives risk
- exposes:
  - socialScore
  - findings
  - recommendation
  - summary
  - legacy aliases like `fitScore`, `risk`, `flags`

Current status:
- parser works
- real Bedrock response parsed successfully

---

## Confirmed Bedrock Model

Current model used:
- `amazon.nova-lite-v1:0`

Current provider:
- `bedrock-converse`

Example confirmed metadata:
- `parseOk: true`
- `degraded: false`
- `usedFallback: false`

---

## Example Successful API Result

Latest successful run produced:
- `socialScore: 100`
- `verifiedCount: 8`
- `warningCount: 0`
- `criticalCount: 0`
- `infoCount: 4`
- `totalFindings: 12`
- `risk: "low"`
- `screenScore: 40`

Recommendation:
- proceed with high confidence

Signals confirmed:
- LinkedIn found
- GitHub found
- Google / web references found

Recommended actions:
- `Schedule Interview`
- `Sync to ATS`
- `Send Follow-up`

---

## What Is Working Well

- Nested social input payload is accepted correctly
- LinkedIn / GitHub / Web no longer show false “missing” warnings when supplied
- Real Bedrock call succeeds reliably
- UI-ready JSON shape is stable
- Route + wrapper + service + parser chain is functional

---

## Important Current Design Note

Right now, the **deterministic local agent is still the main source of `findings[]`**.

Bedrock is mainly used as an **enrichment layer**, not the source of truth for the full report.

This is intentional and currently safer because:
- deterministic findings are stable
- easier to debug
- prevents LLM-only drift
- keeps UI output consistent

---

## Suggested Next Improvement

### Best next backend improvement
Merge selected Bedrock findings into the final `findings[]` array carefully.

Goal:
- keep deterministic findings as baseline
- optionally append high-confidence Bedrock findings
- avoid duplicates
- avoid overwriting strong deterministic evidence

Suggested merge rule:
- preserve all local findings
- append only new Bedrock findings with confidence >= threshold
- normalize source/severity before merge
- cap total findings to a clean UI limit (e.g. 12)

---

## Recommended Next API Features

1. Add Bedrock finding merge logic  
2. Add tRPC procedure for social screen  
3. Add frontend recruiter social report card  
4. Add Nova Act collector for live data  
5. Add optional screenshot / browser evidence pipeline  

---

## Test Commands

### Local agent script
```bash
npx tsx apps/llm/agents/scripts/run-social-screen-local.ts
```

REST shape check
```bash
curl http://localhost:3000/api/aihire/social-screen
```

REST POST test

```bash
curl -X POST http://localhost:3000/api/aihire/social-screen \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "cand_np_001",
    "name": "Nguyen Phan Nguyen",
    "roleTitle": "AI Music Engineer",
    "school": "Georgia Tech",
    "resumeText": "Developed real-time AI music transcription engine with <100ms latency. Built React-based music visualization dashboard used by 10K+ users. 3 years of ML and web development experience with strong PyTorch and full-stack skills.",
    "linkedin": {
      "url": "https://www.linkedin.com/in/nguyenpn1/",
      "headline": "AI Music Engineer",
      "currentCompany": "Independent / Project-based",
      "school": "Georgia Tech",
      "skills": ["PyTorch", "React", "TypeScript", "Python", "Full-stack"],
      "experiences": [
        {
          "title": "AI Music Engineer",
          "company": "Independent",
          "start": "2024",
          "end": "Present",
          "description": "Built AI music and real-time audio systems."
        }
      ]
    },
    "github": {
      "url": "https://github.com/ngstephen1",
      "username": "ngstephen1",
      "displayName": "Nguyen Phan Nguyen",
      "bio": "Software engineer building tools and ML products",
      "followers": 89,
      "following": 124,
      "contributionsLastYear": 847,
      "pinnedRepos": [
        {
          "name": "react-travel-ui",
          "description": "Component library for travel apps",
          "language": "TypeScript",
          "stars": 67
        },
        {
          "name": "ai-booking-engine",
          "description": "ML-powered recommendation system",
          "language": "Python",
          "stars": 45
        }
      ],
      "topLanguages": ["TypeScript", "Python", "JavaScript", "Go"]
    },
    "web": {
      "queries": [
        "Nguyen Phan Nguyen developer",
        "Nguyen Phan Nguyen hackathon"
      ],
      "results": [
        {
          "title": "Conference talk found",
          "snippet": "Built scalable apps and presented at a university tech event.",
          "source": "google"
        },
        {
          "title": "Hackathon winner",
          "snippet": "Placed in a student hackathon with an AI project.",
          "source": "google"
        }
      ]
    }
  }'
```

Summary

The Social Screen API is ready for teammate integration/testing.

Safe assumptions for frontend/API integration:
	•	endpoint exists
	•	response shape is stable
	•	Bedrock is connected
	•	parser works
	•	metrics are exposed
	•	current report is reliable for demo/testing

Main next engineering task:
	•	merge Bedrock findings into final report without breaking deterministic stability
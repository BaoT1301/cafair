# Apply Agent Status

## What is working so far

The apply-agent pipeline is now split into two main layers:

1. **Web client / API layer (Next.js)**
2. **Python Nova Act runtime layer**

This gives us a clean separation between:
- job scanning and ranking
- provider-specific apply planning
- browser automation execution

---

## Current completed pieces

### 1. Job scan and ranking flow
Implemented endpoints and supporting logic for:

- `POST /api/aihire/apply-agent/match`
- `POST /api/aihire/apply-agent/scan`
- `GET /api/aihire/apply-agent/source/simplify`
- `GET /api/aihire/apply-agent/history`

What this does:
- accepts `resumeText`
- performs **rule-based keyword matching**
- ranks jobs against the resume
- uses **Simplify source first**
- supports **SerpAPI fallback**
- supports a second-stage **Bedrock rerank path** (currently safe / heuristic-ready structure)
- stores run history records

---

### 2. Apply run planning endpoint
Implemented:

- `POST /api/aihire/apply-agent/run`

What this does:
- validates target job URL
- detects provider from URL:
  - Greenhouse
  - Ashby
  - Workday
- builds a provider-specific apply plan
- returns:
  - `provider`
  - `plan`
  - `executionSteps`
  - `runner` metadata
  - `safeStopBeforeSubmit`
- records each run in history

This is already working in:
- `mode: "plan"`
- `mode: "demo"`
- `mode: "live"` response shape

---

## Python apply-agent runtime structure

Created a dedicated Python runtime under:

- `apps/llm/agents/src/apply-agent/`

This is intentionally separate from previous recruiter/social-screen logic.

### Main files created
- `__init__.py`
- `models.py`
- `contracts.ts`
- `types.ts`
- `nova_runner.py`
- `runtime_bridge.py`
- `browser_session.py`
- `form_filler.py`
- `field_mapper.py`
- `profile_loader.py`
- `execution_report.py`
- `transport_executor.py`

### Provider adapter files
- `providers/base.py`
- `providers/greenhouse.py`
- `providers/ashby.py`
- `providers/workday.py`

### Local dev script
- `apps/llm/agents/scripts/apply-agent/run-local.ts`

This script can call the Python runner in:
- `--transport workflow`
- `--transport api`

and in:
- `--mode plan`
- `--mode demo`
- `--mode live`

---

## Provider support status

### Greenhouse
Most mature right now.

Supports:
- provider detection
- provider adapter
- field schema assumptions
- execution plan generation
- visible field metadata in responses

### Ashby
Also in good shape.

Supports:
- provider detection
- provider adapter
- field schema assumptions
- execution plan generation
- visible field metadata in responses

### Workday
Present and usable for planning, but intentionally simpler than Greenhouse/Ashby right now.

Supports:
- provider detection
- provider adapter
- plan generation

---

## What the local runner can do now

You can run commands like:

- plan mode
- demo mode
- live mode
- workflow transport
- api transport

The local runner currently returns structured JSON including:
- `status`
- `executed`
- `visibleFields`
- `executionSteps`
- `runner`
- `targetUrl`
- `company`
- `roleTitle`
- `selectors`
- `plannedSteps`

This confirms:
- Python imports are valid
- provider routing works
- execution plans are being built correctly
- the TS-to-Python bridge is functioning

---

## Important current limitation

**The system is very close to live visible browser automation, but it is not fully there yet unless the lower runtime layers are actually launching a real browser session.**

Right now, the outputs show that:
- the agent is building the right plan
- the runtime says `mode=live`
- the runtime says `status=running`
- the runtime says `executed=true`

But that alone does **not** guarantee:
- a browser window actually opens
- Nova Act visibly navigates pages
- reasoning/action logs stream live in the browser flow

That final visible behavior depends on deeper wiring in:

- `browser_session.py`
- `runtime_bridge.py`
- `transport_executor.py`
- `nova_runner.py`

---

## What has been validated already

Confirmed working from terminal:

- `match` endpoint returns ranked jobs
- `scan` endpoint returns recommended jobs
- `run` endpoint returns provider-specific plans
- history records successfully
- local TypeScript script can invoke Python runner
- Python files compile successfully with `py_compile`

This means the stack is **structurally healthy**.

---

## Best current summary

The apply-agent is now at the stage of:

- **resume-to-job fit filtering works**
- **provider-specific apply planning works**
- **TS ↔ Python runtime handoff works**
- **Greenhouse / Ashby are prioritized and modeled**
- **safe stop before submit is built in**
- **history and plan metadata are working**

The main remaining milestone is:

> replace the last simulation/stub-like execution path with a truly visible browser-driving Nova Act session that opens the browser, navigates the provider page, detects fields, fills what it can, and stops safely before final submit.

---

## Immediate next focus

To reach actual visible browser automation, tighten these files next:

1. `apps/llm/agents/src/apply-agent/browser_session.py`
2. `apps/llm/agents/src/apply-agent/runtime_bridge.py`
3. `apps/llm/agents/src/apply-agent/transport_executor.py`
4. `apps/llm/agents/src/apply-agent/nova_runner.py`

Goal of that step:
- make `--transport api --mode live` actually open a browser window
- visibly navigate to the job page
- log steps/reasoning
- detect fields
- prefill fields
- stop before final submit

---

## Safety behavior

The current design intentionally keeps:

- `safeStopBeforeSubmit = true` by default

So even when live automation is fully wired, the apply-agent should:
- open
- inspect
- fill
- pause before final submit

This is the intended safe behavior.

---

## Overall project status

**Status: strong foundation complete, browser-visible live execution almost ready**

You already have:
- the scanning pipeline
- ranking pipeline
- provider plan generation
- Python runtime skeleton
- provider adapters
- local runner
- transport mode separation

The remaining work is mainly in the final browser-execution layer.
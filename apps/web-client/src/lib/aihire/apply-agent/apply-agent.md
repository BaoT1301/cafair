1) Update the run route to accept richer input

File:
apps/web-client/src/app/api/aihire/apply-agent/run/route.ts

Goal:
	•	accept full job object, not just targetUrl
	•	support provider
	•	support mode: "demo" | "plan" | "live"
	•	return a structured run plan

You want this route to become the bridge between:
	•	ranked job
	•	browser automation

⸻

2) Create a browser plan builder

File to create:
apps/web-client/src/lib/aihire/apply-agent/buildApplyExecutionPlan.ts

Purpose:
	•	inspect the job URL
	•	infer provider:
	•	greenhouse
	•	workday
	•	ashby
	•	unknown
	•	return steps like:
	•	open page
	•	wait for apply button
	•	click apply
	•	capture form fields
	•	fill profile fields
	•	upload resume
	•	stop before submit

This should be pure logic first, no real browser yet.

⸻

3) Update the Nova Act runner stub

File:
apps/web-client/src/lib/aihire/apply-agent/novaActApplyRunner.ts

Purpose:
	•	consume the execution plan
	•	for now, return:
	•	status: "planned" or status: "demo_ready"
	•	list of browser actions
	•	provider detected
	•	later this becomes the real Nova Act integration point

Right now this file should be your single future integration point for actual Nova Act execution.

⸻

4) Create provider detection helper

File to create:
apps/web-client/src/lib/aihire/apply-agent/detectApplicationProvider.ts

Simple logic:
	•	greenhouse.io => "greenhouse"
	•	myworkdayjobs.com / workdayjobs.com => "workday"
	•	ashbyhq.com => "ashby"
	•	else => "unknown"

This keeps run/route.ts clean.

⸻

5) Create provider-specific plan adapters

Start with:
	•	apps/web-client/src/lib/aihire/apply-agent/providers/buildGreenhousePlan.ts
	•	apps/web-client/src/lib/aihire/apply-agent/providers/buildWorkdayPlan.ts
	•	apps/web-client/src/lib/aihire/apply-agent/providers/buildAshbyPlan.ts

Since your top jobs include:
	•	Flagship = Greenhouse
	•	New York Post = Workday
	•	OpenAI = Ashby

This is exactly the right split.

For now these files only need to return structured steps, for example:
	•	selector hints
	•	expected upload field
	•	expected first-name / last-name / email / phone fields
	•	final submit safety stop

⸻

Recommended next implementation order

Use this order:
	1.	run/route.ts
	2.	detectApplicationProvider.ts
	3.	buildApplyExecutionPlan.ts
	4.	providers/buildGreenhousePlan.ts
	5.	providers/buildWorkdayPlan.ts
	6.	providers/buildAshbyPlan.ts
	7.	novaActApplyRunner.ts

That gets you to:
	•	top job selected
	•	provider detected
	•	browser plan generated
	•	safe demo run returned

Then after that:
	•	plug real Nova Act/browser execution into the runner

⸻

What to test next

After those files are updated, your next test should be:
	1.	scan for jobs
	2.	take the first recommendedJobs[0]
	3.	POST it into /api/aihire/apply-agent/run
	4.	confirm response includes:
	•	provider
	•	execution steps
	•	safe stop before submit

That is the clean next checkpoint.

⸻

Progress tracker
	•	job source endpoint
	•	keyword ranking
	•	AI reranking fallback
	•	shortlist output
	•	provider detection
	•	execution plan generation
	•	Nova Act runner integration
	•	real browser click/apply flow
	•	form fill + resume upload
	•	final submit guardrail

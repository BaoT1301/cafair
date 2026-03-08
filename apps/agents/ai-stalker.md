Stage 1 — Nova Act first (data capture)

Goal: prove the agent can open pages, navigate, and collect raw signals.

Build Run Social Screen Agent as a Nova Act workflow that does:
	1.	Open LinkedIn profile
	2.	Extract visible structured fields
	•	name
	•	headline
	•	location
	•	experience titles
	•	companies
	•	dates
	•	skills
	•	education
	3.	Open GitHub profile
	4.	Extract visible structured fields
	•	username
	•	name
	•	bio
	•	follower count
	•	contribution graph text
	•	pinned repos
	•	repo names / stars / languages
	5.	Run web search queries
	•	name + company
	•	name + university
	•	name + hackathon
	•	name + talk / article
	6.	Save all raw findings into one JSON payload

At this stage, do not score yet.
Just prove reliable collection.

⸻

Stage 2 — Normalize into one schema

Goal: convert messy captured UI text into one stable contract.

Create one internal shape like:

```bash
type SocialScreenRaw = {
  candidateName: string;
  linkedin?: {
    url: string;
    headline?: string;
    location?: string;
    experience?: Array<{
      title?: string;
      company?: string;
      start?: string;
      end?: string;
    }>;
    education?: string[];
    skills?: string[];
  };
  github?: {
    url: string;
    username?: string;
    followers?: number;
    following?: number;
    contributionsLastYear?: number;
    pinnedRepos?: Array<{
      name: string;
      description?: string;
      language?: string;
      stars?: number;
    }>;
    topLanguages?: string[];
  };
  web?: {
    queries: string[];
    results: Array<{
      title: string;
      snippet?: string;
      url?: string;
      source?: string;
    }>;
  };
};
```

Nova Act’s job = fill this.

Stage 3 — Bedrock reasoning layer

Goal: turn raw signals into Live Findings + Social Intelligence Report.

Pass the normalized JSON into Bedrock and ask it to produce:
	1.	Findings list
	•	category: VERIFIED / WARNING / INFO / CRITICAL
	•	source: LinkedIn / GitHub / Web
	•	title
	•	explanation
	•	confidence
	2.	Rollup metrics
	•	socialScore (0–100)
	•	verifiedCount
	•	warningCount
	•	criticalCount
	•	infoCount
	3.	AI recommendation
	•	concise recruiter-facing summary
	•	proceed / review / hold

This is where Bedrock is strongest:
	•	cross-source consistency checks
	•	summarization
	•	flagging patterns
	•	producing recruiter language

⸻

Stage 4 — Optional screenshot/image fallback

Use this only if extraction is weak.

If Nova Act cannot reliably read a visible section:
	1.	Capture screenshot
	2.	Send screenshot to a multimodal model
	3.	Ask it to extract:
	•	visible profile facts
	•	repo cards
	•	public badges / activity blocks

Use this as a fallback, not the main path.

⸻

Stage 5 — Final API endpoint

Expose one backend endpoint like:

POST /api/aihire/social-screen

Input:
```json
{
  "candidateId": "cand_001",
  "name": "Nguyen Phan Nguyen",
  "linkedinUrl": "https://www.linkedin.com/in/nguyenpn1/",
  "githubUrl": "https://github.com/ngstephen1"
}
```

Output:
```json
{
  "ok": true,
  "result": {
    "candidateId": "cand_001",
    "socialScore": 87,
    "counts": {
      "verified": 13,
      "warnings": 1,
      "critical": 0,
      "info": 4
    },
    "findings": [],
    "recommendation": "Proceed to interview with high confidence.",
    "rawCapture": {},
    "metrics": {}
  }
}
```

Best division of labor
	•	Nova Act = browser automation + raw collection
	•	Bedrock = reasoning + scoring + explanation
	•	Optional multimodal = screenshot fallback
	•	Your app = stable schema + endpoint + UI rendering

That is the most production-like design.


For exact links, start here first

Use these as the first MVP inputs:
	•	LinkedIn: https://www.linkedin.com/in/nguyenpn1/
	•	GitHub: https://github.com/ngstephen1

And define the MVP extraction targets:

LinkedIn MVP
	•	headline
	•	current role
	•	past 2–3 roles
	•	skills
	•	education
	•	location

GitHub MVP
	•	username
	•	followers/following
	•	contributions last year
	•	pinned repos
	•	primary repo languages
	•	stars on pinned repos

Web MVP
	•	3–5 search results only
	•	hackathon / talks / publications
	•	negative-press check

⸻

Recommended implementation order
	1.	Nova Act LinkedIn capture
	2.	Nova Act GitHub capture
	3.	Nova Act web search capture
	4.	Merge into raw JSON
	5.	Bedrock summarizer for findings
	6.	Social score + recommendation
	7.	Backend endpoint
	8.	Frontend Live Findings panel

⸻

What we should build first this week

First deliverable:
	•	socialScreen.ts agent contract
	•	socialScreen prompt
	•	socialScreen parser
	•	socialScreen schema
	•	Nova Act raw capture JSON mock
	•	local script that feeds mocked raw capture into Bedrock

Why: you can test reasoning before the browser automation is fully perfect.

⸻

Concrete architecture

Pipeline
	1.	Nova Act captures raw social data
	2.	Store raw capture JSON
	3.	Bedrock generates structured findings
	4.	Schema validates findings
	5.	Endpoint returns UI-ready report

That gives you:
	•	speed from automation
	•	quality from reasoning
	•	reliability from validation

⸻

Next step right now

Start with Stage 1A: GitHub first, because it is easier than LinkedIn.

Why:
	•	public page
	•	easier DOM
	•	less login friction
	•	strong structured signals

Then do LinkedIn second.
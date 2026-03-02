### Social Screen Batch API plan

We should implement batch social screening as an async job flow.

#### Routes
- `POST /api/aihire/social-screen/batch`
- `GET /api/aihire/social-screen/batch/:batchJobId`
- `GET /api/aihire/social-screen/batch/:batchJobId/results`
- optional: `POST /api/aihire/social-screen/batch/:batchJobId/retry`

#### Flow
1. Receive candidate list
2. Start batch job
3. Run social capture per candidate
4. Map capture output into `SocialScreenServiceInput`
5. Run `runSocialScreenService(...)` per candidate
6. Store recruiter-ready results
7. Frontend polls status endpoint until complete

#### Why async
Workflow capture can take minutes, so the API should return a `batchJobId` immediately instead of blocking.

#### Per-candidate tracked fields
- `candidateId`
- `name`
- `captureStatus`
- `screenStatus`
- `workflowRunId`
- `timedOut`
- `captureRaw`
- `screenResult`
- `error`


```curl
curl -X POST http://localhost:3000/api/aihire/social-screen/batch \
  -H "Content-Type: application/json" \
  -d '{
    "useBedrock": false,
    "candidates": [
      {
        "candidateId": "cand_001",
        "name": "Nguyen Phan Nguyen",
        "roleTitle": "Software Engineer New Grad",
        "resumeText": "Built React apps and AI systems...",
        "linkedin": "https://www.linkedin.com/in/nguyenpn1/",
        "github": "https://github.com/ngstephen1",
        "webQueries": [
          "Nguyen Phan Nguyen Virginia Tech",
          "Nguyen Phan Nguyen Software Engineer"
        ]
      },
      {
        "candidateId": "cand_002",
        "name": "Lam Anh Truong",
        "roleTitle": "Software Engineer",
        "resumeText": "Full-stack developer with cloud experience...",
        "linkedin": "https://www.linkedin.com/in/lamanhtruong",
        "github": "https://github.com/lamanhtruong",
        "webQueries": [
          "Lam Anh Truong software engineer",
          "lamanhtruong.com"
        ]
      }
    ]
  }'
```

```bash
Example frontend polling flow
	1.	POST /api/aihire/social-screen/batch
	2.	get batchJobId
	3.	poll every 2–5 seconds:
	•	GET /api/aihire/social-screen/batch/:batchJobId
	4.	when status is completed or failed, call:
	•	GET /api/aihire/social-screen/batch/:batchJobId/results
```
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
- [x] Social screen endpoint (Stephen - 60%)
  LinkedIn, GitHub, Google summary + risk flags. Endpoint ready will be in  agents/End-Point-BRock-Stalker-AI.md

- [ ] Resume tailor endpoint  
  Candidate uploads resume + target role, returns tailored bullets.

- [ ] Candidate plan endpoint  
  Step-by-step action plan for applying, referrals, follow-up.

- [ ] Recruiter follow-up generator  
  Drafts next-step email after screening.

- [ ] Unified ranking endpoint  
  Combine triage + verify + bedrock screen into one recruiter score.

- [x] Nova Act for candidate GitHub + LinkedIn (in progress- Stephen- 45%)
  Use Nova Act to help gather and verify candidate-side profile signals. ?! how to bypass sign-in page auth wall security linkedin
  Generalize router so it scan any kind of website portfolio e.g. lamanhtruong.com ; https://trangcaoportfolio.framer.website/
  to improve router, Cmd+A function to process prompt first, combine with screenshot where needed
  endpoint ready will be in agents/End-Point-BRock-Stalker-AI.md

- [ ] Combine Bedrock + Nova Act  
  Improve speed, automation, and decision accuracy by pairing reasoning with actions.
  
- [ ] Investigate OpenClaw integration possibility

- [ ] Reinforcement learning pipeline + reward function  
  Adapt scoring and recommendations based on recruiter feedback signals such as positive and negative outcomes.

- [ ] Chatbot for Recruiter side

- [ ] Chatbot for Candidate side

- [ ] Use SerpAPI for AI stalker search/Chatbot Search/.....

- [ ] Text Embedding model AWS

- [ ] Implement MCP (Model Context Protocol) Server ideas

- [ ] Use Nova Act Agent to automate our own web app ./ last priority

---
backup notes:
---
Nova Act endpoints are not verified

At the time of this handoff: • there are no dedicated API route files explicitly for Nova Act • the verified system is the Social Screen Batch API • the batch runner currently uses mock heuristic logic, not a real Nova Act integration endpoint

So teammates should not label Nova Act endpoints as completed unless separate Nova Act route/service work is added and tested.
---

Replace the mock scorer with the real AI scoring service

The clean next milestone is: 1. Keep the batch DB flow exactly as-is 2. Keep the existing endpoints exactly as-is 3. Replace the mock scoring section inside: • apps/web-client/src/lib/aihire/runSocialScreenBatchJob.ts 4. Call the real recruiter/social-screen AI service instead
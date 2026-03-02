# AI Hire AI - Amazon Nova AI 1-month Hackathon - amazon-nova.devpost.com

AI Hire AI is a dual-sided multi-agent app that automates BOTH candidate applications and recruiter workflows in a busy world.

We envision the 2nd Earth where AI comes to HIRE another AI. So please stay tuned!

<p align="center">
  <img src="https://img.shields.io/badge/Amazon%20Nova-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Bedrock-0A66C2?style=for-the-badge&logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Nova%20Act-7B61FF?style=for-the-badge&logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenClaw-111827?style=for-the-badge&logo=opensourceinitiative&logoColor=white" />
  <img src="https://img.shields.io/badge/SerpAPI-2E90FA?style=for-the-badge&logo=googlechrome&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TSX-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/tRPC-2596BE?style=for-the-badge&logo=trpc&logoColor=white" />
  <img src="https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white" />
  <img src="https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Drizzle-1E1E1E?style=for-the-badge&logo=drizzle&logoColor=C5F74F" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white" />
  <img src="https://img.shields.io/badge/Drizzle%20ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=111111" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" />
  <img src="https://img.shields.io/badge/cURL-073551?style=for-the-badge&logo=curl&logoColor=white" />
  <img src="https://img.shields.io/badge/REST%20API-4B5563?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Agentic%20Workflows-7C3AED?style=for-the-badge&logo=buffer&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Google%20Gemini-8E75FF?style=for-the-badge&logo=googlegemini&logoColor=white" />
  <img src="https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white" />
  <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" />
  <img src="https://img.shields.io/badge/MIT%20License-2B6CB0?style=for-the-badge&logo=opensourceinitiative&logoColor=white" />
</p>

---

- **Candidate-side AI**
  - application planning
  - resume tailoring
  - job search workflow support
  - follow-up guidance

- **Recruiter-side AI**
  - candidate triage
  - verification and risk checks
  - micro-screening
  - social screening
  - recruiter-ready summaries and ATS-style handoff

---

Hiring is getting faster, noisier, and more automated.

AI Hire AI explores a future where:
- candidates use AI to apply smarter,
- recruiters use AI to screen faster,
- and eventually, **AI agents interact with other AI agents** in the hiring loop.

---


## Stack

- **Web Client**: Next.js 16 + TypeScript + tRPC + Hono + Drizzle ORM + Clerk Auth + Tailwind CSS v4 + shadcn/ui
- **LLM Service**: Express + TypeScript + Amazon Nova Lite (Bedrock) + Google Gemini (fallback) + Redis
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Theme Engine**: 20+ presets, live editor, Zustand store, View Transitions API

## Project Structure

```
cafair/
├── apps/
│   ├── web-client/          # Next.js frontend + API layer
│   └── llm/                 # Express LLM prompt microservice
├── supabase/
│   ├── config.toml          # Supabase configuration
│   └── migrations/          # SQL migrations (Drizzle Kit)
├── ARCHITECTURE.md          # System architecture diagrams
├── SYSTEM_DESIGN.md         # Developer guide
└── package.json             # npm workspaces root
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for Supabase local dev & LLM Redis)
- npm

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
# Web client
cp apps/web-client/.env.example apps/web-client/.env

# LLM service
cp apps/llm/.env.example apps/llm/.env
```

Required keys:

- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` (for Nova scoring)

### 3. Start Supabase (Local)

```bash
npm run supa:start
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start Development Servers

```bash
# Web client (Next.js :3000)
npm run dev:web

# LLM service (Express :3001)
npm run dev:llm
```

## Available Scripts

| Script        | Description                     |
| ------------- | ------------------------------- |
| `dev:web`     | Start web client dev server     |
| `build:web`   | Build web client for production |
| `dev:llm`     | Start LLM service dev server    |
| `build:llm`   | Build LLM service               |
| `db:generate` | Generate Drizzle migrations     |
| `db:migrate`  | Run database migrations         |
| `db:push`     | Push schema changes (dev only)  |
| `db:studio`   | Open Drizzle Studio             |
| `db:seed`     | Seed database with sample data  |
| `db:reset`    | Delete all data and re-seed     |
| `supa:start`  | Start local Supabase            |
| `supa:stop`   | Stop local Supabase             |

## Documentation

| Doc                             | What it covers                               |
| ------------------------------- | -------------------------------------------- |
| `ARCHITECTURE.md`               | System diagrams, data flows, port map        |
| `SYSTEM_DESIGN.md`              | Developer guide — adding services & APIs     |
| `THEME-DEFINITION.md`           | Theme design contract for designers          |
| `apps/llm/README.md`            | LLM service API, Nova + Gemini, Docker setup |
| `src/docs/BACKEND_API_GUIDE.md` | Recruiter tRPC procedures, Nova scoring flow |
| `src/docs/TRPC_USAGE_GUIDE.md`  | tRPC + TanStack Query patterns               |
| `src/docs/MOBILE_CLIENT.md`     | Hono REST API for mobile clients             |
| `src/docs/THEME_DEFINITIONS.md` | CSS variable → Tailwind class reference      |
| `src/services/theme/README.md`  | Theme engine setup & customization           |

## Auth Flow

1. User signs in via **Clerk**
2. Clerk JWT is injected into Supabase via `secure-client.ts`
3. **RLS policies** enforce per-user data isolation using `auth.user_id()`

## Adding New Features

See `SYSTEM_DESIGN.md` for step-by-step instructions covering:

- Creating a new service module
- Defining Drizzle schemas
- Adding tRPC procedures
- Adding Hono REST endpoints
- Running migrations

## License

MIT

# CaFair — Web Client

> Next.js 16 frontend + API layer for the CaFair platform.

## Tech Stack

| Layer             | Technology                                  |
| ----------------- | ------------------------------------------- |
| **Framework**     | Next.js 16 (App Router) + React 19          |
| **Type-safe API** | tRPC 11 + TanStack Query                    |
| **REST API**      | Hono (for mobile / external clients)        |
| **ORM**           | Drizzle ORM 0.45                            |
| **Auth**          | Clerk (web cookies + mobile Bearer JWT)     |
| **Database**      | Supabase PostgreSQL with Row Level Security |
| **Styles**        | Tailwind CSS v4 + shadcn/ui                 |
| **State**         | Zustand (theme engine, editor)              |
| **Validation**    | Zod                                         |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local Supabase & Redis)
- npm (monorepo workspaces)

### Installation

```bash
# From the monorepo root
npm install

# Set up environment variables
cp apps/web-client/.env.example apps/web-client/.env
```

Required `.env` keys:

| Variable                            | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`                      | Supabase Postgres connection string               |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth                               |
| `CLERK_SECRET_KEY`                  | Clerk server auth                                 |
| `SUPABASE_URL`                      | Supabase project URL                              |
| `SUPABASE_ANON_KEY`                 | Supabase anonymous key                            |
| `SUPABASE_SERVICE_ROLE_KEY`         | Supabase admin key (server only)                  |
| `LLM_URL`                           | LLM service URL (default `http://localhost:3001`) |

### Run

```bash
# Start local Supabase
npm run supa:start

# Run migrations
npm run db:migrate

# Start dev server (:3000)
npm run dev:web
```

## Project Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── (auth)/              # Sign-in / sign-up
│   ├── (dashboard)/         # Authenticated pages
│   │   ├── dashboard/       # Main dashboard
│   │   ├── recruiter/       # Recruiter pipeline, pre-fair, settings
│   │   ├── dev/             # Developer tools
│   │   └── theme-editor/    # Live theme editor
│   └── api/                 # API route handlers (tRPC + Hono)
├── components/              # Shared UI (navbar, sidebar, topbar, ui/)
├── db/                      # Drizzle client, schema barrel, seed, reset
├── docs/                    # Internal documentation
│   ├── BACKEND_API_GUIDE.md # Recruiter API reference for frontend devs
│   ├── TRPC_USAGE_GUIDE.md  # tRPC + TanStack Query patterns
│   ├── MOBILE_CLIENT.md     # Hono REST API for mobile clients
│   └── THEME_DEFINITIONS.md # CSS variable → Tailwind class reference
├── lib/                     # Utilities (color-converter, supabase, utils)
├── server/                  # tRPC init, Hono app, middleware
├── services/                # Feature modules
│   ├── recruiter/           # Candidate pipeline, scoring, actions
│   ├── users/               # User CRUD
│   ├── examples/            # Reference/example items
│   ├── uploads/             # File uploads (Supabase Storage)
│   └── theme/               # 20+ presets, live editor, Zustand store
├── styles/                  # globals.css (Tailwind v4 + theme variables)
├── trpc/                    # tRPC client + server helpers
└── types/                   # Shared TypeScript types
```

## Services

Each service follows a consistent pattern:

```
services/<name>/
├── schema/          # Drizzle table definitions
├── procedures/      # tRPC router (one file per procedure or grouped)
└── index.ts         # Barrel export
```

| Service       | Description                                                         |
| ------------- | ------------------------------------------------------------------- |
| **recruiter** | Candidate pipeline management, AI scoring, follow-ups, actions      |
| **users**     | User profiles synced from Clerk                                     |
| **examples**  | Reference CRUD (for learning the pattern)                           |
| **uploads**   | File uploads via Supabase Storage                                   |
| **theme**     | 20+ presets, live editor, View Transitions API, Zustand persistence |

## Available Scripts

| Script                | Description                        |
| --------------------- | ---------------------------------- |
| `npm run dev:web`     | Start dev server (:3000)           |
| `npm run build:web`   | Production build                   |
| `npm run db:generate` | Generate Drizzle migration SQL     |
| `npm run db:migrate`  | Apply migrations to Supabase       |
| `npm run db:push`     | Push schema changes (dev shortcut) |
| `npm run db:seed`     | Seed database with sample data     |
| `npm run db:reset`    | Delete all data + re-seed          |
| `npm run db:studio`   | Open Drizzle Studio                |
| `npm run supa:start`  | Start local Supabase               |
| `npm run supa:stop`   | Stop local Supabase                |

## Documentation

| Doc                                                   | Purpose                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| [BACKEND_API_GUIDE.md](src/docs/BACKEND_API_GUIDE.md) | Recruiter API reference (procedures, usage examples, Nova scoring flow) |
| [TRPC_USAGE_GUIDE.md](src/docs/TRPC_USAGE_GUIDE.md)   | tRPC + TanStack Query patterns (queries, mutations, SSR prefetch)       |
| [MOBILE_CLIENT.md](src/docs/MOBILE_CLIENT.md)         | Hono REST API endpoints for mobile / external clients                   |
| [THEME_DEFINITIONS.md](src/docs/THEME_DEFINITIONS.md) | CSS variable → Tailwind class mapping reference                         |
| [Theme README](src/services/theme/README.md)          | Theme engine architecture, presets, editor, color utils                 |

## License

MIT

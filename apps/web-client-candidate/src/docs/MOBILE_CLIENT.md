# REST API Guide (Hono)

> How to consume the Hono REST API from mobile or external clients.

---

## Overview

The Hono REST API is available at `/api/v1/*` (primary) and `/api/mobile/*`
(compatibility alias) and provides standard JSON endpoints for non-TypeScript
clients (iOS, Android, 3rd-party services).

```
Mobile / External Client
       │
       │  Authorization: Bearer <clerk-session-jwt>
       │  OR x-api-key: <api-key>
       │
       ▼
  /api/v1/*  →  Hono Router  →  Drizzle ORM  →  Supabase (RLS)
```

All endpoints share the same database layer and RLS policies as tRPC.

---

## Authentication

Every request must include a valid Clerk session token:

```
Authorization: Bearer <clerk_session_jwt>
```

For service integrations, API key authentication is also supported via:

```
x-api-key: <api-key>
```

Obtain this token via Clerk SDKs:

- **React Native / Expo**: `@clerk/expo` → `useAuth().getToken()`
- **Swift**: `@clerk/clerk-ios` → `Clerk.shared.session?.getToken()`
- **Kotlin**: `@clerk/clerk-android` → `clerkClient.session.getToken()`

---

## Base URL

```
https://<your-domain>/api/v1
```

Local development: `http://localhost:3000/api/v1`

Compatibility alias: `http://localhost:3000/api/mobile`

---

## Available Endpoints

### Users

| Method | Path      | Description      |
| ------ | --------- | ---------------- |
| GET    | /users/me | Get current user |
| PATCH  | /users/me | Update profile   |

### Uploads

| Method | Path           | Description     |
| ------ | -------------- | --------------- |
| POST   | /uploads/file  | Upload a file   |
| GET    | /uploads/files | List user files |
| DELETE | /uploads/files | Delete files    |

### Examples

| Method | Path      | Description         |
| ------ | --------- | ------------------- |
| GET    | /examples | List example items  |
| POST   | /examples | Create example item |

### Health

| Method | Path    | Description  |
| ------ | ------- | ------------ |
| GET    | /health | Health check |

---

## Response Format

All endpoints return:

```json
// Success
{ "data": { ... } }

// Error
{ "error": "Error message" }
```

No superjson — all responses are plain JSON.

---

## Error Codes

| Status | Meaning               |
| ------ | --------------------- |
| 200    | Success               |
| 400    | Bad request           |
| 401    | Unauthorized          |
| 403    | Forbidden (RLS)       |
| 404    | Not found             |
| 500    | Internal server error |

---

## Adding New REST Endpoints

1. Create `src/server/hono/routes/your-feature.ts`
2. Mount in `src/server/hono/app.ts`
3. See `SYSTEM_DESIGN.md` section 5 for a full example

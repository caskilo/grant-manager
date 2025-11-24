# Odyssean Grant Manager – Backend

NestJS + Fastify API for the Odyssean grant management tool. Provides authentication, funder & opportunity management, scoring, eligibility, ingestion, templates, and CRM endpoints.

## Stack

- Node.js 22
- NestJS 10 (Fastify adapter)
- Prisma ORM + PostgreSQL (with pgvector)
- Redis + BullMQ (queues for scoring, import, harvest)
- MinIO / S3-compatible storage (planned for attachments)
- JWT authentication

## High-level Architecture

- `prisma/schema.prisma` – 18 models covering users, funders, opportunities, applications, tasks, reviews, templates, contacts, interactions, attachments, budgets, embeddings, config, and audit/logging tables.
- `prisma/seed.ts` – seeds default users and templates plus config rows.
- `src/app.module.ts` – root module wiring together domain modules.
- `src/main.ts`
  - Fastify adapter with Helmet, CORS, cookies, multipart.
  - Global validation pipe and `/api` global prefix.
- Domain modules (each with controller + service):
  - `auth/` – login/logout, JWT strategy, guards, `GET /api/auth/me`.
  - `user/` – admin-only user management.
  - `funder/` – CRUD for funders and related entities.
  - `opportunity/` – CRUD + fit scoring & eligibility endpoints.
  - `contact/`, `interaction/` – CRM-style notes and contacts.
  - `template/` – text templates and usage tracking.
  - `import/`, `harvest/` – CSV ingestion & web scraping jobs.
  - `audit/` – audit logging and querying.
  - `queue/` – BullMQ queue configuration (Redis).
  - `health/` – health check endpoint.

## Local Development

### Prerequisites

- Node.js 22
- pnpm (recommended; see root workspace)
- Docker Desktop (for Postgres + Redis + MinIO via `docker-compose.yml` in repo root)

### Getting Started

From the **repo root**:

1. Start infrastructure services:

   ```bash
   docker compose up -d
   ```

2. Configure environment:

   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with values for DATABASE_URL, REDIS_URL, MINIO_*, JWT_SECRET, FRONTEND_URLS, etc.
   ```

3. Install dependencies and generate Prisma client:

   ```bash
   pnpm install
   pnpm prisma:generate
   ```

4. Apply migrations and seed local DB:

   ```bash
   pnpm prisma:migrate
   pnpm prisma:seed
   ```

5. Run the API in watch mode:

   ```bash
   pnpm start:dev
   ```

The API will listen on `http://localhost:3000/api` by default (configurable via `PORT` / config service).

## Deployment (Heroku)

- App name: `grant-manager-backend-f4064f970ae1`.
- Deployed via `git subtree` from monorepo root:

  ```bash
  git subtree push --prefix backend heroku main
  ```

### Build & Release Pipeline

- `package.json`:
  - `build`: `npm run prisma:generate && nest build`
  - `heroku-postbuild`: `npm run build`
- `Procfile`:
  - `web: node dist/src/main`
  - `release: npm run prisma:generate && npx prisma migrate deploy && npx prisma db seed`

On each deploy Heroku will:

1. Install Node 22 + pnpm.
2. Install dependencies.
3. Build the NestJS app.
4. Run Prisma generate, apply migrations, and seed the database.

### Required Heroku Config Vars

At minimum:

- `DATABASE_URL` – Postgres connection string (Heroku Postgres).
- `REDIS_URL` – Redis connection string (Heroku Redis).
- `JWT_SECRET` – symmetric key for JWT signing.
- `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` – optional token lifetimes.
- `FRONTEND_URLS` – comma-separated list of allowed CORS origins, e.g.
  - `https://caskilo.github.io/grant-manager,https://caskilo.github.io`

## CORS & Authentication

- CORS is configured in `src/main.ts` using Fastify CORS with an origin callback that whitelists `FRONTEND_URLS` and allows credentials.
- `POST /api/auth/login`:
  - Accepts `{ email, password }`.
  - Returns `{ user, accessToken, refreshToken }`.
- JWT validation:
  - `Authorization: Bearer <accessToken>` via `JwtStrategy`.
- Passwords:
  - Stored as bcrypt hashes (seeded via `prisma/seed.ts`).
  - Validated with `bcrypt.compare` in `AuthService.validateUser`.

## Key Endpoints (Selection)

- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Users: CRUD endpoints under `/api/users` (admin-only).
- Funders: `/api/funders`, `/api/funders/:id`.
- Opportunities: `/api/opportunities`, `/api/opportunities/:id`, scoring & eligibility helpers.
- Templates, contacts, interactions, import, harvest, health, and audit under `/api/*`.

See `docs/PROGRESS.md` and the Prisma schema for full domain coverage and upcoming work (exports, dashboards, attachments, tests).

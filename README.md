# Odyssean Grant Manager – Frontend

React + TypeScript single-page app for the Odyssean grant management tool. Provides UI for authentication, dashboards, funders, opportunities, applications, templates, contacts, interactions, imports, and admin.

## Stack

- React 18 + TypeScript
- Vite 5
- Mantine UI (core, notifications, dates)
- React Router v6
- React Query (@tanstack/react-query)
- Zustand (auth store with persistence)
- Axios (API client)

## High-level Architecture

- `src/main.tsx` – React entry; wraps app in Mantine + React Query providers.
- `src/App.tsx` – top-level router and layout:
  - Uses `BrowserRouter` with `basename={import.meta.env.BASE_URL}` to support GitHub Pages subdirectory deployment.
  - `ProtectedRoute` wrapper for authenticated sections.
  - Routes wired for login, dashboard, funders, opportunities, applications, templates, contacts, interactions, import, admin.
- `src/lib/api.ts` – configured Axios instance:
  - `baseURL = import.meta.env.VITE_API_URL || '/api'`.
  - Attaches `Authorization: Bearer <token>` from `localStorage`.
  - On `401`:
    - Clears tokens from `localStorage`.
    - Redirects to `${import.meta.env.BASE_URL}login`.
- `src/stores/authStore.ts` – Zustand store for `user` + `accessToken`:
  - Persists to `localStorage` via `zustand/middleware`.
- `src/components/layout/` – `AppHeader`, `AppNavbar`.
- `src/pages/` – feature pages (login, dashboard, funders, opportunities, applications, templates, contacts, interactions, import, admin). Several detail pages are currently stubs but wired.

## Local Development

### Prerequisites

- Node.js 22
- pnpm
- Backend API running locally (see `/backend` README), typically on `http://localhost:3000/api`.

### Getting Started

1. Configure environment:

   ```bash
   cd frontend
   cp .env.example .env
   # For local dev, point to the local backend:
   # VITE_API_URL=http://localhost:3000/api
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the dev server:

   ```bash
   pnpm dev
   ```

4. Open `http://localhost:5173` in your browser.

During local development, `vite.config.ts` proxies `/api` to `http://localhost:3000`, so you can also leave `VITE_API_URL` unset and rely on the dev proxy.

## Build

```bash
pnpm build
```

- Output goes to `dist/` and is a static SPA suitable for GitHub Pages or other static hosting.

## Deployment (GitHub Pages)

- The frontend is deployed from this sub-project to GitHub Pages at:
  - `https://caskilo.github.io/grant-manager`
- Vite is configured with a non-root base path in `vite.config.ts`:
  - `base: '/grant-manager/'`
- Environment configuration for production is done via `.env.production`:

  ```bash
  VITE_API_URL=https://grant-manager-backend-f4064f970ae1.herokuapp.com/api
  ```

### GitHub Actions Workflow

- Workflow file: `frontend/.github/workflows/deploy.yml`.
- On push to `main`:
  - Checks out the repo.
  - Installs `pnpm` and Node 22.
  - Runs `pnpm install` and `pnpm run build`.
  - Uploads `./dist` as a Pages artifact.
  - Deploys to GitHub Pages using `actions/deploy-pages`.

## SPA Routing on GitHub Pages

Because GitHub Pages is static, non-root routes (e.g. `/grant-manager/opportunities/123`) would normally 404. This repo uses a standard SPA fallback pattern:

- `public/404.html` stores the original path in `sessionStorage.redirect` and redirects to `/grant-manager/`.
- `index.html` has a small script that, on load, checks `sessionStorage.redirect` and `history.replaceState` back to the intended route.
- `BrowserRouter` is configured with `basename={import.meta.env.BASE_URL}` so that all internal routing respects the `/grant-manager/` subdirectory.

## Authentication Flow

1. User visits `https://caskilo.github.io/grant-manager/`.
2. If `useAuthStore().user` is null, `App` renders the login routes only.
3. On successful login:
   - Frontend calls `POST /api/auth/login` on the Heroku backend.
   - Stores `accessToken` and `refreshToken` in `localStorage`.
   - Stores the user object in the Zustand store.
   - Navigates to `/dashboard`.
4. On `401` responses:
   - Axios interceptor clears tokens.
   - Redirects to `${BASE_URL}login`.

## Current Status & Next UI Work

- Login and basic navigation are working against the production backend.
- List pages render but some datasets are empty in production (funders/opportunities depend on ingest flows).
- Several detail pages (`FunderDetailPage`, `OpportunityDetailPage`, `ApplicationDetailPage`) are currently stubs.

Next UI-focused steps (see also `docs/PROGRESS.md`):

1. Surface fit scores and eligibility on opportunity list/detail views.
2. Flesh out detail pages for funders, opportunities, and applications using existing APIs.
3. Add views for scoring/eligibility config, harvest sources, and exports (Sprint 4 work).
4. Add better loading states, error boundaries, and tests.

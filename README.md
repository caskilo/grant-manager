# Odyssean Grant Manager — Frontend

The web interface for the Odyssean Institute's grant management system.

The Institute uses this tool to discover, assess, and progress funding
opportunities across its programmes — the Odyssean Process, GRAIN, and
Aeonic Flourishing. The frontend provides the working environment for the
grants team:

- **Dashboard** — pipeline overview, funding coverage, and recent activity
- **Funders & Catalogue** — the curated funder catalogue, harvest sources,
  and discovery runs that surface new opportunities
- **Opportunities** — discovered and manually entered grants, with
  LLM-assisted alignment scoring ("Programme Match") and eligibility
  assessment against the Institute's criteria
- **Applications** — drafted proposals generated from opportunities and
  modular templates, tracked through stages
- **Contacts & Interactions** — relationship management with funders
- **Administration** — user management and organisation settings, including
  branding, programme priorities, and eligibility context, all configurable
  without code changes

## Technology

- React 18 + TypeScript, built with Vite
- Mantine UI, React Router, TanStack Query, Zustand, Axios

## Architecture

- Single-page application with route-level authentication guards; API calls
  use bearer tokens with silent refresh and graceful session-expiry
  handling.
- Organisation branding and settings are fetched from the backend and drive
  the theme, logo, and programme vocabulary at runtime.
- Data caching is managed by TanStack Query; mutations invalidate the
  affected views automatically.


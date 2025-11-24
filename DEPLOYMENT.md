# Frontend Deployment Guide

## GitHub Pages Deployment

This frontend is deployed to GitHub Pages at: **https://caskilo.github.io/grant-manager**

### Prerequisites

- Node.js 18+ and npm installed
- `gh-pages` package installed as dev dependency (already in `package.json`)
- GitHub repository configured with `origin` remote

### Setup (One-time)

1. Ensure the GitHub repository is configured:
   ```bash
   git remote add origin https://github.com/caskilo/grant-manager.git
   ```

2. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

### Deployment Steps

1. **Build the frontend:**
   ```bash
   npm run build
   ```
   This creates an optimized production build in `dist/` with the correct base path (`/grant-manager/`).

2. **Deploy to GitHub Pages:**
   ```bash
   npm run deploy
   ```
   This command:
   - Builds the frontend
   - Pushes the `dist/` contents to the `gh-pages` branch on GitHub
   - GitHub automatically serves the `gh-pages` branch at `https://caskilo.github.io/grant-manager`

3. **Verify deployment:**
   - Visit https://caskilo.github.io/grant-manager
   - Check that the app loads and can communicate with the backend API at `https://grant-manager-backend-f4064f970ae1.herokuapp.com/api`

### Configuration

- **Base path:** Set in `vite.config.ts` as `base: '/grant-manager/'` to match the GitHub Pages URL structure
- **API URL:** Set in `.env.production` as `VITE_API_URL=https://grant-manager-backend-f4064f970ae1.herokuapp.com/api`
- **Build output:** `dist/` directory (excluded from git via `.gitignore`)

### Troubleshooting

- **App loads but routes don't work:** Ensure `base: '/grant-manager/'` is set in `vite.config.ts`
- **API calls fail:** Verify `VITE_API_URL` in `.env.production` points to the correct backend URL
- **Deploy command fails:** Ensure you have push access to the GitHub repository and the `origin` remote is configured

### Local Development

For local development with the backend running on `http://localhost:3000`:
```bash
npm run dev
```

The dev server proxies `/api` requests to `http://localhost:3000` (configured in `vite.config.ts`).

# Hypertrophy Coach
Local-first hypertrophy training and nutrition PWA (React, TypeScript, Vite, Dexie).

    npm install
    npm run dev      # develop
    npm test         # core logic tests (Node 22+, no extra deps)
    npm run build    # type-check + production build

## Deploy to GitHub Pages
Push to `main` on GitHub, then set Settings > Pages > Source: "GitHub Actions".
`.github/workflows/deploy.yml` builds with the correct base path. Hash routing means deep links work on Pages.

## Layout
- `src/core`: pure TypeScript business logic (no React, no Dexie)
- `src/db`: Dexie schema and seeding
- `src/features`: one folder per section
- `src/ui`: theme and shared styles

## Backups
Settings > Data exports everything as versioned JSON and imports it with a preview and an explicit replace/merge choice.

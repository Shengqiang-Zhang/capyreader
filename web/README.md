# Capy Reader — Web

A browser companion to the Capy Reader Android app. Both clients point at the same self-hosted [Miniflux](https://miniflux.app/) instance, so read/unread and star state sync automatically.

New here? See [`docs/miniflux-heroku.md`](docs/miniflux-heroku.md) for a
free, fully-managed way to deploy Miniflux using the GitHub Student
Developer Pack.

## Development

```sh
pnpm install
pnpm dev
```

The app expects a reachable Miniflux instance with CORS enabled for this origin. On first load you enter the server URL and an API token (Miniflux Settings → API Keys).

## Miniflux configuration

Set these environment variables on the Miniflux server so the browser can reach it:

```
CORS_ALLOWED_ORIGINS=https://<this-web-app-origin>,http://localhost:5173
```

(Comma-separated. Include localhost during development.)

## Scripts

| Command            | What it does                              |
| ------------------ | ----------------------------------------- |
| `pnpm dev`         | Vite dev server with HMR                  |
| `pnpm build`       | Production build into `dist/`             |
| `pnpm preview`     | Serve `dist/` locally                     |
| `pnpm typecheck`   | `tsc --noEmit` for the whole project      |
| `pnpm lint`        | ESLint                                    |
| `pnpm test`        | Vitest (jsdom)                            |

## Environment variables

| Name                         | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `VITE_DEFAULT_MINIFLUX_URL`  | Pre-fills the server URL on the login screen.         |

## Deployment

The GitHub workflow at `.github/workflows/web-deploy.yml` builds this
package and publishes to Azure Static Web Apps on every push to `main`
that touches `web/**`. Pull requests get an isolated preview URL.

Required secrets / vars:

| Kind   | Name                                  | Purpose                                       |
| ------ | ------------------------------------- | --------------------------------------------- |
| secret | `AZURE_STATIC_WEB_APPS_API_TOKEN`     | Deployment token from the Static Web App resource. |
| var    | `VITE_DEFAULT_MINIFLUX_URL` (optional)| Pre-fills login form with your Miniflux URL.  |

`web/public/staticwebapp.config.json` sets the SPA fallback (so deep
links like `/?feed=5` resolve to `index.html`) and long-lived caching
for hashed `/assets/*` and the fonts folder.

## Keyboard shortcuts

| Keys        | Action                     |
| ----------- | -------------------------- |
| `j` / `k`   | Next / previous article    |
| `m`         | Toggle read                |
| `s`         | Toggle star                |
| `o`         | Open original in new tab   |
| `u`         | Back to the article list   |
| `g i`       | Go to Inbox                |
| `g s`       | Go to Starred              |
| `g u` / `g a` | Filter unread / all      |
| `/`         | Focus search               |
| `?`         | Show shortcut help         |

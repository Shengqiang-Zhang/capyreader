# Capy Reader — Web

A browser companion to the Capy Reader Android app. Both clients point at the same self-hosted [Miniflux](https://miniflux.app/) instance, so read/unread and star state sync automatically.

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

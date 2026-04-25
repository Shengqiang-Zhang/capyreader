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

### Image proxy (required for hotlink-protected feeds)

Many article CDNs reject cross-origin browser requests:

- `img.ithome.com` returns 403 unless the `Referer` is `*.ithome.com`.
- `i.qbitai.com` (Tencent COS) returns 403 with an XML body, which Chrome
  then blocks with `net::ERR_BLOCKED_BY_ORB`.

The browser cannot satisfy these checks, so the only way to render those
images is to fetch them server-side. Enable Miniflux's built-in media proxy:

```
MEDIA_PROXY_MODE=all
MEDIA_PROXY_HTTP_CLIENT_TIMEOUT=120
MEDIA_PROXY_RESOURCE_TYPES=image,audio,video
```

On older Miniflux releases the option is named `PROXY_OPTION=all`. After
flipping the env vars, restart Miniflux and refresh the affected feed
(Settings → Feeds → Refresh) so cached entries get re-processed with proxy URLs.

This client rewrites the relative `/proxy/{hash}/{encoded}` URLs Miniflux
returns to absolute URLs on your Miniflux origin so the browser can load them.

### Fallback image proxy (optional, for users who cannot host Miniflux's proxy)

If you cannot enable `MEDIA_PROXY_MODE` (e.g. your Miniflux is read-only or
lacks egress to a CDN), set `VITE_IMAGE_FALLBACK_PROXY` at build time. The
companion will retry any `<img>` that errors out by routing it through this
prefix:

```
VITE_IMAGE_FALLBACK_PROXY=https://images.weserv.nl/?url=
```

The original src is appended URL-encoded. Public proxies like
`images.weserv.nl` cover most western CDNs but block several Chinese TLDs by
policy — for those feeds, deploy your own proxy (Cloudflare Workers, Deno
Deploy, an Azure Function) or stick with Miniflux's media proxy.

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

| Name                          | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `VITE_DEFAULT_MINIFLUX_URL`   | Pre-fills the server URL on the login screen.                          |
| `VITE_IMAGE_FALLBACK_PROXY`   | URL prefix used to retry `<img>` loads that 403 or get blocked by ORB. |

## Deployment

The GitHub workflow at `.github/workflows/web-deploy.yml` builds this
package and publishes to Azure Static Web Apps on every push to `main`
that touches `web/**`. Pull requests get an isolated preview URL.

Required secrets / vars:

| Kind   | Name                                       | Purpose                                                  |
| ------ | ------------------------------------------ | -------------------------------------------------------- |
| secret | `AZURE_STATIC_WEB_APPS_API_TOKEN`          | Deployment token from the Static Web App resource.       |
| var    | `VITE_DEFAULT_MINIFLUX_URL` (optional)     | Pre-fills login form with your Miniflux URL.             |
| var    | `VITE_IMAGE_FALLBACK_PROXY` (optional)     | URL prefix used to retry hotlink-blocked image loads.    |

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

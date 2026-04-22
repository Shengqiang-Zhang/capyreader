# Deploying Miniflux on Heroku (Student Pack)

The web client needs a Miniflux server to talk to. With the GitHub
Student Developer Pack you get **$13/mo of Heroku credits for 24
months** — enough to run Miniflux + managed Postgres at $0 out of
pocket.

## Cost breakdown

| Component | Plan | Monthly |
| --- | --- | --- |
| Web dyno | Basic (never-sleeps) | $7 |
| Managed Postgres | heroku-postgresql:essential-0 | $5 |
| **Total** | | **$12** (covered by $13/mo credit) |

> The **Eco** dyno sleeps after 30 min idle and would stall polling.
> Always use **Basic** or higher. Essential-0 caps at 10k rows per
> table — more than enough for a personal Miniflux unless you keep
> very long retention; upgrade to `essential-1` ($9) if you hit the
> cap.

## One-time setup

```sh
# 1. Scaffold an app that deploys as a container
heroku login
heroku create <app-name> --stack container

# 2. Attach managed Postgres. DATABASE_URL is injected automatically.
heroku addons:create heroku-postgresql:essential-0 -a <app-name>

# 3. Pick an admin password and save it somewhere safe
ADMIN_PASSWORD="$(openssl rand -base64 18)"
echo "Admin password: $ADMIN_PASSWORD"

# 4. Configure Miniflux. CORS_ALLOWED_ORIGINS must include the
#    Static Web Apps origin that serves the React client.
heroku config:set -a <app-name> \
  RUN_MIGRATIONS=1 \
  CREATE_ADMIN=1 \
  ADMIN_USERNAME=admin \
  ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  POLLING_FREQUENCY=60 \
  CORS_ALLOWED_ORIGINS="https://<your-static-web-app>.azurestaticapps.net,http://localhost:5173"

# 5. Deploy the upstream Miniflux image (see `heroku.yml` below)
git init miniflux-deploy && cd miniflux-deploy
cat > heroku.yml <<'YAML'
build:
  docker:
    web: Dockerfile
run:
  web: /usr/bin/miniflux -listen-addr=0.0.0.0:$PORT
YAML
cat > Dockerfile <<'DOCKER'
FROM miniflux/miniflux:latest
# Heroku sets $PORT at runtime; Miniflux honors the -listen-addr flag.
DOCKER
git add heroku.yml Dockerfile
git commit -m "Deploy Miniflux"
heroku git:remote -a <app-name>
git push heroku HEAD:main
```

After the first deploy, `heroku open -a <app-name>` lands on the
Miniflux login. Sign in with `admin` + the password you generated and
grab an API token from **Settings → API Keys**. That token is what
you paste into the Capy Reader web login screen.

## Hooking up Capy Reader

| Client | How it connects |
| --- | --- |
| **Web (this repo's `web/`)** | Visit the Azure Static Web App URL, enter `https://<app-name>.herokuapp.com` + API token on the login screen. |
| **Android** | Settings → Add account → Miniflux → enter URL + API token. Run side-by-side with your LOCAL account until you're happy, then remove LOCAL. |

## Importing existing feeds

If you're coming from LOCAL on Android:

1. In the Android app, **Settings → Export OPML** — save the file.
2. In Miniflux, **Feeds → Import** — upload the OPML.
3. Both clients now see the same feeds, and read/star state syncs
   automatically because both talk to the same Miniflux.

## Alternatives

Other hosting options evaluated:

- **Azure Container Apps + Postgres Flexible Server** (~$13/mo; free
  for 12 months on new subscriptions via the PG flexible-server free
  offer). Good if you want everything co-located with your existing
  Azure RSSHub.
- **Azure Container Apps + Supabase free Postgres** (~$0–5/mo).
  Cheapest, but Supabase projects auto-pause after 7 days of DB
  idleness and the free tier has no managed backups — roll your own
  `pg_dump` schedule.
- **DigitalOcean $200 Student Pack credit** on a $6 droplet running
  Miniflux + Postgres via docker-compose (~33 months of runway, but
  credit is one-shot for year one only).

Heroku wins on longest guaranteed runway (24 monthly-replenished
months) with zero database ops.

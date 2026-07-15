# Fly.io Deployment — Beanstalk API

The app is deployed to Fly as `beanstalk-api`, served at
`https://beanstalk-api.fly.dev` (the default base URL the mobile app ships
with). Fly terminates TLS at its edge and forwards plain HTTP to the container
on `internal_port = 8080`, so the app never handles certificates itself.

## How TLS works here

`src/server.js` detects an upstream TLS proxy via `FLY_APP_NAME` (injected into
every Fly machine) or an explicit `BEANSTALK_TLS_TERMINATION=proxy`. When
detected, the Let's Encrypt `https.createServer(...)` branch is skipped — that
branch reads certs from `/etc/letsencrypt/live/...` and only applies to
self-hosted production where we terminate TLS ourselves. On Fly the REST API is
served by `app.listen(app.get('port'))` on 8080 and Fly handles HTTPS.

## Health check

`GET /health` (defined in `src/app.js`) is a dependency-free 200 that does not
touch BigQuery/Firebase. `fly.toml` runs it as an `[[http_service.checks]]`
probe every 15s; a non-200 marks the machine unhealthy and blocks a bad deploy.

## Environment vs. secrets

Non-secret config lives in `fly.toml [env]` (committed):
`BEANSTALK_ENVIRONMENT`, `BEANSTALK_SERVER_PORT`, `BEANSTALK_SERVER_VERSION`,
`BEANSTALK_GCP_BIGQUERY_DATASETID`, `FIREBASE_PROJECT_ID`.

Everything sensitive is set with `fly secrets set` (encrypted, injected at
runtime, never committed). The current `fly.toml` runs `BEANSTALK_ENVIRONMENT=demo`
(in-memory store, auth bypass, mock trade fills, auto-seed on boot), so most
secrets are only required once you switch to `production`.

### Required now (demo mode)

```bash
# AI advisor "Cash" — the only external call demo mode actually makes.
fly secrets set ANTHROPIC_API_KEY=sk-ant-...

# Push notifications (Firebase Admin) — only if you exercise notifications.
fly secrets set \
  FIREBASE_PRIVATE_KEY_ID=... \
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
  FIREBASE_CLIENT_EMAIL=...@....iam.gserviceaccount.com \
  FIREBASE_CLIENT_ID=... \
  FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/...
```

### Additionally required for `production` mode

```bash
# JWT signing secret (auth is bypassed in demo, enforced in production).
fly secrets set JWT_SECRET="$(openssl rand -base64 48)"

# Real Alpaca paper-trading (demo uses mock fills).
fly secrets set BEANSTALK_USE_ALPACA=true \
  ALPACA_API_KEY=... ALPACA_SECRET_KEY=...

# BigQuery persistence. The Dockerfile entrypoint writes this JSON to the path
# the services expect (src/GoogleCloudPlatform/beanstalk-app-...json).
fly secrets set BEANSTALK_GCP_BIGQUERY_PROJECTID=beanstalk-vtrading
fly secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat service-account.json)"
```

> Switching to production also requires flipping `BEANSTALK_ENVIRONMENT` to
> `production` in `fly.toml` (or `fly secrets set`), which moves off the
> in-memory store to BigQuery — a larger change than the deploy itself.

## Deploy

```bash
fly deploy                       # build Dockerfile, roll out, run health check
fly logs                         # tail
curl https://beanstalk-api.fly.dev/health   # expect HTTP 200 {"status":"ok",...}
```

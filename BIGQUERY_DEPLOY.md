# BigQuery + Fly.io Deployment Runbook

Everything needed to flip Beanstalk from the in-memory demo store to a
persistent BigQuery-backed production deployment on Fly.io.

## Prerequisites

- `gcloud` CLI installed and authenticated
- `bq` CLI (ships with `gcloud`)
- `flyctl` installed and authenticated
- A Google Cloud project (create one if needed)
- Admin access to the `beanstalk-api` Fly app

## 1. Create the GCP Project & Dataset

```bash
# If starting from scratch
gcloud projects create beanstalk-prod --name="Beanstalk Production"
gcloud config set project beanstalk-prod
gcloud services enable bigquery.googleapis.com

# Create the dataset (US multi-region; pick EU or a specific region if needed)
bq --location=US mk --dataset beanstalk-prod:beanstalk
```

Note the **project ID** (`beanstalk-prod`) and **dataset ID** (`beanstalk`) —
you'll need them in step 4.

## 2. Create a Service Account

The Fly app needs a service account with permission to read/write the
dataset. Limit scope to this dataset — don't grant project-level admin.

```bash
# Create the service account
gcloud iam service-accounts create beanstalk-api \
  --display-name="Beanstalk API runtime"

# Grant BigQuery Job User at the project level (needed to execute queries)
gcloud projects add-iam-policy-binding beanstalk-prod \
  --member="serviceAccount:beanstalk-api@beanstalk-prod.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Grant Data Editor on just the dataset (not project-wide)
bq add-iam-policy-binding \
  --member="serviceAccount:beanstalk-api@beanstalk-prod.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor" \
  beanstalk-prod:beanstalk

# Download the key file
gcloud iam service-accounts keys create ./beanstalk-api-key.json \
  --iam-account=beanstalk-api@beanstalk-prod.iam.gserviceaccount.com
```

**Keep `beanstalk-api-key.json` private.** It's a credential — do not commit it.

## 3. Run the Migrations

Seven migrations live in `./migrations/`. Each uses `\`project.dataset.\``
placeholders that must be rewritten before running. A one-liner:

```bash
PROJECT=beanstalk-prod
DATASET=beanstalk

for f in migrations/*.sql; do
  echo "=== Running $f ==="
  sed "s/project\.dataset/${PROJECT}.${DATASET}/g" "$f" \
    | bq query --project_id=$PROJECT --use_legacy_sql=false
done
```

Verify tables exist:

```bash
bq ls beanstalk-prod:beanstalk
# Should show: users, portfolio, portfolio_transaction, contest,
# contest_participant, contest_leaderboard, (+ any onboarding tables)
```

## 4. Configure Fly Secrets

The app reads three env vars for BigQuery:

| Variable | Value |
|---|---|
| `BEANSTALK_GCP_BIGQUERY_PROJECTID` | `beanstalk-prod` |
| `BEANSTALK_GCP_BIGQUERY_DATASETID` | `beanstalk` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | inline JSON of the key file |

```bash
# Inline the key JSON as a secret (one-line)
fly secrets set -a beanstalk-api \
  BEANSTALK_GCP_BIGQUERY_PROJECTID=beanstalk-prod \
  BEANSTALK_GCP_BIGQUERY_DATASETID=beanstalk \
  GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat beanstalk-api-key.json)"

# Flip out of demo mode — this is the switch that activates BigQuery
fly secrets unset -a beanstalk-api BEANSTALK_ENVIRONMENT
# Or explicitly set to something else:
# fly secrets set -a beanstalk-api BEANSTALK_ENVIRONMENT=production
```

**Credential materialization is automatic** — the `Dockerfile` includes an
entrypoint script that writes `GOOGLE_APPLICATION_CREDENTIALS_JSON` to the
path the services expect (`/app/src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json`)
at container start. The script is a no-op if the secret is unset, so local
`node src/server.js` and demo-mode deploys keep working without changes.

**Also note:** `fly.toml` currently has `BEANSTALK_ENVIRONMENT = "test"` in the
`[env]` block. Fly secrets override `[env]`, so setting
`BEANSTALK_ENVIRONMENT=production` via `fly secrets set` (or using
`fly secrets unset` with an explicit value override) flips the app into
BigQuery mode. Verify with `fly ssh console -a beanstalk-api -C 'env | grep BEANSTALK'`.

## 5. Ensure the Machine Doesn't Auto-Sleep

Without this, the in-memory portions of any remaining code (and any
in-flight caches) reset on every cold boot.

Edit `fly.toml`:

```toml
[[services]]
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
```

## 6. Deploy

```bash
fly deploy -a beanstalk-api
```

Watch the logs:

```bash
fly logs -a beanstalk-api
```

Expected boot output (no "test mode" or "in-memory store" lines):

```
[Beanstalk] :: Server listening on port 8080
```

If you see `user.service → in-memory store (test mode)` or similar, the
`BEANSTALK_ENVIRONMENT` var is still set to `demo` or `test` — step 4 didn't
take effect.

## 7. Smoke Test

```bash
# Register an admin
curl -X POST https://beanstalk-api.fly.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@beanstalk.app","password":"StrongPassword123!"}'

# Login — should return a token
curl -X POST https://beanstalk-api.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@beanstalk.app","password":"StrongPassword123!"}'

# Confirm the row actually landed in BigQuery
bq query --use_legacy_sql=false \
  "SELECT user_id, name, email, role, created_at
     FROM \`beanstalk-prod.beanstalk.users\`
    ORDER BY created_at DESC LIMIT 5"
```

The BQ query should show the user you just registered.

## 8. Optional — Grant Yourself Admin

The users table has a `role` column defaulting to `'user'`. To make someone
an admin (e.g., so they can create contests):

```bash
bq query --use_legacy_sql=false \
  "UPDATE \`beanstalk-prod.beanstalk.users\`
      SET role = 'admin'
    WHERE email = 'admin@beanstalk.app'"
```

## Rollback

If production BigQuery breaks and you need to fall back to the in-memory
demo (accepting that all data will be ephemeral):

```bash
fly secrets set -a beanstalk-api BEANSTALK_ENVIRONMENT=demo
fly deploy -a beanstalk-api  # triggers restart
```

Seed demo data with the remote seeder:

```bash
BASE_URL=https://beanstalk-api.fly.dev npm run seed:demo
```

## Cost Estimate

At 10k active users + 100k trades/month:
- BigQuery storage: ~1 GB active → **~$0.02/month**
- Query cost: ~100 GB scanned/month → **~$0.50/month**
- Fly.io shared-cpu-1x w/ 512MB, always-on: **~$2/month**

Total under $5/month for launch. The expensive line item will be Alpaca
market data (separate concern).

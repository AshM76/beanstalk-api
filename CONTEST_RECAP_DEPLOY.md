# Contest Recap — Deployment Runbook

Everything needed to turn on the **Cash-narrated contest recap** across all
three repos once its PRs are merged. Follow the steps in order — nothing here
requires downtime, and the feature stays invisible to players until an admin
publishes a recap.

The recap spans three repos:

| Repo | What it provides |
|---|---|
| `beanstalk-api` | recap generation, storage, endpoints, auto-generate on conclude |
| `beanstalk-web` | the admin **Generate → Review → Publish** panel |
| `beanstalk-mobile` | the player-facing **Recap** screen (group + personal) |

## Prerequisites

- The recap PRs merged to `main` in each repo:
  - **api** — recap INPUT builder, generator + endpoints, personal recap, auto-generate on conclude (and the five-ghost roster)
  - **web** — the admin Recap panel
  - **mobile** — the Recap screen
- `bq` CLI authenticated on the BigQuery project (see `BIGQUERY_DEPLOY.md`)
- `flyctl` authenticated with admin access to the `beanstalk-api` Fly app
- An **Anthropic API key** (`sk-ant-...`) for recap generation

## 1. Run the recap migrations (BigQuery)

Two new migrations back the recap tables. They're `CREATE TABLE IF NOT EXISTS`
(safe to re-run) and use the same `` `project.dataset.` `` placeholder as every
other migration:

| Migration | Creates |
|---|---|
| `011_add_contest_recap.sql` | `contest_recap` — one group recap per contest (`status` draft/published) |
| `012_add_contest_recap_personal.sql` | `contest_recap_personal` — one per-kid mini-recap per (contest, user) |

```bash
PROJECT=beanstalk-prod      # your real project id
DATASET=beanstalk           # your real dataset id

for f in migrations/011_add_contest_recap.sql \
         migrations/012_add_contest_recap_personal.sql; do
  echo "=== Running $f ==="
  sed "s/project\.dataset/${PROJECT}.${DATASET}/g" "$f" \
    | bq query --project_id=$PROJECT --use_legacy_sql=false
done
```

Verify both tables exist:

```bash
bq ls ${PROJECT}:${DATASET} | grep contest_recap
# Should show: contest_recap  and  contest_recap_personal
```

> Already run all migrations via the `migrations/*.sql` loop in
> `BIGQUERY_DEPLOY.md`? Then 011/012 are already applied — skip this step.

## 2. Configure Fly secrets (the API)

Recap generation reads these. Only `ANTHROPIC_API_KEY` is required; the other
two have sensible defaults.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | — | Auth for the Anthropic Messages API (the recap's model calls). Also gates auto-generate-on-conclude: with no key, auto-gen is skipped. |
| `RECAP_MODEL` | no | `claude-sonnet-5` | Model id. One-line swap to `claude-haiku-4-5` (cheapest) or `claude-opus-5` (premium). |
| `RECAP_AUTO_GENERATE` | no | on | Set to `false` (or `0`) to disable auto-generating the draft when a contest concludes. Admins can still generate manually. |

```bash
# Required — the model calls fail without this.
fly secrets set -a beanstalk-api ANTHROPIC_API_KEY=sk-ant-...

# Optional — only if you want to override the defaults.
fly secrets set -a beanstalk-api RECAP_MODEL=claude-sonnet-5
# fly secrets set -a beanstalk-api RECAP_AUTO_GENERATE=false
```

> If `ANTHROPIC_API_KEY` is already set for the Cash advisor (`/api/ai`), the
> recap reuses the same key and integration — nothing new to add.

Deploy the API (if not already on the merged `main`):

```bash
fly deploy -a beanstalk-api
```

## 3. Smoke-test the whole loop

Do this once against a **real concluded contest** to confirm the model call
works end to end. All recap endpoints require an admin / contest_manager token.

```bash
API=https://beanstalk-api.fly.dev
TOKEN=...            # an admin bearer token
CONTEST=...          # a concluded contest id

# a) Generate the draft (idempotent; ?force=1 regenerates)
curl -sS -X POST "$API/api/contests/$CONTEST/recap/generate" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .recap.headline'
# → "draft"  and a Cash-written headline

# b) Publish it
curl -sS -X POST "$API/api/contests/$CONTEST/recap/publish" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .published_at'
# → "published"  and a timestamp

# c) Fetch as a player would (published only; 404 before publish)
curl -sS "$API/api/contests/$CONTEST/recap" \
  -H "Authorization: Bearer $TOKEN" | jq '.recap.benchmark_scoreboard'

# d) A participant's private mini-recap (lazy-generated on first open)
curl -sS "$API/api/contests/$CONTEST/recap/me" \
  -H "Authorization: Bearer $PARTICIPANT_TOKEN" | jq '.recap.headline, .recap.beat_market'
```

**What "healthy" looks like:** (a) returns a `draft` with a non-empty
`headline`/`market_recap`; the `benchmark_scoreboard` shares are the
server-verified numbers (the model can't change them). If (a) returns a 502,
check the API logs for `[recap] generate failed: ... Anthropic returned <status>`
— a 401/403 there is almost always a missing or invalid `ANTHROPIC_API_KEY`.

## 4. Deploy the admin panel (web)

The admin panel is part of the merged web build — deploy it the usual way:

```bash
# from beanstalk-web, on merged main
npm ci
npx ng build            # the real gate — must be clean
# then deploy per the web repo's normal process (Firebase Hosting / etc.)
```

In the admin console: open a **concluded** contest → the **Contest Recap**
section shows **Generate → (preview) → Publish**. Generate is idempotent, so
if auto-generate already created a draft, "Generate" just loads it for review.

## 5. Ship the mobile app

```bash
# from beanstalk-mobile, on merged main
flutter analyze         # the real gate — repo CI does not compile Dart
# bump pubspec version, then build the IPA on the Mac and ship to TestFlight
```

Players see a **"See the Contest Recap"** card on a concluded contest's Details
tab; it opens the group recap plus their own private mini-recap. Nothing shows
until an admin has **published** the group recap.

## How it flows in production

```
contest concludes
   └─(auto, best-effort)─► group recap DRAFT generated   [RECAP_AUTO_GENERATE]
                              │
   admin opens web panel ─────┤  reviews the draft
                              ▼
                          PUBLISH  ──► players can now see it
                              │
   player opens Recap screen ─┴─► group recap  +  their personal mini-recap
                                   (personal is lazy-generated on first open,
                                    gated on the group recap being published)
```

## Operations & cost

- **Volume is low:** one group generation per concluded contest, plus one
  personal generation per player who actually opens their recap (cached after).
- **Turn it off** without a deploy: `fly secrets set -a beanstalk-api RECAP_AUTO_GENERATE=false`. Admins can still generate on demand.
- **Change the model** without a code change: `fly secrets set -a beanstalk-api RECAP_MODEL=claude-haiku-4-5`.
- **Every number players see is server-verified** — the model narrates only
  pre-computed figures, and the group scoreboard shares are pinned to the
  deterministic INPUT before storage.

## Rollback

- **Stop new recaps:** `RECAP_AUTO_GENERATE=false` — nothing further auto-generates.
- **Hide existing ones:** published recaps live in `contest_recap`
  (`status='published'`). To pull one back, set its row to `status='draft'` (or
  delete the row); the public `GET …/recap` then 404s and players stop seeing it.
- The tables are additive — dropping the feature never touches contest,
  participant, or portfolio data.

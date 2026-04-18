# Migration 008 — Add `asset_class` to `portfolio.positions`

BigQuery does **not** support adding a nested field to a `RECORD` (STRUCT)
column via SQL DDL (`ALTER TABLE ADD COLUMN` fails). The officially
supported path is a schema metadata update, either via `bq update --schema`
with a JSON schema file or via the `@google-cloud/bigquery` Node client's
`table.setMetadata({schema})`. Both are metadata-only — no table rewrite,
no data movement, no downtime.

This migration uses the Node client path so the operation is scripted and
idempotent: `scripts/migrate-008-add-asset-class.js`.

## What it does

1. Reads the current schema of `${dataset}.portfolio`.
2. If `positions.asset_class` already exists, exits cleanly (idempotent).
3. Adds `asset_class: STRING NULLABLE` to the `positions` record schema
   via `table.setMetadata({schema})`.
4. Audits every distinct symbol currently held in an un-classified
   position, classifies each via Alpaca, and runs a backfill DML so
   existing rows render with the right class from day one.

## Backfill mode (auto-selected)

The script audits every distinct symbol that currently lacks
`asset_class` and classifies each via Alpaca *before* running the
backfill. It then picks one of two modes:

- **stock-default** — all audited symbols classify as STOCK (or can't be
  classified). Backfill sets `asset_class = 'STOCK'` uniformly. Fast,
  single `UPDATE`.

- **per-symbol** — one or more symbols classify as ETF or CRYPTO.
  Backfill uses a `CASE symbol WHEN … THEN …` expression built from the
  audit so existing ETF/crypto holdings get the correct class, not
  mis-tagged as Stock.

**Operator action:** run with `--dry-run` first. The script prints the
full symbol → class map before it applies anything. If you see
`(fallback — classify failed)` next to any symbol, that means Alpaca
returned null and the script is defaulting it to STOCK — abort and
re-run when Alpaca is reachable if any of those symbols might be ETF
or crypto.

## How to run

```bash
# Dry run (shows intended changes, makes no writes):
node scripts/migrate-008-add-asset-class.js --dry-run

# Apply:
node scripts/migrate-008-add-asset-class.js
```

## Rollback

Schema changes in BigQuery can drop nullable fields by omitting them from
the updated schema via the same `table.setMetadata` path — but this
permanently drops the column's data. In practice, to roll back you would:

1. Revert the code changes on this branch.
2. Leave the schema field in place (code stops reading/writing it, but
   the column stays empty and costs nothing).

Actually dropping the column is not recommended unless you're sure no
other writers touch it.

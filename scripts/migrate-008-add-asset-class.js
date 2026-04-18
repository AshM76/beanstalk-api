#!/usr/bin/env node
/**
 * Migration 008 — add `asset_class` to portfolio.positions.
 *
 * Idempotent. See migrations/008_add_position_asset_class.md for why
 * this is a Node script and not a .sql file.
 *
 * Flow:
 *   1. Add asset_class to the positions RECORD (metadata-only via
 *      table.setMetadata — no table rewrite).
 *   2. Audit all distinct symbols in un-classified positions. Classify
 *      each via Alpaca.
 *   3. If every symbol is STOCK (or unclassifiable), run a fast
 *      stock-default backfill. If any symbol is ETF or CRYPTO, switch
 *      to a per-symbol CASE backfill so pre-migration non-stock
 *      holdings aren't mis-tagged.
 *
 * Usage:
 *   node scripts/migrate-008-add-asset-class.js --dry-run   # preview
 *   node scripts/migrate-008-add-asset-class.js             # apply
 */

require('dotenv').config()

const { BigQuery } = require('@google-cloud/bigquery')
const { classifyAsset } = require('../src/services/assetFilter.service')

const DATASET = process.env.BEANSTALK_GCP_BIGQUERY_DATASETID
const TABLE = 'portfolio'
const DRY_RUN = process.argv.includes('--dry-run')

if (!DATASET) {
  console.error('BEANSTALK_GCP_BIGQUERY_DATASETID env var is required')
  process.exit(1)
}

const bq = new BigQuery({
  projectId: process.env.BEANSTALK_GCP_BIGQUERY_PROJECTID,
  keyFilename: './src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json',
})

async function run() {
  const table = bq.dataset(DATASET).table(TABLE)

  // ── 1. Schema update ────────────────────────────────────────
  const [meta] = await table.getMetadata()
  const schema = meta.schema
  const positionsField = schema.fields.find(f => f.name === 'positions')
  if (!positionsField) {
    throw new Error(`positions field not found on ${DATASET}.${TABLE}`)
  }

  if (positionsField.fields.some(f => f.name === 'asset_class')) {
    console.log('[008] asset_class already present — schema step is a no-op')
  } else {
    console.log('[008] adding asset_class to positions record')
    positionsField.fields.push({
      name: 'asset_class',
      type: 'STRING',
      mode: 'NULLABLE',
      description: "'STOCK' | 'ETF' | 'CRYPTO' (nullable for legacy rows)",
    })

    if (DRY_RUN) {
      console.log('[008] --dry-run: skipping setMetadata')
    } else {
      await table.setMetadata({ schema })
      console.log('[008] schema updated')
    }
  }

  // ── 2. Audit ────────────────────────────────────────────────
  const [auditRows] = await bq.query({
    query: `
      SELECT DISTINCT p.symbol
      FROM \`${bq.projectId}.${DATASET}.${TABLE}\`, UNNEST(positions) p
      WHERE p.asset_class IS NULL
    `,
  })
  const symbols = auditRows.map(r => r.symbol).filter(Boolean)

  if (symbols.length === 0) {
    console.log('[008] no un-classified positions — backfill is a no-op')
    return
  }

  console.log(`[008] audit: ${symbols.length} distinct symbols need classification`)

  const classification = {}
  const unclassifiable = []
  for (const sym of symbols) {
    const cls = await classifyAsset(sym)
    if (cls) {
      classification[sym] = cls
    } else {
      classification[sym] = 'STOCK'
      unclassifiable.push(sym)
    }
  }

  console.log('[008] classification result:')
  for (const [sym, cls] of Object.entries(classification)) {
    const marker = unclassifiable.includes(sym) ? ' (fallback — classify failed)' : ''
    console.log(`       ${sym.padEnd(8)} → ${cls}${marker}`)
  }
  if (unclassifiable.length > 0) {
    console.warn(
      `[008] WARNING: ${unclassifiable.length} symbol(s) could not be classified ` +
      `via Alpaca and will be backfilled as 'STOCK'. If any of these are actually ` +
      `ETF or crypto, abort now (Ctrl-C) and re-run when Alpaca is reachable.`
    )
  }

  const distinctClasses = new Set(Object.values(classification))
  const perSymbol = distinctClasses.has('ETF') || distinctClasses.has('CRYPTO')
  console.log(`[008] backfill mode: ${perSymbol ? 'per-symbol' : 'stock-default'}`)

  // ── 3. Backfill DML ─────────────────────────────────────────
  const positionFields = `
          position_id, symbol, quantity, purchase_price, purchase_date,
          current_price, current_value, unrealized_gain_loss,
          unrealized_gain_loss_percent, updated_at`

  let fallbackExpr
  if (perSymbol) {
    const whens = Object.entries(classification)
      .map(([sym, cls]) => `WHEN ${JSON.stringify(sym)} THEN ${JSON.stringify(cls)}`)
      .join('\n            ')
    fallbackExpr = `CASE symbol\n            ${whens}\n            ELSE 'STOCK'\n          END`
  } else {
    fallbackExpr = `'STOCK'`
  }

  const backfillSql = `
    UPDATE \`${bq.projectId}.${DATASET}.${TABLE}\`
    SET positions = ARRAY(
      SELECT AS STRUCT${positionFields},
        IFNULL(asset_class, ${fallbackExpr}) AS asset_class
      FROM UNNEST(positions)
    )
    WHERE ARRAY_LENGTH(positions) > 0
      AND EXISTS (SELECT 1 FROM UNNEST(positions) p WHERE p.asset_class IS NULL)
  `

  if (DRY_RUN) {
    console.log('[008] --dry-run: would run backfill:\n' + backfillSql)
  } else {
    console.log('[008] running backfill UPDATE')
    const [job] = await bq.createQueryJob({ query: backfillSql, useLegacySql: false })
    await job.getQueryResults()
    const stats = job.metadata.statistics.query
    console.log(`[008] backfill complete. rows affected: ${stats?.numDmlAffectedRows ?? 'unknown'}`)
  }
}

run().catch(err => {
  console.error('[008] failed:', err)
  process.exit(1)
})

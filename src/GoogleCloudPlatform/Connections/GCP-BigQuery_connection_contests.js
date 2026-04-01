const { BigQuery } = require('@google-cloud/bigquery')

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = './src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json'
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = 'beanstalk_contests_data'

// Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename })

// ── Fetch the trading rules for a specific challenge ──────────
// Returns the subset of fields needed by the market layer:
//   crypto_allowed, allowed_asset_classes, status
// Falls back to safe defaults if the challenge is not found.
async function getChallengeRules(challengeId) {
    const query = `
        SELECT
            c.contest_id,
            c.contest_status          AS status,
            c.contest_crypto_allowed  AS crypto_allowed,
            c.contest_allowed_asset_classes AS allowed_asset_classes
        FROM ${keyDatasetId}.${keyTableId} AS c
        WHERE c.contest_id = '${challengeId}'
        LIMIT 1
    `

    const options = {
        query,
        location: 'US',
    }

    const [rows] = await bigquery.query(options)

    if (rows.length > 0) {
        const row = rows[0]
        return {
            error: false,
            message: 'Challenge rules loaded successfully',
            data: {
                contest_id:            row.contest_id,
                status:                row.status,
                crypto_allowed:        Boolean(row.crypto_allowed),
                allowed_asset_classes: row.allowed_asset_classes || null,
            },
        }
    }

    return {
        error: true,
        message: `Challenge not found: ${challengeId}`,
    }
}

module.exports = {
    getChallengeRules,
}

/**
 * Contest Asset Controller
 * Upload + serve small images (sponsor logos, banners) for contests.
 *
 * Demo-mode only: blobs live in the in-memory store (persisted via the
 * volume snapshot). The GET route is public on purpose — the mobile app's
 * image widgets fetch over plain HTTP with no Authorization header.
 */

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_BYTES = 512 * 1024 // 512 KB decoded

function assetStore() {
  if (!['test', 'demo'].includes(process.env.BEANSTALK_ENVIRONMENT)) return null
  return require('../services/_memory_store').asset
}

/**
 * POST /api/contest-assets  (admin/contest_manager)
 * Body: { content_type, data } — data is base64 without a data: prefix.
 * Returns { asset_id, url } where url is a relative path the client
 * prefixes with its API origin.
 */
async function uploadAsset(req, res) {
  try {
    if (!['admin', 'contest_manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and contest managers can upload assets' })
    }

    const store = assetStore()
    if (!store) {
      return res.status(501).json({ error: 'Asset uploads are only available in demo mode' })
    }

    const { content_type, data } = req.body || {}
    if (!content_type || !data) {
      return res.status(400).json({ error: 'Missing required fields: content_type, data' })
    }
    if (!IMAGE_TYPES.has(content_type)) {
      return res.status(400).json({ error: `content_type must be one of: ${[...IMAGE_TYPES].join(', ')}` })
    }

    // Strip an accidental data: prefix so clients can send either form.
    const base64 = data.includes(',') ? data.split(',').pop() : data
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
      return res.status(400).json({ error: 'data must be base64-encoded' })
    }
    if (Buffer.byteLength(base64, 'base64') > MAX_BYTES) {
      return res.status(413).json({ error: `Image too large (max ${MAX_BYTES / 1024} KB)` })
    }

    const asset = await store.createAsset({ content_type, data: base64 })
    res.status(201).json({
      asset_id: asset.asset_id,
      url: `/api/contest-assets/${asset.asset_id}`,
      size: asset.size,
    })
  } catch (error) {
    console.error('Asset upload error:', error)
    res.status(500).json({ error: 'Failed to upload asset' })
  }
}

/**
 * GET /api/contest-assets/:assetId  (public)
 * Serves the raw image bytes with its stored content type.
 */
async function getAsset(req, res) {
  try {
    const store = assetStore()
    if (!store) return res.status(404).json({ error: 'Not found' })

    const asset = await store.getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ error: 'Asset not found' })

    res.set('Content-Type', asset.content_type)
    res.set('Cache-Control', 'public, max-age=86400, immutable')
    res.send(Buffer.from(asset.data, 'base64'))
  } catch (error) {
    console.error('Asset fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch asset' })
  }
}

module.exports = { uploadAsset, getAsset }

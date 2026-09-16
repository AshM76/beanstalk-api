/**
 * Contest Recap generator — the Cash-narrated recap pipeline (phase 2).
 *
 * Flow (see Design/Contest-Recap-Generation-Spec.md in the mobile repo):
 *
 *   assemble deterministic INPUT (recapInput.service, pure code, no AI)
 *        │
 *        ▼
 *   Claude narrates it in Cash's voice  →  recap OUTPUT (JSON)
 *        │
 *        ▼
 *   validate + pin the scoreboard numbers to the verified INPUT
 *        │
 *        ▼
 *   store on the contest as `draft`  →  admin reviews  →  publish
 *
 * Reuse, don't reinvent: this matches the existing Cash advisor integration
 * (src/routes/ai.js) — a raw POST to the Anthropic Messages API with
 * ANTHROPIC_API_KEY, anthropic-version 2023-06-01 — rather than adding an SDK.
 * The model is `claude-sonnet-5` by default, behind the RECAP_MODEL knob.
 *
 * The model call is injectable (`opts.callModel`) so the whole pipeline —
 * assembly, validation, storage, the admin flow — is unit-testable without
 * credentials or a network.
 */

const recapInput = require('./recapInput.service')

const DEFAULT_RECAP_MODEL = 'claude-sonnet-5'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

function recapModel() {
  return process.env.RECAP_MODEL || DEFAULT_RECAP_MODEL
}

// Cash's voice + the hard safety rails. Stable → a good prompt-cache prefix.
const RECAP_SYSTEM_PROMPT = `You are Cash, the friendly financial-literacy mascot inside Beanstalk, an
educational VIRTUAL stock-trading app for kids, teens, and first-time
investors. A contest just ended and you're telling its story — what the market
did, what the players tried, and what everyone can learn. Everything is
virtual/paper trading; no real money is involved.

You will be given a RECAP INPUT: a compact JSON object of ALREADY-COMPUTED,
VERIFIED facts about the contest (day span, the benchmark "ghost players", the
field's returns, highlight trades and sectors, and the winner). Your job is to
NARRATE those facts warmly and clearly — not to compute new ones.

Hard rules:
- Use ONLY the numbers in the INPUT. Never invent, estimate, or extrapolate a
  figure. If a fact isn't in the INPUT, don't state it.
- Encouraging and growth-minded, ALWAYS. Celebrate effort and learning. Never
  shame, never single a kid out for a loss. Only positive moments (best trade,
  the winner) may be tied to a name, and only names the INPUT provides.
- This is NOT investment advice. Report what happened and teach the concept
  (diversification, risk vs. reward, time horizon, active vs. passive). No
  predictions, no "you should buy/sell", no price targets.
- Honor the benchmark story: the headline lesson is often "did moving the money
  around beat just leaving it in the market (Sammy P.) or a savings account
  (Piggy)?" Report the result plainly; let kids draw the lesson.
- Small sample / very short contest → say "still early!" rather than declaring a
  trend.
- Age-appropriate, plain language. No jargon without a quick, friendly gloss.

Respond with ONLY a single JSON object (no prose, no markdown fences) matching
this schema exactly:

{
  "headline": string,                       // one upbeat sentence
  "market_recap": string,                   // what the indices/ghosts did, in your voice
  "highlights": [ { "emoji": string, "title": string, "body": string } ],  // 2-4 items
  "benchmark_scoreboard": {
    "line": string,                         // e.g. "41% of you beat Sammy P., and 78% beat Piggy!"
    "beat_market_share": number,            // 0..1, from field.share_that_beat_sammy_p
    "beat_savings_share": number            // 0..1, from field.share_that_beat_piggy
  },
  "lessons": [ string ],                     // 1-3 positive, growth-framed takeaways
  "cash_signoff": string                     // a short, encouraging close
}`

/**
 * Build the single user message: the INPUT plus an explicit JSON-only nudge.
 */
function buildUserPrompt(input) {
  return [
    'Here is the RECAP INPUT for the contest that just ended. Narrate it as Cash.',
    'Remember: use only these numbers, stay positive, and reply with ONLY the JSON object.',
    '',
    'RECAP INPUT:',
    JSON.stringify(input, null, 2),
  ].join('\n')
}

// Cash's voice for a PRIVATE, per-kid mini-recap. Shorter and one-to-one.
const PERSONAL_SYSTEM_PROMPT = `You are Cash, the friendly financial-literacy mascot inside Beanstalk, an
educational VIRTUAL stock-trading app for kids and teens. A contest just ended,
and you're writing a SHORT, PRIVATE recap for ONE player — just for them.
Everything is virtual/paper trading; no real money is involved.

You'll get a small JSON INPUT with that player's ALREADY-COMPUTED, VERIFIED
results (their return, whether they beat the market ghost "Sammy P." and the
savings ghost "Piggy", their best pick, and a short "lessons_hook"). Narrate it
warmly — don't compute new numbers.

Hard rules:
- Use ONLY the numbers in the INPUT; never invent one.
- ALWAYS encouraging and growth-minded, whatever the result. If they had a
  losing month, be kind and forward-looking — never shaming, never "you lost".
  Frame it as learning. This is private, so you may speak directly to them
  ("you"), but stay positive.
- NOT investment advice. No predictions, no buy/sell tips.
- Keep it SHORT: 2-3 sentences of body, one gentle takeaway.

Respond with ONLY a single JSON object (no prose, no markdown fences):

{
  "headline": string,          // one warm, personal sentence
  "body": string,              // 2-3 encouraging sentences on how they did
  "lesson": string,            // one gentle, growth-framed takeaway
  "cash_signoff": string       // a short, kind close
}`

/**
 * Build the personal user message: just that kid's slice of the INPUT plus a
 * little contest context.
 */
function buildPersonalUserPrompt(input) {
  const context = {
    contest: input.contest,
    market_context: input.market_context,
    personal: input.personal,
  }
  return [
    'Here is ONE player\'s private results from the contest that just ended.',
    'Write their short personal recap as Cash. Use only these numbers, stay',
    'kind and encouraging, and reply with ONLY the JSON object.',
    '',
    'PLAYER INPUT:',
    JSON.stringify(context, null, 2),
  ].join('\n')
}

/**
 * Extract the recap JSON object from a model text response. Tolerant of stray
 * prose or ```json fences by slicing to the outermost braces.
 */
function extractRecapObject(text) {
  if (text && typeof text === 'object') return text // already parsed
  if (typeof text !== 'string') throw new Error('recap: empty model response')
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('recap: model response did not contain a JSON object')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

/**
 * Low-level Anthropic call, mirroring src/routes/ai.js: raw POST to the
 * Messages API with a stable (cache-friendly) system prompt. Returns the parsed
 * JSON object from the model's text response.
 */
async function _postAnthropic({ system, userText, model, maxTokens }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: model || recapModel(),
      max_tokens: maxTokens || 1500,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userText }],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`recap: Anthropic returned ${res.status} ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = Array.isArray(data.content)
    ? data.content.filter(c => c && c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('').trim()
    : ''
  return extractRecapObject(text)
}

/** Default GROUP recap model call. Returns the parsed recap object. */
async function defaultCallModel(input, { model } = {}) {
  return _postAnthropic({ system: RECAP_SYSTEM_PROMPT, userText: buildUserPrompt(input), model })
}

/** Default PERSONAL mini-recap model call. Shorter → smaller max_tokens. */
async function defaultCallPersonalModel(input, { model } = {}) {
  return _postAnthropic({
    system: PERSONAL_SYSTEM_PROMPT,
    userText: buildPersonalUserPrompt(input),
    model,
    maxTokens: 700,
  })
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Validate the recap's shape and PIN the scoreboard numbers to the verified
 * INPUT — the model narrates, but the figures kids see are the ones we
 * computed. Throws on a structurally unusable recap so the admin can retry.
 */
function validateRecap(raw, input) {
  const recap = extractRecapObject(raw)

  const missing = []
  if (!isNonEmptyString(recap.headline)) missing.push('headline')
  if (!isNonEmptyString(recap.market_recap)) missing.push('market_recap')
  if (!isNonEmptyString(recap.cash_signoff)) missing.push('cash_signoff')
  if (missing.length) {
    throw new Error(`recap: model output missing required field(s): ${missing.join(', ')}`)
  }

  // Highlights: keep only well-formed items; cap at 4.
  const highlights = Array.isArray(recap.highlights)
    ? recap.highlights
        .filter(h => h && isNonEmptyString(h.title) && isNonEmptyString(h.body))
        .slice(0, 4)
        .map(h => ({
          emoji: isNonEmptyString(h.emoji) ? h.emoji.trim() : '✨',
          title: h.title.trim(),
          body: h.body.trim(),
        }))
    : []

  const lessons = Array.isArray(recap.lessons)
    ? recap.lessons.filter(isNonEmptyString).map(s => s.trim()).slice(0, 3)
    : []

  // Authoritative scoreboard: overwrite the model's shares with the INPUT's,
  // so the numbers are always correct regardless of what the model wrote. Keep
  // the model's prose line (it's narration, not a figure).
  const field = (input && input.field) || {}
  const scoreboardIn = (recap.benchmark_scoreboard && typeof recap.benchmark_scoreboard === 'object')
    ? recap.benchmark_scoreboard
    : {}
  const benchmark_scoreboard = {
    line: isNonEmptyString(scoreboardIn.line) ? scoreboardIn.line.trim() : '',
    beat_market_share: field.share_that_beat_sammy_p ?? null,
    beat_savings_share: field.share_that_beat_piggy ?? null,
  }

  return {
    headline: recap.headline.trim(),
    market_recap: recap.market_recap.trim(),
    highlights,
    benchmark_scoreboard,
    lessons,
    cash_signoff: recap.cash_signoff.trim(),
  }
}

/**
 * Validate a PERSONAL mini-recap and PIN its numbers (return, beat flags) to
 * the verified personal INPUT. Throws on a structurally unusable recap.
 */
function validatePersonalRecap(raw, input) {
  const recap = extractRecapObject(raw)

  const missing = []
  if (!isNonEmptyString(recap.headline)) missing.push('headline')
  if (!isNonEmptyString(recap.body)) missing.push('body')
  if (!isNonEmptyString(recap.cash_signoff)) missing.push('cash_signoff')
  if (missing.length) {
    throw new Error(`recap: personal output missing required field(s): ${missing.join(', ')}`)
  }

  const p = (input && input.personal) || {}
  return {
    headline: recap.headline.trim(),
    body: recap.body.trim(),
    // Verified figures, straight from the INPUT — the model only narrates them.
    your_return_percent: p.return_percent ?? null,
    beat_market: p.beat_sammy_p ?? null,
    beat_savings: p.beat_piggy ?? null,
    lesson: isNonEmptyString(recap.lesson) ? recap.lesson.trim() : '',
    cash_signoff: recap.cash_signoff.trim(),
  }
}

function resolveDeps(opts = {}) {
  const deps = opts.deps || {}
  return {
    contestService: deps.contestService || require('./contest.service'),
    benchmarkService: deps.benchmarkService, // passed through to recapInput
    aiUsageService: deps.aiUsageService || safeRequire('./aiUsageService'),
  }
}

function safeRequire(mod) {
  try { return require(mod) } catch (_) { return null }
}

/**
 * Generate (or return the existing) recap DRAFT for a contest.
 *
 * Idempotent: if a recap already exists it's returned as-is unless `force` is
 * set. The generated recap is stored with status `draft`; publishing is a
 * separate admin step.
 *
 * @param {string} contestId
 * @param {object} [opts]
 * @param {boolean} [opts.force]           regenerate even if one exists
 * @param {string}  [opts.personalUserId]  include a personal mini-recap INPUT branch
 * @param {string}  [opts.adminUserId]     for best-effort usage metering
 * @param {function}[opts.callModel]       async (input, {model}) => recap object (tests inject)
 * @param {object}  [opts.deps]            service overrides (tests inject)
 * @returns {Promise<object>} the stored recap record
 */
async function generateRecap(contestId, opts = {}) {
  const { contestService, benchmarkService, aiUsageService } = resolveDeps(opts)
  const callModel = opts.callModel || defaultCallModel
  const model = opts.model || recapModel()

  const existing = await contestService.getContestRecap(contestId)
  if (existing && existing.recap && !opts.force) return existing

  const input = await recapInput.assembleRecapInput(contestId, {
    personalUserId: opts.personalUserId || null,
    deps: { contestService, benchmarkService },
  })

  const raw = await callModel(input, { model })
  const recap = validateRecap(raw, input)

  const record = await contestService.saveContestRecap({
    contest_id: contestId,
    status: 'draft',
    recap,
    model,
    generated_at: new Date(),
    published_at: null,
  })

  // Best-effort metering — mirrors the Cash advisor's aiUsageService usage.
  // Not a gate: admins aren't rate-limited on recap generation.
  if (aiUsageService && opts.adminUserId) {
    try { await aiUsageService.incrementUsage(opts.adminUserId) } catch (_) { /* non-fatal */ }
  }

  return record
}

/**
 * Publish a contest's recap (draft → published). Throws if there is no recap
 * to publish.
 */
async function publishRecap(contestId, opts = {}) {
  const { contestService } = resolveDeps(opts)
  const existing = await contestService.getContestRecap(contestId)
  if (!existing || !existing.recap) {
    const err = new Error('No recap to publish; generate one first')
    err.code = 'RECAP_NOT_FOUND'
    throw err
  }
  if (existing.status === 'published') return existing

  return contestService.saveContestRecap({
    ...existing,
    status: 'published',
    published_at: new Date(),
  })
}

/**
 * The public recap for a contest — only when published. Returns null otherwise
 * (a draft is admin-only), so the route can 404.
 */
async function getPublishedRecap(contestId, opts = {}) {
  const { contestService } = resolveDeps(opts)
  const existing = await contestService.getContestRecap(contestId)
  if (!existing || existing.status !== 'published' || !existing.recap) return null
  return existing
}

/**
 * Get (or lazily generate) the PERSONAL mini-recap for one player.
 *
 * Gated on the GROUP recap being published — the personal recap inherits the
 * admin's tone approval and is only offered once the contest recap is live.
 * Generated on first open per kid and cached; private to that kid.
 *
 * Returns null (the route 404s) when the group recap isn't published yet, or
 * when the user wasn't a scored participant (no personal INPUT branch).
 *
 * @param {string} contestId
 * @param {string} userId
 * @param {object} [opts]  { force?, model?, callModel?, deps? }
 * @returns {Promise<object|null>} the stored personal recap record, or null
 */
async function getOrGeneratePersonalRecap(contestId, userId, opts = {}) {
  const { contestService, benchmarkService } = resolveDeps(opts)
  const callModel = opts.callModel || defaultCallPersonalModel
  const model = opts.model || recapModel()

  // Personal recaps are gated on the published group recap.
  const group = await getPublishedRecap(contestId, { deps: { contestService } })
  if (!group) return null

  const existing = await contestService.getPersonalRecap(contestId, userId)
  if (existing && existing.recap && !opts.force) return existing

  const input = await recapInput.assembleRecapInput(contestId, {
    personalUserId: userId,
    deps: { contestService, benchmarkService },
  })
  // No personal branch → the user wasn't a scored participant in this contest.
  if (!input.personal) return null

  const raw = await callModel(input, { model })
  const recap = validatePersonalRecap(raw, input)

  return contestService.savePersonalRecap({
    contest_id: contestId,
    user_id: userId,
    recap,
    model,
    generated_at: new Date(),
  })
}

module.exports = {
  generateRecap,
  publishRecap,
  getPublishedRecap,
  getOrGeneratePersonalRecap,
  // exported for tests
  RECAP_SYSTEM_PROMPT,
  PERSONAL_SYSTEM_PROMPT,
  validateRecap,
  validatePersonalRecap,
  extractRecapObject,
  buildUserPrompt,
  buildPersonalUserPrompt,
}

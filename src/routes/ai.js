const express = require('express')
const router = express.Router()

const auth = require('../middlewares/auth.middleware')
const aiUsageService = require('../services/aiUsageService')

// All AI routes require a valid JWT (matches market.route.js pattern).
router.use(auth)

const FREE_LIMIT = 5

const SYSTEM_PROMPT = `You are Cash, Beanstalk's friendly AI investment advisor. Beanstalk is a
gamified virtual stock trading app for young investors (high school through
college). Users trade with virtual money — no real funds are at risk.

Your role:
- Give clear, educational advice on stocks, ETFs, and crypto for virtual trading
- Suggest specific tickers with brief reasoning (why it's interesting, not a guarantee)
- Suggest a virtual allocation amount (e.g. "consider putting $500–$1,000 of your virtual cash into...")
- Keep answers beginner-friendly, energetic, and encouraging
- Use emojis sparingly but effectively
- Always remind users this is for virtual/educational trading only
- Reference the user's $10,000 virtual starting balance when relevant
- Group suggestions clearly: name, ticker, why it's interesting, suggested virtual amount

Keep responses concise — 150–250 words max. Be specific, not vague. Think
like a knowledgeable friend who loves markets, not a disclaimer machine.`

router.get('/status', async (req, res) => {
  try {
    const userId = req.user.user_id
    const isPremium = Boolean(req.user.isPremium)
    const { count } = await aiUsageService.getUsage(userId)
    return res.json({
      remaining: isPremium ? null : Math.max(0, FREE_LIMIT - count),
      isPremium,
      usedToday: count,
    })
  } catch (err) {
    console.error('[ai.route] status failed:', err.message)
    return res.status(500).json({ error: 'Failed to read AI usage' })
  }
})

router.post('/chat', async (req, res) => {
  try {
    const userId = req.user.user_id
    const isPremium = Boolean(req.user.isPremium)

    const messages = req.body && req.body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' })
    }
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
        return res.status(400).json({ error: 'each message.role must be "user" or "assistant"' })
      }
      if (typeof m.content !== 'string' || m.content.trim().length === 0) {
        return res.status(400).json({ error: 'each message.content must be a non-empty string' })
      }
    }

    if (await aiUsageService.isLimited(userId, isPremium, FREE_LIMIT)) {
      return res.status(429).json({ error: 'Daily limit reached', remaining: 0 })
    }

    let anthropicRes
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages,
        }),
      })
    } catch (fetchErr) {
      console.error('[ai.route] anthropic fetch threw:', fetchErr.message)
      return res.status(502).json({ error: 'AI service unavailable. Try again in a moment.' })
    }

    if (!anthropicRes.ok) {
      const text = await anthropicRes.text().catch(() => '')
      console.error('[ai.route] anthropic non-200:', anthropicRes.status, text)
      return res.status(502).json({ error: 'AI service unavailable. Try again in a moment.' })
    }

    const data = await anthropicRes.json()
    const reply = Array.isArray(data.content)
      ? data.content
          .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text)
          .join('')
          .trim()
      : ''

    await aiUsageService.incrementUsage(userId)
    const { count } = await aiUsageService.getUsage(userId)

    return res.json({
      reply,
      remaining: isPremium ? null : Math.max(0, FREE_LIMIT - count),
      isPremium,
    })
  } catch (err) {
    console.error('[ai.route] chat failed:', err.message)
    return res.status(500).json({ error: 'AI request failed' })
  }
})

module.exports = router

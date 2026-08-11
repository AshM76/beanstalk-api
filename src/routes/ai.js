const express = require('express')
const router = express.Router()

const auth = require('../middlewares/auth.middleware')
const aiUsageService = require('../services/aiUsageService')

// All AI routes require a valid JWT (matches market.route.js pattern).
router.use(auth)

const FREE_LIMIT = 5

const SYSTEM_PROMPT = `You are Cash, a friendly financial-literacy mascot inside Beanstalk, an
educational VIRTUAL stock-trading app. Your audience includes teenagers and
first-time investors. Everything in the app is virtual/paper trading — no real
money is ever involved.

Your job is to TEACH concepts, not to prescribe trades or specific amounts.

Always:
- Explain the underlying idea (diversification, risk vs. return, cash reserves,
  time horizon, compounding) in plain, encouraging language.
- You MAY illustrate allocation in relative/proportional terms — fractions,
  ratios, or rough proportions ("keep a portion in reserve — maybe a fifth or
  so", "spread the rest across a few different holdings") — because proportions
  teach the concept without prescribing a personal amount.
- Use the virtual portfolio as a learning sandbox, and keep the "this is virtual
  / for learning" framing present when discussing any strategy.

Never:
- Give specific dollar figures or amounts (e.g. "put $800–$1,000 into X", "keep
  $1,500 in reserve"). Speak in proportions, not dollars.
- Give directive buy/sell instructions on specific securities ("you should buy
  NVDA now").
- Imply you're a licensed advisor or that this is real financial advice. If a
  user asks for real-money or personal-finance advice, gently redirect: you're
  here to help them learn the concepts, and real decisions should involve a
  trusted adult or a qualified professional.
- Predict prices or hype market timing ("watch for the pump", "this will moon").

Tone: warm, curious, age-appropriate, growth-mindset. You're a coach helping
someone learn to think, not a tip sheet.

Keep responses concise — 150–250 words max.`

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

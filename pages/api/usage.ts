import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const key = process.env.OPENROUTER_API_KEY || ''
    let usageMonthly = 0
    let usageWeekly = 0
    let model = getModelFromProcess() || 'deepseek-v4-flash'
    let creditsRemaining = 0

    if (key) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${key}` }
        })
        if (r.ok) {
          const data = await r.json()
          usageMonthly = data.data?.usage_monthly || 0
          usageWeekly = data.data?.usage_weekly || 0
          creditsRemaining = data.data?.limit_remaining ?? 0
        }
      } catch (e) {
        console.error('OpenRouter fetch failed:', e)
      }
    }

    const now = new Date()
    const dailyUsage: { date: string; cost: number; tokens: number }[] = []
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const isWeekday = d.getDay() >= 1 && d.getDay() <= 5
      const share = isWeekday ? usageWeekly / 5 : 0
      dailyUsage.push({
        date: d.toLocaleDateString('en-SG', { weekday: 'short' }),
        cost: Number(share.toFixed(4)),
        tokens: Math.round(share * 50000)
      })
    }

    res.json({ totalCost: usageMonthly, creditsRemaining, model, dailyUsage, isFreeTier: false })
  } catch (error) {
    console.error('Usage API error:', error)
    res.status(500).json({ totalCost: 0, creditsRemaining: 0, model: 'unknown', dailyUsage: [] })
  }
}

function getModelFromProcess(): string | null {
  try {
    const m = process.env.HERMES_MODEL || process.env.MODEL || ''
    if (m) return m
  } catch {}
  return null
}

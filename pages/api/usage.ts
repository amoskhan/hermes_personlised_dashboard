import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export const config = { runtime: 'nodejs' }

const AGENT_LOG = '/home/ubuntu/.hermes/logs/agent.log'
const CONFIG_PATH = '/home/ubuntu/.hermes/config.yaml'
const ANTHROPIC_LOG = '/home/ubuntu/.hermes/usage_logs/anthropic_usage.log'

// Known pricing per model (OpenRouter rates)
// Values are $/1M tokens for prompt/completion
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'deepseek/deepseek-v4-flash':    { prompt: 0.112, completion: 0.224 },
  'deepseek-v4-flash':             { prompt: 0.112, completion: 0.224 },
  'anthropic/claude-sonnet-4':     { prompt: 3.0,   completion: 15.0 },
  'openai/gpt-oss-120b:free':      { prompt: 0, completion: 0 },
  'inclusionai/ring-2.6-1t:free':  { prompt: 0, completion: 0 },
  'google/gemma-4-31b-it:free':    { prompt: 0, completion: 0 },
  'arcee-ai/trinity-large-thinking:free': { prompt: 0, completion: 0 },
  'openrouter/free':                { prompt: 0, completion: 0 },
  'openai/gpt-oss-120b':           { prompt: 0.039, completion: 0.18 },
  'openai/gpt-oss-20b':            { prompt: 0.03,  completion: 0.14 },
  'openrouter/owl-alpha':          { prompt: 0.05,  completion: 0.20 },
}

function getCurrentModel(): string {
  // Priority 1: Scan agent.log for the most recently used model
  try {
    if (fs.existsSync(AGENT_LOG)) {
      const logContent = fs.readFileSync(AGENT_LOG, 'utf-8')
      const lines = logContent.split('\n').filter(l => l.trim())
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]
        // Look for model= in API call lines (most accurate)
        const apiModel = line.match(/model=([\w./-]+(?::\w+)?)/)
        if (apiModel && apiModel[1] !== 'openai/gpt-oss-120b:free') return apiModel[1]
        const auxModel = line.match(/using openrouter \((\S+)\)/)
        if (auxModel) return auxModel[1]
      }
      // If all recent models were free, still return the last one
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]
        const apiModel = line.match(/model=([\w./-]+(?::\w+)?)/)
        if (apiModel) return apiModel[1]
      }
    }
  } catch {}

  // Priority 2: Read from config.yaml
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const match = content.match(/^model:\s*(\S+)/m)
    if (match) return match[1]
  } catch {}

  return 'unknown'
}

function isFreeModel(model: string): boolean {
  return model.includes(':free') ||
    model.includes('gemma') ||
    model.includes('qwen2.5') ||
    model === 'openrouter/free' ||
    model === 'openai/gpt-oss-120b:free'
}

function getPricing(model: string): { prompt: number; completion: number } {
  // Try exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]
  // Try partial match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return pricing
  }
  // Default: assume $1/M tokens for unknown paid models
  return { prompt: 0.5, completion: 1.0 }
}

interface DailyModelData {
  calls: number
  model: string
}

interface DayData {
  date: string
  paid: number
  free: number
  models: DailyModelData[]
}

function parseAgentLog(): { days: DayData[]; modelsSummary: Record<string, number> } {
  const days: DayData[] = []
  const modelsSummary: Record<string, number> = {}

  if (!fs.existsSync(AGENT_LOG)) return { days: [], modelsSummary: {} }

  const content = fs.readFileSync(AGENT_LOG, 'utf-8')
  const dailyCalls: Record<string, Record<string, number>> = {}

  for (const line of content.split('\n')) {
    const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue
    const date = dateMatch[1]

    // Extract model from various log formats
    let model: string | null = null
    const mainModel = line.match(/model=([\w./-]+(?::\w+)?)/)
    const auxModel = line.match(/using openrouter \((\S+)\)/)
    const switchedTo = line.match(/Model switched.*?->\s*(\S+)/)

    if (mainModel) model = mainModel[1]
    else if (auxModel) model = auxModel[1]
    else if (switchedTo) model = switchedTo[1]

    if (model) {
      if (!dailyCalls[date]) dailyCalls[date] = {}
      dailyCalls[date][model] = (dailyCalls[date][model] || 0) + 1
      modelsSummary[model] = (modelsSummary[model] || 0) + 1
    }
  }

  for (const [date, models] of Object.entries(dailyCalls)) {
    const modelEntries: DailyModelData[] = Object.entries(models)
      .map(([model, calls]) => ({ model, calls }))
      .sort((a, b) => b.calls - a.calls)

    const day: DayData = {
      date,
      paid: 0,
      free: 0,
      models: modelEntries,
    }
    for (const m of modelEntries) {
      if (isFreeModel(m.model)) day.free += m.calls
      else day.paid += m.calls
    }
    days.push(day)
  }

  days.sort((a, b) => a.date.localeCompare(b.date))
  return { days, modelsSummary }
}

function distributeCost(
  totalSpend: number,
  days: DayData[],
): { dailyCost: Record<string, { cost: number; tokens: number; paidCalls: number }>; perModel: Record<string, { calls: number; cost: number; isFree: boolean }> } {
  const dailyCost: Record<string, { cost: number; tokens: number; paidCalls: number }> = {}
  const perModel: Record<string, { calls: number; cost: number; isFree: boolean }> = {}

  // First pass: count total paid calls
  let totalPaidCalls = 0
  const dayPaidCalls: Record<string, number> = {}
  const modelPaidCalls: Record<string, number> = {}
  const modelCallTotals: Record<string, number> = {}

  for (const day of days) {
    let pc = 0
    for (const m of day.models) {
      modelCallTotals[m.model] = (modelCallTotals[m.model] || 0) + m.calls
      if (!isFreeModel(m.model)) {
        pc += m.calls
        modelPaidCalls[m.model] = (modelPaidCalls[m.model] || 0) + m.calls
        perModel[m.model] = { calls: 0, cost: 0, isFree: false }
      } else {
        perModel[m.model] = { calls: 0, cost: 0, isFree: true }
      }
    }
    dayPaidCalls[day.date] = pc
    totalPaidCalls += pc
  }

  // Also track free model call counts
  for (const day of days) {
    for (const m of day.models) {
      if (perModel[m.model]) {
        perModel[m.model].calls += m.calls
      }
    }
  }

  // Distribute by paid call proportion (weighted by estimated cost per call)
  // DeepSeek is cheap (~$0.00015/call), Claude is expensive (~$0.005/call)
  // Use the pricing to weight
  let totalWeight = 0
  const dayWeights: Record<string, number> = {}
  const modelWeights: Record<string, number> = {}

  for (const day of days) {
    let dw = 0
    for (const m of day.models) {
      if (isFreeModel(m.model)) continue
      const pricing = getPricing(m.model)
      const avgCostPerCall = (pricing.prompt + pricing.completion) / 2 / 1_000_000 * 1000 // ~1K tokens per call
      const weight = m.calls * avgCostPerCall
      dw += weight
      modelWeights[m.model] = (modelWeights[m.model] || 0) + weight
    }
    dayWeights[day.date] = dw
    totalWeight += dw
  }

  // Now distribute
  for (const day of days) {
    const share = totalWeight > 0 ? dayWeights[day.date] / totalWeight : dayPaidCalls[day.date] / totalPaidCalls
    const cost = totalSpend * (share || 0)
    const avgTokensPerCall = 3000 // rough estimate
    dailyCost[day.date] = {
      cost: Number(cost.toFixed(4)),
      tokens: Math.round(dayPaidCalls[day.date] * avgTokensPerCall),
      paidCalls: dayPaidCalls[day.date],
    }
  }

  // Per-model breakdown
  for (const [model, weight] of Object.entries(modelWeights)) {
    perModel[model].cost = Number(((weight / totalWeight) * totalSpend).toFixed(4))
  }

  return { dailyCost, perModel }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // On Vercel: proxy to VPS for accurate data (agent logs, env vars, OpenRouter API)
  if (process.env.VERCEL || !require('fs').existsSync('/home/ubuntu/.hermes/config.yaml')) {
    try {
      const proxyRes = await fetch('http://43.156.249.23:3001/api/usage', { signal: AbortSignal.timeout(10000) })
      const data = await proxyRes.json()
      return res.json(data)
    } catch { /* fall through to zero-data response */ }
  }

  const currentModel = getCurrentModel()

  // Fetch OpenRouter real spend
  let openRouterUsage = 0
  let orDaily = 0
  let orWeekly = 0
  let orMonthly = 0
  let totalCredits = 0

  try {
    const envPath = '/home/ubuntu/visual-os/.env.local'
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const keyMatch = envContent.match(/OPENROUTER_API_KEY=(\S+)/)
    const orKey = keyMatch ? keyMatch[1] : ''

    if (orKey) {
      const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${orKey}` },
        signal: AbortSignal.timeout(5000),
      })
      const data = await resp.json()
      if (data?.data) {
        openRouterUsage = data.data.usage || 0
        orDaily = data.data.usage_daily || 0
        orWeekly = data.data.usage_weekly || 0
        orMonthly = data.data.usage_monthly || 0
        totalCredits = data.data.total_credits || 0
      }

      // Also get total credits
      const creditResp = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${orKey}` },
        signal: AbortSignal.timeout(5000),
      })
      const creditData = await creditResp.json()
      if (creditData?.data) {
        totalCredits = creditData.data.total_credits || totalCredits
      }
    }
  } catch {}

  // Read Anthropic usage log
  let anthropicCost = 0
  try {
    if (fs.existsSync(ANTHROPIC_LOG)) {
      const antData = JSON.parse(fs.readFileSync(ANTHROPIC_LOG, 'utf-8'))
      anthropicCost = antData.total_cost || 0
    }
  } catch {}

  // Parse agent logs for model breakdown
  const { days, modelsSummary } = parseAgentLog()

  // Distribute the OpenRouter spend across the days/models
  const { dailyCost, perModel } = distributeCost(orMonthly, days)

  // Build last 7 days chart
  const now = new Date()
  const last7: { date: string; cost: number; tokens: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString('en-SG', { weekday: 'short' })
    const data = dailyCost[dateStr]
    last7.push({
      date: dayLabel,
      cost: data ? data.cost : 0,
      tokens: data ? data.tokens : 0,
    })
  }

  // Build per-model daily usage (last 7 days)
  // Each day's tokens/cost is split between models by pricing-weighted call proportion
  const perModelDaily: Record<string, { date: string; calls: number; tokens: number; cost: number }[]> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString('en-SG', { weekday: 'short' })

    // Find this day's data from parsed logs
    const dayData = days.find(dd => dd.date === dateStr)
    if (!dayData || dayData.models.length === 0) continue

    // Compute pricing weight for each model this day
    let totalDayWeight = 0
    const modelDayWeights: Record<string, number> = {}
    for (const m of dayData.models) {
      const pricing = isFreeModel(m.model) ? { prompt: 0, completion: 0 } : getPricing(m.model)
      const weight = m.calls * ((pricing.prompt + pricing.completion) / 2 / 1_000_000 * 1000)
      modelDayWeights[m.model] = weight
      totalDayWeight += weight
    }

    const dayTotal = dailyCost[dateStr]
    const dayTokens = dayTotal ? dayTotal.tokens : 0
    const dayCost = dayTotal ? dayTotal.cost : 0

    for (const m of dayData.models) {
      if (!perModelDaily[m.model]) perModelDaily[m.model] = []
      const share = totalDayWeight > 0 ? (modelDayWeights[m.model] / totalDayWeight) : (1 / dayData.models.length)
      perModelDaily[m.model].push({
        date: dayLabel,
        calls: m.calls,
        tokens: Math.round(dayTokens * share),
        cost: Number((dayCost * share).toFixed(4)),
      })
    }
  }

  // Calculate max tokens for chart scaling
  const maxTokens = Math.max(...last7.map(d => d.tokens), 1)

  // Singapore conversion rate (1 USD ≈ 1.35 SGD)
  const sgdRate = 1.35

  // Top paid models list
  const topPaidModels = Object.entries(perModel)
    .filter(([_, v]) => !v.isFree && v.calls > 0)
    .sort(([_, a], [__, b]) => b.cost - a.cost)
    .map(([model, data]) => ({
      model,
      calls: data.calls,
      cost: Number((data.cost * sgdRate).toFixed(2)),
    }))
  const sgdSpend = (orMonthly + anthropicCost) * sgdRate
  const sgdRemaining = (totalCredits - openRouterUsage) * sgdRate

  return res.json({
    // Active model info
    model: currentModel,
    provider: currentModel.startsWith('anthropic/') ? 'Anthropic Direct' : 'OpenRouter',
    isFreeTier: isFreeModel(currentModel),

    totalCost: Number(sgdSpend.toFixed(2)),
    totalCostUSD: Number(orMonthly.toFixed(2)),
    creditsRemaining: Number(sgdRemaining.toFixed(2)),
    totalCredits,
    subscriptions: 0, // No monthly subscription

    // Daily chart
    dailyUsage: last7,
    maxTokens,

    // Per-model breakdown (this month)
    models: [
      ...topPaidModels,
      ...Object.entries(perModel)
        .filter(([_, v]) => v.isFree && v.calls > 0)
        .sort(([_, a], [__, b]) => b.calls - a.calls)
        .slice(0, 5)
        .map(([model, data]) => ({
          model,
          calls: data.calls,
          cost: data.cost,
          free: true,
        })),
    ],

    // DeepSeek specific (converted to SGD)
    deepseekSpend: Number(((perModel['deepseek-v4-flash']?.cost ?? perModel['deepseek/deepseek-v4-flash']?.cost ?? 0) * sgdRate).toFixed(2)),
    deepseekCalls: perModel['deepseek-v4-flash']?.calls ?? perModel['deepseek/deepseek-v4-flash']?.calls ?? 0,

    // Anthropic (via own key)
    anthropicCost,

    usageNote: currentModel.startsWith('anthropic/')
      ? `Anthropic direct (own key). OpenRouter shows ~S${(orMonthly * 1.35).toFixed(2)} historical DeepSeek spend.`
      : `Paid model via OpenRouter — US$${orMonthly.toFixed(2)}/mo`,

    // Raw totals for reference
    totalCallsAllModels: Object.values(modelsSummary).reduce((a: number, b: number) => a + b, 0),

    // Per-model daily breakdown (for model selector)
    perModelDaily,
  })
}

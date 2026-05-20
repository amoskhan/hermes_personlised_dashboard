import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { runtime: 'nodejs' }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const host = req.headers.host || ''
    // On VPS: run local Python script
    if (host.includes('localhost') || host.includes('43.156.249.23') || host.includes('127.0.0.1')) {
      const { execSync } = require('child_process')
      const raw = execSync('python3 /home/ubuntu/visual-os/scripts/daily-summary.py', {
        timeout: 10000,
        encoding: 'utf-8'
      })
      const data = JSON.parse(raw)
      return res.json(data)
    }

    // On Vercel: proxy to VPS
    const proxyRes = await fetch('http://43.156.249.23:3002/api/daily-summary', {
      signal: AbortSignal.timeout(8000)
    })
    const data = await proxyRes.json()
    return res.json(data)
  } catch (err: any) {
    return res.json({
      date: new Date().toISOString().split('T')[0],
      hasNote: false,
      summary: 'Could not fetch daily summary.',
      standup: null,
      weather: '',
      events: [],
      error: err.message
    })
  }
}

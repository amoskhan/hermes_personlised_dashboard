import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { runtime: 'nodejs' }

type CalendarEvent = {
  id: string
  summary: string
  start: string
  end: string
  location: string
  isAllDay: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // On VPS: fetch from local Python script
  // On Vercel: proxy to the running VPS endpoint
  try {
    const host = req.headers.host || ''
    // If running locally (VPS dev server or production server), use local python
    if (host.includes('localhost') || host.includes('43.156.249.23') || host.includes('127.0.0.1')) {
      const { execSync } = require('child_process')
      const raw = execSync('python3 /home/ubuntu/visual-os/scripts/get-today-calendar.py', {
        timeout: 15000,
        encoding: 'utf-8'
      })
      const events: CalendarEvent[] = JSON.parse(raw)
      return res.json({ date: new Date().toISOString().split('T')[0], events })
    }

    // On Vercel: proxy to VPS
    const proxyRes = await fetch('http://43.156.249.23:3002/api/calendar', { signal: AbortSignal.timeout(8000) })
    const data = await proxyRes.json()
    return res.json(data)
  } catch (err: any) {
    return res.status(500).json({
      date: new Date().toISOString().split('T')[0],
      events: [],
      error: err.message
    })
  }
}

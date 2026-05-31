import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { runtime: 'nodejs' }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const host = req.headers.host || ''
    if (host.includes('localhost') || host.includes('43.156.249.23') || host.includes('127.0.0.1')) {
      const { execSync } = require('child_process')
      const raw = execSync('/home/ubuntu/.hermes/hermes-agent/venv/bin/python /home/ubuntu/visual-os/scripts/get-today-calendar.py --days 7', {
        timeout: 15000,
        encoding: 'utf-8'
      })
      const events = JSON.parse(raw)
      // Filter for badminton sessions
      const badmintonEvents = events.filter((e: any) =>
        (e.summary || '').toLowerCase().includes('badminton') ||
        (e.summary || '').toLowerCase().includes('safra')
      )
      return res.json({
        upcoming: badmintonEvents.slice(0, 5),
        total: badmintonEvents.length,
        weekTraining: getTrainingStatus(),
        competitionCountdown: getCompetitionCountdown()
      })
    }

    const proxyRes = await fetch('http://43.156.249.23:3001/api/badminton', { signal: AbortSignal.timeout(8000) })
    const data = await proxyRes.json()
    return res.json(data)
  } catch (err: any) {
    return res.json({ upcoming: [], total: 0, weekTraining: null, competitionCountdown: null, error: err.message })
  }
}

function getTrainingStatus() {
  const now = new Date()
  const day = now.getDay()
  // Simple heuristic: how many training sessions so far this week
  return {
    sessionsThisWeek: day > 0 && day < 6 ? 'Light week — competition prep phase' : 'Weekend — match day prep',
    focus: 'Footwork, smashing, match play drills'
  }
}

function getCompetitionCountdown() {
  const comp = new Date('2026-05-24T08:00:00+08:00')
  const now = new Date()
  const diff = Math.ceil((comp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return null
  if (diff === 0) return { days: 0, label: '🏆 COMPETITION DAY!', urgent: true }
  if (diff === 1) return { days: 1, label: '🏸 1 day to competition! Rest up!', urgent: true }
  return { days: diff, label: `🏸 ${diff} days to competition`, urgent: diff <= 3 }
}

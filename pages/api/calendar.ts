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

type WeekDay = {
  date: string
  dayName: string
  dayAbbr: string
  isToday: boolean
  events: CalendarEvent[]
}

// Get current date in Singapore timezone (GMT+8)
function sgNow(): Date {
  const now = new Date()
  // Convert to SG time by adding 8h offset
  const sgTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  return sgTime
}

function sgDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day  // Monday = 1
  date.setUTCDate(date.getUTCDate() + diff)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildWeekDays(allEvents: CalendarEvent[]): WeekDay[] {
  const today = sgNow()
  today.setUTCHours(0, 0, 0, 0)
  const monday = getMonday(today)

  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)

    const dateStr = sgDateStr(d)
    const dayEvents = allEvents.filter(evt => {
      const evtDate = evt.start.split('T')[0]
      return evtDate === dateStr
    })

    days.push({
      date: dateStr,
      dayName: DAY_NAMES[d.getDay()],
      dayAbbr: DAY_ABBR[d.getDay()],
      isToday: d.getTime() === today.getTime(),
      events: dayEvents
    })
  }
  return days
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const host = req.headers.host || ''
    const range = (req.query.range as string) || 'today'  // 'today' | 'week'

    // If running locally (VPS), use local python
    if (host.includes('localhost') || host.includes('43.156.249.23') || host.includes('127.0.0.1')) {
      const { execSync } = require('child_process')

      // Fetch enough events for the week (up to 14 days to catch all-day events)
      const daysToFetch = range === 'week' ? 7 : 1
      const raw = execSync(
        `/home/ubuntu/.hermes/hermes-agent/venv/bin/python /home/ubuntu/visual-os/scripts/get-today-calendar.py --days ${daysToFetch}`,
        { timeout: 15000, encoding: 'utf-8' }
      )
      const events: CalendarEvent[] = JSON.parse(raw)

      if (range === 'week') {
        const weekDays = buildWeekDays(events)
        return res.json({ range: 'week', weekDays, events })
      }

      // Today only (legacy)
      return res.json({ date: new Date().toISOString().split('T')[0], events })
    }

    // On Vercel: proxy to VPS
    const queryStr = range === 'week' ? '?range=week' : ''
    const proxyRes = await fetch(`http://43.156.249.23:3001/api/calendar${queryStr}`, {
      signal: AbortSignal.timeout(8000)
    })
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

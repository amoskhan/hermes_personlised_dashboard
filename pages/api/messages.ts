import type { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

const LOG_PATH = path.resolve(
  process.env.HOME || '/home/ubuntu',
  '.hermes', 'cron', 'output', 'messages.log'
)

export type MessageEntry = {
  time: string
  source: string
  text: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const since = Number(req.query.since || 0)

  try {
    const data = await fs.readFile(LOG_PATH, 'utf-8')
    const lines = data.trim().split('\n').filter(Boolean)
    const messages: MessageEntry[] = lines
      .map(line => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean)
      .filter(msg => (new Date(msg.time || 0).getTime()) > since)

    return res.json({ messages })
  } catch {
    // File doesn't exist yet — return empty so widget shows "No messages"
    return res.json({ messages: [] })
  }
}

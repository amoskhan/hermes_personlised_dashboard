import type { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const HOME = process.env.HOME || '/home/ubuntu'
const LOG_PATH = path.resolve(HOME, '.hermes', 'cron', 'output', 'messages.log')
const VAULT_DIR = '/home/ubuntu/ObsidianVault'

export type MessageEntry = {
  time: string
  source: string
  text: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

async function gatherMessages(since: number): Promise<MessageEntry[]> {
  const messages: MessageEntry[] = []
  const now = Date.now()
  const seen = new Set<string>()

  function add(msg: MessageEntry) {
    const key = msg.time + msg.source + msg.text
    if (!seen.has(key) && new Date(msg.time).getTime() > since) {
      seen.add(key)
      messages.push(msg)
    }
  }

  // 1. Read the static log file
  try {
    const data = await fs.readFile(LOG_PATH, 'utf-8')
    for (const line of data.trim().split('\n').filter(Boolean)) {
      try {
        const entry = JSON.parse(line)
        add(entry)
      } catch {}
    }
  } catch {}

  // 2. Check recently modified vault notes (last 24h)
  try {
    const result = execSync(
      `find "${VAULT_DIR}" -name '*.md' -mmin -1440 -type f 2>/dev/null | head -10`,
      { encoding: 'utf-8', timeout: 5000 }
    )
    const files = result.trim().split('\n').filter(Boolean)
    for (const file of files.slice(0, 5)) {
      const relPath = path.relative(VAULT_DIR, file).replace(/\.md$/, '')
      const mtime = execSync(`stat -c '%Y' "${file}"`, { encoding: 'utf-8', timeout: 2000 }).trim()
      const ts = new Date(parseInt(mtime) * 1000).toISOString()
      add({
        time: ts,
        source: 'vault',
        text: `📝 Modified: ${relPath}`,
        type: 'info',
      })
    }
  } catch {}

  // 3. Check recent cron job runs (last 2 hours)
  try {
    const cronDir = path.resolve(HOME, '.hermes', 'cron', 'output')
    const entries = await fs.readdir(cronDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const jobDir = path.join(cronDir, entry.name)
      const files = await fs.readdir(jobDir)
      for (const fname of files) {
        const fpath = path.join(jobDir, fname)
        const stat = await fs.stat(fpath)
        if (now - stat.mtimeMs < 2 * 3600 * 1000) {
          // Recent cron output
          const content = (await fs.readFile(fpath, 'utf-8')).trim().slice(0, 120)
          if (content) {
            add({
              time: new Date(stat.mtimeMs).toISOString(),
              source: 'cron',
              text: `⏱️ Job ${entry.name.slice(0, 10)}: ${content.slice(0, 100)}`,
              type: 'info',
            })
          }
        }
      }
    }
  } catch {}

  // 4. Agent process status
  try {
    const result = execSync('pgrep -f "hermes" 2>/dev/null || echo "0"', { encoding: 'utf-8', timeout: 3000 })
    const pid = result.trim()
    if (pid && pid !== '0') {
      add({
        time: new Date(now).toISOString(),
        source: 'system',
        text: `🤖 Hermes Agent running (PID ${pid.slice(0, 10)})`,
        type: 'success',
      })
    }
  } catch {}

  // 5. Dashboard build status
  try {
    const nextDir = '/home/ubuntu/visual-os/.next'
    const buildIdPath = path.join(nextDir, 'BUILD_ID')
    try {
      const buildId = (await fs.readFile(buildIdPath, 'utf-8')).trim()
      add({
        time: new Date(now).toISOString(),
        source: 'dashboard',
        text: `📊 Dashboard v${buildId.slice(0, 7)} active`,
        type: 'info',
      })
    } catch {}
  } catch {}

  // Sort by time, newest first, limit to 30
  messages.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return messages.slice(0, 30)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const since = Number(req.query.since || 0)
  const messages = await gatherMessages(since)
  return res.json({ messages })
}

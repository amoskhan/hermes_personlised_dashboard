import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const VAULT_DIR = '/home/ubuntu/ObsidianVault'
const NOTES_DIR = path.join(VAULT_DIR, 'Notes')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { name } = req.query
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Missing "name" query param' })
  }

  // Sanitize — prevent path traversal
  const cleanName = name.replace(/\.\.\//g, '').replace(/^~/, '').replace(/[<>"|]/g, '')
  const filePath = path.join(NOTES_DIR, `${cleanName}.md`)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Note not found', name: cleanName })
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  // Extract a short description: first non-empty line after YAML frontmatter, or first paragraph
  let description = ''
  const lines = content.split('\n')
  let inFrontmatter = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true
      continue
    }
    if (inFrontmatter && line.trim() === '---') {
      inFrontmatter = false
      continue
    }
    if (!inFrontmatter && line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('>') && !line.trim().startsWith('- [')) {
      description = line.trim()
      if (description.length > 150) {
        description = description.slice(0, 147) + '…'
      }
      break
    }
  }

  // Get tags from content
  const tags = [...content.matchAll(/#([\w-]+)/g)].map(m => m[1]).filter(
    t => !['daily-log', 'lesson-plan', 'project', 'research'].includes(t.toLowerCase())
  ).slice(0, 8)

  // Get all [[wikilinks]] in the note
  const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].split('|')[0])

  // Get backlinks (notes that link to this note)
  let backlinks: string[] = []
  try {
    const files = fs.readdirSync(NOTES_DIR).filter((f: string) => f.endsWith('.md'))
    backlinks = files
      .filter((f: string) => {
        const fName = f.replace('.md', '')
        if (fName === cleanName) return false
        const fContent = fs.readFileSync(path.join(NOTES_DIR, f), 'utf-8')
        return fContent.includes(`[[${cleanName}]]`)
      })
      .map((f: string) => f.replace('.md', ''))
      .slice(0, 10)
  } catch {}

  const summary = content
    .replace(/---[\s\S]*?---\n?/, '')  // strip frontmatter
    .replace(/^##\s+.*$/gm, '')        // strip headings
    .replace(/\[\[([^\]]+)\]\]/g, '$1')  // unwikilink
    .replace(/[#*_>`~-]{2,}/g, '')     // strip markdown formatting
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 400)

  return res.json({
    name: cleanName,
    description,
    summary: summary + (summary.length >= 400 ? '…' : ''),
    tags,
    links,
    backlinks,
    totalLines: lines.length,
  })
}

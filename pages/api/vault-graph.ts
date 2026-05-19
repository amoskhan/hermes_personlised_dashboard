import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import pathModule from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '/home/ubuntu/ObsidianVault'
    const notesDir = pathModule.join(vaultPath, 'Notes')

    if (!fs.existsSync(notesDir)) {
      return res.json({ nodes: [], links: [] })
    }

    const files = fs.readdirSync(notesDir).filter((f: string) => f.endsWith('.md'))

    // Collect all unique targets from [[wikilinks]] across ALL files
    const allTargets = new Set<string>()
    const fileLinks: { source: string; targets: string[] }[] = []

    for (const f of files) {
      const name = f.replace('.md', '')
      const content = fs.readFileSync(pathModule.join(notesDir, f), 'utf-8')
      const matches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].split('|')[0])
      fileLinks.push({ source: name, targets: matches })
      for (const t of matches) allTargets.add(t)
    }

    // Build nodes: all existing files + any referenced targets that aren't files
    const existingFiles = new Set(files.map((f: string) => f.replace('.md', '')))
    const nodes: { id: string; group: number; size: number }[] = []
    
    for (const f of files) {
      const name = f.replace('.md', '')
      nodes.push({ id: name, group: 1, size: 5 }) // existing notes = group 1
    }
    
    // Add external targets (referenced but not a file) as smaller grey nodes
    for (const target of allTargets) {
      if (!existingFiles.has(target)) {
        nodes.push({ id: target, group: 2, size: 2 }) // external = group 2
      }
    }

    // Build links (every [[wikilink]] becomes an edge)
    const links: { source: string; target: string; count: number }[] = []
    const linkMap = new Map<string, number>()
    
    for (const { source, targets } of fileLinks) {
      for (const target of targets) {
        const key = `${source}::${target}`
        linkMap.set(key, (linkMap.get(key) || 0) + 1)
      }
    }
    
    for (const [key, count] of linkMap) {
      const [source, target] = key.split('::')
      links.push({ source, target, count })
    }

    res.json({ nodes, links })
  } catch (error) {
    console.error('Vault graph error:', error)
    res.json({ nodes: [], links: [] })
  }
}

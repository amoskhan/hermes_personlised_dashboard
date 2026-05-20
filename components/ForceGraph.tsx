import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'

interface GraphNode { id: string; group: number; size: number }
interface GraphLink { source: string; target: string; count: number }
interface GraphData { nodes: GraphNode[]; links: GraphLink[] }

interface NoteContent {
  name: string
  description: string
  summary: string
  fullContent?: string
  tags: string[]
  links: string[]
  backlinks: string[]
  totalLines: number
}

const COLORS = [
  '#6366f1', '#22c55e', '#06b6d4', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
  '#f97316', '#a855f7',
]

export default function ForceGraph({ data }: { data: GraphData }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null)
  const nodeRef = useRef<d3.Selection<SVGCircleElement, any, SVGGElement, unknown> | null>(null)
  const linkRef = useRef<d3.Selection<SVGLineElement, any, SVGGElement, unknown> | null>(null)
  const labelRef = useRef<d3.Selection<SVGTextElement, any, SVGGElement, unknown> | null>(null)
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)

  const [search, setSearch] = useState('')
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; links?: string } | null>(null)
  const [dimensions, setDimensions] = useState({ w: 600, h: 400 })
  const [minConnections, setMinConnections] = useState(0)
  const [focusedNode, setFocusedNode] = useState<string | null>(null)
  const [showNodeList, setShowNodeList] = useState(true)
  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState<NoteContent | null>(null)
  const [loadingNote, setLoadingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  // Store current interaction state in refs so D3 handlers can access latest values
  const stateRef = useRef({ focusedNode: null as string | null, selectedNote: null as string | null, hoveredNode: null as string | null, search: '' })
  stateRef.current = { focusedNode, selectedNote, hoveredNode: null, search }

  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const link of data.links) {
      counts[link.source as string] = (counts[link.source as string] || 0) + 1
      counts[link.target as string] = (counts[link.target as string] || 0) + 1
    }
    return counts
  }, [data])

  const maxConns = useMemo(
    () => Math.max(...data.nodes.map(n => connectionCounts[n.id] || 1), 1),
    [data, connectionCounts]
  )

  const focusSet = useMemo(() => {
    if (!focusedNode) return null
    const connected = new Set<string>([focusedNode])
    for (const link of data.links) {
      if (link.source === focusedNode) connected.add(link.target as string)
      if (link.target === focusedNode) connected.add(link.source as string)
    }
    return connected
  }, [focusedNode, data])

  const { filteredNodes, filteredLinks } = useMemo(() => {
    if (minConnections === 0) {
      return { filteredNodes: data.nodes, filteredLinks: data.links }
    }
    const keep = new Set(
      data.nodes
        .filter(n => (connectionCounts[n.id] || 0) >= minConnections)
        .map(n => n.id)
    )
    for (const link of data.links) {
      if (keep.has(link.source as string) || keep.has(link.target as string)) {
        keep.add(link.source as string)
        keep.add(link.target as string)
      }
    }
    return {
      filteredNodes: data.nodes.filter(n => keep.has(n.id)),
      filteredLinks: data.links.filter(
        l => keep.has(l.source as string) && keep.has(l.target as string)
      ),
    }
  }, [data, minConnections, connectionCounts])

  const sortedNodes = useMemo(() => {
    return [...filteredNodes]
      .filter(n => n.group === 1)
      .sort((a, b) => (connectionCounts[b.id] || 0) - (connectionCounts[a.id] || 0))
  }, [filteredNodes, connectionCounts])

  // Fetch note content
  useEffect(() => {
    if (!selectedNote) {
      setNoteContent(null)
      setNoteError(null)
      return
    }
    const node = data.nodes.find(n => n.id === selectedNote)
    if (node && node.group === 2) {
      const linkingNotes = data.links
        .filter(l => l.target === selectedNote || l.source === selectedNote)
        .map(l => l.source === selectedNote ? l.target : l.source)
      setNoteContent({
        name: selectedNote,
        description: '',
        summary: `🔗 External reference — not a note in your vault.\nReferenced by: ${linkingNotes.join(', ') || 'none'}`,
        tags: [], links: [], backlinks: [], totalLines: 0,
      })
      setNoteError(null)
      setLoadingNote(false)
      return
    }

    setLoadingNote(true)
    setNoteError(null)
    fetch(`/api/note-content?name=${encodeURIComponent(selectedNote)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setNoteError(d.error); setNoteContent(null) }
        else { setNoteContent(d) }
        setLoadingNote(false)
      })
      .catch(() => { setNoteError('Failed to load note'); setLoadingNote(false) })
  }, [selectedNote, data])

  // Resize
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width
        if (w > 0) setDimensions(prev => prev.w !== w ? { w, h: Math.min(420, Math.max(300, w * 0.5)) } : prev)
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const shortId = (id: string) => {
    const s = id.replace(/\.md$/, '').replace(/^.*[/\\]/, '')
    return s.length > 24 ? s.slice(0, 21) + '…' : s
  }

  const nodeColor = (id: string, group: number) => {
    if (group === 2) return '#444466'
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
    return COLORS[Math.abs(hash) % COLORS.length]
  }

  // ────────────────── MAIN D3 RENDER ──────────────────
  // Only runs when data/filter/search/dimensions change — NOT on click/hover
  useEffect(() => {
    if (!svgRef.current || !filteredNodes.length) return

    const { w, h } = dimensions
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svgSelectionRef.current = svg

    const g = svg.append('g')
    gRef.current = g

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => { g.attr('transform', event.transform) })
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.7))
    zoomRef.current = zoom

    const radius = (id: string) => {
      const c = connectionCounts[id] || 1
      return Math.max(4, Math.min(14, (c / maxConns) * 10 + 3))
    }

    const sim = d3.forceSimulation(filteredNodes as any)
      .force('link', d3.forceLink<any, any>(filteredLinks)
        .id((d: any) => d.id)
        .distance(d => 40 + (d.count || 1) * 15))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(d => radius((d as any).id) + 5))
      .alphaDecay(0.02)
    simulationRef.current = sim

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(filteredLinks)
      .join('line')
      .attr('stroke', '#2a2a5e')
      .attr('stroke-width', d => Math.min(d.count, 3))
      .attr('stroke-opacity', d => 0.15 + d.count * 0.08)
    linkRef.current = link as any

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(filteredNodes)
      .join('circle')
      .attr('r', d => radius(d.id))
      .attr('fill', d => nodeColor(d.id, d.group))
      .attr('stroke', d => d.group === 1 ? '#1a1a3e' : 'none')
      .attr('stroke-width', 1)
      .attr('opacity', 0.85)
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )
      .on('mouseenter', (event: MouseEvent, d: any) => {
        const st = stateRef.current
        // Update hovered node visually
        d3.select(event.currentTarget as SVGCircleElement).attr('opacity', 1)
        // Show label for this node
        label.filter((ld: any) => ld.id === d.id).attr('opacity', 1)
        // Tooltip
        const rect = svgRef.current!.getBoundingClientRect()
        const x = event.clientX - rect.left + 12
        const y = event.clientY - rect.top - 8
        const conns = connectionCounts[d.id] || 0
        const connectedNames = filteredLinks
          .filter(l => l.source === d.id || l.target === d.id)
          .map(l => shortId(l.source === d.id ? l.target : l.source))
          .slice(0, 8)
        setTooltip({
          x: Math.min(x, rect.width - 250), y,
          text: `${shortId(d.id)} · ${conns} connection${conns !== 1 ? 's' : ''} · Click to preview`,
          links: connectedNames.length ? connectedNames.join(', ') : undefined,
        })
      })
      .on('mouseleave', (event: MouseEvent, d: any) => {
        const st = stateRef.current
        const dimmed = st.focusedNode && !(d.id === st.focusedNode || (
          data.links.some(l =>
            (l.source === st.focusedNode && l.target === d.id) ||
            (l.target === st.focusedNode && l.source === d.id)
          )
        ))
        d3.select(event.currentTarget as SVGCircleElement).attr('opacity', dimmed ? 0.15 : (d.id === st.selectedNote ? 1 : 0.85))
        // Hide label unless focused/selected
        if (d.id !== st.focusedNode && d.id !== st.selectedNote) {
          label.filter((ld: any) => ld.id === d.id).attr('opacity', 0)
        }
        setTooltip(null)
      })
      .on('click', (event: MouseEvent, d: any) => {
        event.stopPropagation()
        setSelectedNote(prev => prev === d.id ? null : d.id)
        setFocusedNode(prev => prev === d.id ? null : d.id)
        // Zoom to node
        const currentZoom = zoomRef.current
        if (currentZoom && d.x != null && d.y != null) {
          svg.transition().duration(500).call(
            currentZoom.transform,
            d3.zoomIdentity.translate(w / 2 - d.x * 1.3, h / 2 - d.y * 1.3).scale(1.3)
          )
        }
      })
    nodeRef.current = node as any

    // Labels — initially hidden, shown on hover/focus/select
    const label = g.append('g')
      .selectAll('text')
      .data(filteredNodes.filter(n => n.group === 1))
      .join('text')
      .text(d => shortId(d.id))
      .attr('font-size', 10)
      .attr('fill', '#cccce0')
      .attr('font-weight', 500)
      .attr('dx', d => radius(d.id) + 5)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 4px rgba(0,0,0,0.8)')
      .attr('opacity', 0)
    labelRef.current = label as any

    // Click background = clear selection
    svg.on('click', () => {
      setFocusedNode(null)
      setSelectedNote(null)
      const currentZoom = zoomRef.current
      if (currentZoom) {
        svg.transition().duration(500).call(
          currentZoom.transform,
          d3.zoomIdentity.translate(w / 2, h / 2).scale(0.7)
        )
      }
    })

    // Search highlight zoom
    const searchLower = search.toLowerCase()
    if (searchLower) {
      const match = filteredNodes.find(n => n.id.toLowerCase().includes(searchLower))
      if (match) {
        setTimeout(() => {
          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(w / 2 - (match as any).x * 1.5, h / 2 - (match as any).y * 1.5).scale(1.5)
          )
        }, 600)
      }
    }

    // Tick
    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })

    return () => { sim.stop() }
  }, [filteredNodes, filteredLinks, search, dimensions, minConnections])

  // ────────────────── STYLE UPDATES ──────────────────
  // This runs on focus/select changes but does NOT restart the simulation
  useEffect(() => {
    const node = nodeRef.current
    const link = linkRef.current
    const label = labelRef.current
    const sim = simulationRef.current
    if (!node || !link || !label) return

    // Build focus set
    const fs = new Set<string>()
    if (focusedNode) {
      fs.add(focusedNode)
      for (const l of data.links) {
        if (l.source === focusedNode) fs.add(l.target as string)
        if (l.target === focusedNode) fs.add(l.source as string)
      }
    }

    node
      .transition().duration(200)
      .attr('stroke', (d: any) => {
        if (d.id === selectedNote) return '#22c55e'
        if (d.id === focusedNode) return '#818cf8'
        if (focusedNode && fs.has(d.id)) return '#6366f1'
        return d.group === 1 ? '#1a1a3e' : 'none'
      })
      .attr('stroke-width', (d: any) => {
        if (d.id === selectedNote || d.id === focusedNode) return 2.5
        if (focusedNode && fs.has(d.id)) return 2
        return focusedNode ? 0.2 : 1
      })
      .attr('opacity', (d: any) => {
        if (!focusedNode && !selectedNote) return 0.85
        if (d.id === selectedNote || d.id === focusedNode) return 1
        if (focusedNode && fs.has(d.id)) return 1
        return 0.15
      })
      .style('filter', (d: any) => {
        if (d.id === selectedNote) return 'drop-shadow(0 0 8px rgba(34,197,94,0.5))'
        if (d.id === focusedNode) return 'drop-shadow(0 0 8px rgba(99,102,241,0.5))'
        return 'none'
      })

    link
      .transition().duration(200)
      .attr('opacity', (d: any) => {
        if (!focusedNode) return 1
        const s = typeof d.source === 'object' ? d.source.id : d.source
        const t = typeof d.target === 'object' ? d.target.id : d.target
        return (s === focusedNode || t === focusedNode) ? 1 : 0.06
      })

    label
      .attr('opacity', (d: any) => {
        if (d.id === focusedNode || d.id === selectedNote) return 1
        return 0
      })
      .attr('font-size', (d: any) => d.id === focusedNode || d.id === selectedNote ? 11 : 10)
      .attr('fill', (d: any) => d.id === selectedNote ? '#22c55e' : (d.id === focusedNode ? '#f0f0f4' : '#cccce0'))
      .attr('font-weight', (d: any) => d.id === focusedNode || d.id === selectedNote ? 600 : 500)

  }, [focusedNode, selectedNote, data])

  const existingCount = filteredNodes.filter(n => n.group === 1).length
  const externalCount = filteredNodes.filter(n => n.group === 2).length

  if (!data.nodes.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#555577' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🗄️</div>
        <div style={{ fontSize: 13 }}>No vault data to graph</div>
        <div style={{ fontSize: 11, marginTop: 4, color: '#444' }}>Write some notes with [[wikilinks]] to see them here</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="🔍 Search notes..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 120, padding: '6px 10px', fontSize: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6, color: '#ccc', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} />
        {search && (
          <button onClick={() => setSearch('')} style={{
            padding: '4px 10px', fontSize: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6, color: '#888', cursor: 'pointer'
          }}>✕</button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#8888aa' }}>
          <span>Min links</span>
          <select value={minConnections} onChange={e => setMinConnections(Number(e.target.value))}
            style={{
              padding: '4px 6px', fontSize: 11,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, color: '#ccc', outline: 'none',
            }}
          >
            <option value={0}>All</option>
            <option value={1}>≥ 1</option>
            <option value={2}>≥ 2</option>
            <option value={3}>≥ 3</option>
            <option value={4}>≥ 4</option>
          </select>
        </div>
        {focusedNode && (
          <button onClick={() => { setFocusedNode(null); setSelectedNote(null) }}
            style={{
              padding: '4px 10px', fontSize: 11,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 6, color: '#818cf8', cursor: 'pointer'
            }}>✕ Clear</button>
        )}
      </div>

      {/* Graph + Node list */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Graph */}
        <div ref={containerRef} style={{
          flex: showNodeList && !selectedNote ? '1 1 65%' : 1,
          borderRadius: 8, overflow: 'hidden', position: 'relative',
          minHeight: dimensions.h, background: 'rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.03)'
        }}>
          <svg ref={svgRef} style={{ width: '100%', height: dimensions.h, cursor: 'grab' }} />
          {tooltip && (
            <div style={{
              position: 'absolute', left: tooltip.x, top: tooltip.y,
              background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 8, padding: '6px 12px', fontSize: 11,
              color: '#ccc', pointerEvents: 'none',
              backdropFilter: 'blur(6px)', zIndex: 10, maxWidth: 280,
            }}>
              <div style={{ fontWeight: 600, color: '#e0e0f0', marginBottom: tooltip.links ? 3 : 0 }}>
                {tooltip.text}
              </div>
              {tooltip.links && (
                <div style={{ fontSize: 10, color: '#8888aa', lineHeight: 1.5 }}>→ {tooltip.links}</div>
              )}
            </div>
          )}
        </div>

        {/* Note Preview — Fullscreen Modal */}
        {selectedNote && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }} onClick={() => { setSelectedNote(null); setFocusedNode(null) }}>
            <div style={{
              background: '#0d0d16',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 800,
              maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }} onClick={e => e.stopPropagation()}>
              {loadingNote ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#8888aa', fontSize: 14 }}>Loading...</div>
              ) : noteError ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>⚠️ {noteError}</div>
              ) : noteContent && (
                <>
                  {/* Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', marginBottom: 2 }}>
                        📄 {noteContent.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 12 }}>
                        <span>{noteContent.totalLines} lines</span>
                        {noteContent.tags.length > 0 && <span>{noteContent.tags.length} tags</span>}
                        {noteContent.links.length > 0 && <span>🔗 {noteContent.links.length} links</span>}
                        {noteContent.backlinks.length > 0 && <span>↩️ {noteContent.backlinks.length} backlinks</span>}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedNote(null); setFocusedNode(null) }}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: 'none',
                        color: '#888', cursor: 'pointer', fontSize: 22,
                        padding: '4px 10px', borderRadius: 8, lineHeight: 1,
                      }}>✕</button>
                  </div>

                  {/* Tags */}
                  {noteContent.tags.length > 0 && (
                    <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {noteContent.tags.map((t, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '3px 8px',
                          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.1)',
                          borderRadius: 4, color: '#8888aa'
                        }}>#{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Content body */}
                  <div style={{
                    flex: 1, overflowY: 'auto', padding: '16px 20px',
                    fontSize: 13, lineHeight: 1.7, color: '#d0d0e0',
                    whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', 'Menlo', monospace",
                  }}>
                    {noteContent.summary || noteContent.description || (
                      <span style={{ color: '#666', fontStyle: 'italic' }}>Empty note</span>
                    )}
                  </div>

                  {/* Links & Backlinks footer */}
                  {(noteContent.links.length > 0 || noteContent.backlinks.length > 0) && (
                    <div style={{
                      padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', gap: 20,
                    }}>
                      {noteContent.links.length > 0 && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            🔗 Links to ({noteContent.links.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {noteContent.links.slice(0, 20).map((link, i) => (
                              <span key={i} style={{
                                fontSize: 11, padding: '3px 8px',
                                background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.08)',
                                borderRadius: 4, color: '#06b6d4', cursor: 'pointer',
                              }} onClick={() => setSelectedNote(link)}>
                                {shortId(link)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {noteContent.backlinks.length > 0 && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            ↩️ Linked from ({noteContent.backlinks.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {noteContent.backlinks.slice(0, 20).map((bl, i) => (
                              <span key={i} style={{
                                fontSize: 11, padding: '3px 8px',
                                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.08)',
                                borderRadius: 4, color: '#f59e0b', cursor: 'pointer',
                              }} onClick={() => setSelectedNote(bl)}>
                                {shortId(bl)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Node list (only when no preview open) */}
        {!selectedNote && showNodeList && sortedNodes.length > 0 && (
          <div style={{
            flex: '0 0 35%', maxHeight: dimensions.h, overflowY: 'auto',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)',
            background: 'rgba(0,0,0,0.1)', padding: '8px',
          }}>
            <div style={{ fontSize: 10, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, padding: '0 4px' }}>
              Notes ({sortedNodes.length})
            </div>
            {sortedNodes.map(n => {
              const conns = connectionCounts[n.id] || 0
              const isActive = selectedNote === n.id
              return (
                <div key={n.id}
                  onClick={() => { setSelectedNote(n.id); setFocusedNode(n.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                    fontSize: 11, marginBottom: 2,
                    background: isActive ? 'rgba(34,197,94,0.08)' : 'transparent',
                    color: isActive ? '#22c55e' : '#aaa',
                    border: `1px solid ${isActive ? 'rgba(34,197,94,0.15)' : 'transparent'}`,
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: nodeColor(n.id, n.group), flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortId(n.id)}</span>
                  <span style={{ fontSize: 9, color: '#666', flexShrink: 0 }}>{conns} link{conns !== 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10,
        fontSize: 11, alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#8888aa', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[0], display: 'inline-block' }} />
            {existingCount} notes
          </span>
          <span style={{ color: '#666688', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#444466', display: 'inline-block' }} />
            {externalCount} refs
          </span>
          <span style={{ color: '#666688' }}>🔗 {filteredLinks.length} connections</span>
          {selectedNote && noteContent && (
            <span style={{ color: '#22c55e' }}>📖 Previewing: {shortId(selectedNote)}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNodeList(!showNodeList)}
            style={{
              padding: '3px 10px', fontSize: 10,
              background: showNodeList ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${showNodeList ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 4, color: showNodeList ? '#818cf8' : '#666', cursor: 'pointer'
            }}>
            {showNodeList ? 'Hide list' : 'Show list'}
          </button>
          <span style={{ color: '#555577', fontSize: 10 }}>
            Click node to preview · Hover for labels · Scroll to zoom
          </span>
        </div>
      </div>
    </div>
  )
}

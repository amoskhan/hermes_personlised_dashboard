import { useState } from 'react'

const NODES = [
  { id: 'you',       x: 45,  y: 50,  w: 140, h: 45,  label: 'You',          icon: '👤', color: '#4ade80', bg: '#0f472a', desc: 'You interact with Hermes via Telegram. Send voice notes, text, or requests — Hermes responds with full context from past conversations.' },
  { id: 'telegram',  x: 45,  y: 115, w: 140, h: 45,  label: 'Telegram',     icon: '💬', color: '#60a5fa', bg: '#1e3a8a', desc: 'Your messaging platform. Messages are routed to Hermes Agent for AI processing. Supports voice notes, images, and links.' },
  { id: 'hermes',    x: 275, y: 60,  w: 170, h: 85,  label: 'Hermes Agent', icon: '🧠', color: '#c084fc', bg: '#3f1e5e', desc: 'The AI brain — powered by your active model. Decides which tools to call, reads/writes memory, and responds intelligently to your requests.' },
  { id: 'cron',      x: 275, y: 185, w: 170, h: 45,  label: 'Cron Jobs',    icon: '⏰', color: '#22d3ee', bg: '#0e4849', desc: 'Background automations: Daily Standup Briefing (7am), Vault Pipeline (7:10am), Dreaming Engine (6am), Weekly Synthesis (Sunday).' },
  { id: 'skills',    x: 535, y: 50,  w: 170, h: 65,  label: 'Skills & Tools', icon: '🔧', color: '#fbbf24', bg: '#5d2e0f', desc: 'Calendar, GitHub, Research, Memory, Files, Terminal, Maps, Spotify, YouTube, and 20+ more tools — each a specialized capability.' },
  { id: 'vault',     x: 535, y: 130, w: 170, h: 45,  label: 'Obsidian Vault', icon: '📓', color: '#e879f9', bg: '#522e5e', desc: 'Your knowledge base — 95+ notes in flat Karpathy-style structure. Daily notes, wiki entities, research, lesson plans.' },
  { id: 'kb',        x: 535, y: 185, w: 170, h: 45,  label: 'Knowledge Base', icon: '💾', color: '#f472b6', bg: '#5e1e3e', desc: 'Persistent memory across sessions. Stores your profile, environment facts, preferences, and project conventions.' },
  { id: 'dashboard', x: 535, y: 240, w: 170, h: 45,  label: 'Dashboard',    icon: '📊', color: '#06b6d4', bg: '#164e63', desc: 'Visual OS — model usage, vault graph, calendar, badminton training, live messages, dreaming engine suggestions.' },
  { id: 'vps',       x: 45,  y: 325, w: 660, h: 50,  label: 'VPS Server',   icon: '🖥️', color: '#cbd5e1', bg: '#1e293b', desc: 'Your server at 43.156.249.23. Runs Hermes, the dashboard (port 3001), cron jobs, and git sync for the Obsidian vault.' },
]

const SKILL_LABELS = ['Calendar', 'GitHub', 'Research', 'Memory', 'Files']

const ARROWS = [
  { from: 'you',   to: 'telegram', label: 'Messages' },
  { from: 'telegram', to: 'you',   label: 'Replies' },
  { from: 'telegram', to: 'hermes', label: 'Prompts' },
  { from: 'hermes',   to: 'telegram', label: 'Responses' },
  { from: 'hermes',   to: 'skills',   label: 'Calls tools',   labelY: -20 },
  { from: 'hermes',   to: 'vault',    label: 'Reads & writes', labelY: -5 },
  { from: 'hermes',   to: 'kb',       label: 'Read/Writes',    labelY: 0 },
  { from: 'hermes',   to: 'dashboard', label: 'Data push',     labelY: 10 },
  { from: 'cron',     to: 'hermes',   label: 'Triggers' },
  { from: 'vps',      to: 'hermes',   label: 'Runs', labelY: -10 },
  { from: 'vps',      to: 'dashboard', label: 'Hosts' },
  { from: 'vps',      to: 'cron',     label: 'Schedules' },
]

function getEdge(id: string, side: 'left' | 'right' | 'top' | 'bottom'): [number, number] {
  const n = NODES.find(x => x.id === id)!
  if (side === 'left')   return [n.x,         n.y + n.h / 2]
  if (side === 'right')  return [n.x + n.w,   n.y + n.h / 2]
  if (side === 'top')    return [n.x + n.w/2, n.y]
  if (side === 'bottom') return [n.x + n.w/2, n.y + n.h]
  return [n.x + n.w/2, n.y + n.h/2]
}

function arrowPath(from: string, to: string): string {
  const f = NODES.find(x => x.id === from)!
  const t = NODES.find(x => x.id === to)!
  const fcx = f.x + f.w / 2, fcy = f.y + f.h / 2
  const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2
  const dx = tcx - fcx, dy = tcy - fcy

  let fSide: 'left' | 'right' | 'top' | 'bottom'
  let tSide: 'left' | 'right' | 'top' | 'bottom'
  if (Math.abs(dx) > Math.abs(dy)) {
    fSide = dx > 0 ? 'right' : 'left'
    tSide = dx > 0 ? 'left' : 'right'
  } else {
    fSide = dy > 0 ? 'bottom' : 'top'
    tSide = dy > 0 ? 'top' : 'bottom'
  }
  const [sx, sy] = getEdge(from, fSide)
  const [ex, ey] = getEdge(to, tSide)

  const cx = (sx + ex) / 2
  const cy = (sy + ey) / 2
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
}

function arrowLabelPos(from: string, to: string, labelYOffset = 0) {
  const f = NODES.find(x => x.id === from)!
  const t = NODES.find(x => x.id === to)!
  const offset = labelYOffset * (f.id === 'hermes' ? 1.5 : 1)
  return { x: (f.x + f.w/2 + t.x + t.w/2) / 2, y: (f.y + f.h/2 + t.y + t.h/2) / 2 - 14 + offset }
}

export default function HermesFlow() {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltipNode, setTooltipNode] = useState<typeof NODES[0] | null>(null)

  const selectedNode = NODES.find(n => n.id === selected)
  const hoverInfo = tooltipNode || selectedNode

  const isHighlighted = (id: string) => {
    if (!selected && !hovered) return true
    const active = selected || hovered
    if (id === active) return true
    return ARROWS.some(a => (a.from === active && a.to === id) || (a.to === active && a.from === id))
  }

  return (
    <div className="glass-card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 30 }}>🧠</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              <span className="title-gradient">How Hermes Works</span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#aab' }}>
              Architecture overview — hover to explore · click to pin
            </p>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', paddingBottom: '40%', background: 'radial-gradient(ellipse at center, #0f172a 0%, #030712 100%)', minHeight: '300px' }}>
        <svg viewBox="0 0 1040 420" preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}>
          <defs>
          <filter id="hf-shadow">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.7" />
          </filter>
          <filter id="hf-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <marker id="hf-arrow" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill="#7c3aed" />
          </marker>
          <marker id="hf-arrow-active" markerWidth="7" markerHeight="5.5" refX="7" refY="2.75" orient="auto">
            <polygon points="0 0, 7 2.75, 0 5.5" fill="#c084fc" />
          </marker>
        </defs>

        <rect x="0" y="0" width="1040" height="420" fill="#030712" rx="0" />

        {/* Zone boxes with enhanced styling */}
        {[
          { x: 25, y: 30, w: 200, h: 145, nodes: ['you', 'telegram'], color: '#4ade80' },
          { x: 255, y: 30, w: 210, h: 215, nodes: ['hermes', 'cron'], color: '#c084fc' },
          { x: 515, y: 30, w: 210, h: 270, nodes: ['skills', 'vault', 'kb', 'dashboard'], color: '#fbbf24' },
          { x: 25, y: 305, w: 700, h: 85, nodes: ['vps'], color: '#cbd5e1' },
        ].map(z => {
          const zoneHovered = (hovered || selected) && z.nodes.includes(hovered || selected!)
          return (
            <g key={z.x + '' + z.y}>
              {/* Zone background glow */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h}
                rx="8" fill={z.color} opacity={zoneHovered ? 0.05 : 0.02}
                style={{ transition: 'opacity 0.3s' }}
              />
              {/* Zone border */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h}
                rx="8" fill="none"
                stroke={zoneHovered ? z.color : '#ffffff08'}
                strokeWidth={zoneHovered ? 2 : 1}
                style={{ transition: 'stroke 0.3s, strokeWidth 0.3s' }}
              />
            </g>
          )
        })}

        {/* Zone labels */}
        {[
          { x: 125, y: 48, text: 'USER', nodes: ['you', 'telegram'], color: '#4ade80' },
          { x: 360, y: 48, text: 'AGENT & AUTOMATIONS', nodes: ['hermes', 'cron'], color: '#c084fc' },
          { x: 620, y: 48, text: 'TOOLS & DATA', nodes: ['skills', 'vault', 'kb', 'dashboard'], color: '#fbbf24' },
          { x: 375, y: 335, text: 'INFRASTRUCTURE', nodes: ['vps'], color: '#cbd5e1' },
        ].map(z => {
          const za = (hovered || selected) && z.nodes.includes(hovered || selected!)
          return (
            <g key={z.text}>
              {/* Text background for readability */}
              <rect x={z.x - 55} y={z.y - 11} width={110} height={16}
                fill={z.color} opacity={0.08} rx={3}
              />
              <text x={z.x} y={z.y}
                fill={za ? z.color : '#64748b'}
                fontSize={11} textAnchor="middle" fontWeight={700} letterSpacing="2"
                style={{ transition: 'fill 0.3s', textShadow: za ? `0 0 12px ${z.color}60` : 'none' }}>
                {z.text}
              </text>
            </g>
          )
        })}

        {/* Arrows */}
        {ARROWS.map(a => {
          const hl = isHighlighted(a.from) && isHighlighted(a.to)
          const path = arrowPath(a.from, a.to)
          const lp = arrowLabelPos(a.from, a.to, (a as any).labelY ?? 0)
          return (
            <g key={`${a.from}-${a.to}`}>
              {/* Arrow glow on active */}
              {hl && (
                <path d={path} fill="none"
                  stroke="#c084fc" strokeWidth={5.5}
                  strokeOpacity={0.15}
                  style={{ transition: 'all 0.3s' }}
                />
              )}
              <path d={path} fill="none"
                stroke={hl ? '#c084fc' : '#7c3aed'}
                strokeWidth={hl ? 2.2 : 1.2}
                strokeOpacity={hl ? 1 : 0.4}
                markerEnd={hl ? 'url(#hf-arrow-active)' : 'url(#hf-arrow)'}
                style={{ transition: 'all 0.3s' }}
              />
              {/* Label background */}
              <rect x={lp.x - 28} y={lp.y - 10} width={56} height={14}
                fill="#030712" opacity={0.8} rx={3}
              />
              <text x={lp.x} y={lp.y}
                fill={hl ? '#e0c7fc' : '#b4a3d1'}
                fontSize={9} textAnchor="middle" fontWeight={hl ? 700 : 600}
                style={{ transition: 'all 0.3s', pointerEvents: 'none' }}>
                {a.label}
              </text>
            </g>
          )
        })}

        {/* Skill sub-labels */}
        {SKILL_LABELS.map((s, i) => {
          const sh = hovered === 'skills' || selected === 'skills'
          return (
            <g key={s}>
              <rect x={545} y={58 + i * 11} width={75} height={10}
                fill={sh ? '#fbbf24' : '#1e1b4b'} opacity={sh ? 0.1 : 0.05} rx={2}
              />
              <text x={548} y={65 + i * 11}
                fill={sh ? '#fcd34d' : '#d1d5db'}
                fontSize={9} fontWeight={sh ? 700 : 600}
                style={{ transition: 'all 0.3s', pointerEvents: 'none' }}>
                {sh ? '▶' : '▸'} {s}
              </text>
            </g>
          )
        })}
        <text x={650} y={88} fill="#6b7280" fontSize={8} fontStyle="italic">+20 more</text>

        {/* Sub-label highlights */}
        {[
          { id: 'vault', x: 545, y: 158, text: '95+ notes', color: '#e879f9' },
          { id: 'kb', x: 545, y: 208, text: 'Session memory', color: '#f472b6' },
          { id: 'dashboard', x: 545, y: 260, text: 'Live widgets', color: '#06b6d4' },
          { id: 'cron', x: 285, y: 220, text: '07:00 + 07:10 AM', color: '#22d3ee' },
        ].map(s => (
          <g key={s.id}>
            <rect x={s.x - 2} y={s.y - 11} width={130} height={14}
              fill={s.color} opacity={(hovered || selected) === s.id ? 0.12 : 0.04} rx={2}
            />
            <text x={s.x} y={s.y}
              fill={(hovered || selected) === s.id ? s.color : '#6b7280'}
              fontSize={8} fontWeight={500} style={{ transition: 'fill 0.3s', pointerEvents: 'none' }}>
              {s.text}
            </text>
          </g>
        ))}

        {/* Nodes */}
        {NODES.map(n => {
          const hl = isHighlighted(n.id)
          const isHovered = hovered === n.id
          const isSelected = selected === n.id
          const dimmed = (selected || hovered) && !hl
          const active = isHovered || isSelected

          return (
            <g key={n.id}
              onMouseEnter={() => { setHovered(n.id); setTooltipNode(n) }}
              onMouseLeave={() => { setHovered(null); setTooltipNode(null) }}
              onClick={() => setSelected(isSelected ? null : n.id)}
              style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
              opacity={dimmed ? 0.2 : 1}
            >
              {/* Outer glow ring on active */}
              {active && (
                <rect x={n.x - 10} y={n.y - 10} width={n.w + 20} height={n.h + 20}
                  rx={14} ry={14} fill="none" stroke={n.color} strokeWidth={3}
                  strokeOpacity={0.15} style={{ transition: 'all 0.3s' }} />
              )}

              {/* Main node box */}
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} ry={10}
                fill={n.bg}
                stroke={isSelected ? n.color : (isHovered ? n.color : n.color + '40')}
                strokeWidth={isSelected ? 2.2 : (isHovered ? 1.8 : 1.2)}
                filter={active ? "url(#hf-shadow)" : undefined}
                style={{ transition: 'stroke 0.3s, strokeWidth 0.3s' }}
              />

              {/* Text background for better contrast */}
              <rect x={n.x + 5} y={n.y + 8} width={n.w - 10} height={n.h - 16} rx={6}
                fill={n.color} opacity={0.1}
                pointerEvents="none"
              />

              <text x={n.x + 20} y={n.y + n.h / 2 + 5}
                fontSize={18} textAnchor="middle" dominantBaseline="middle"
                pointerEvents="none">
                {n.icon}
              </text>

              <text x={n.x + 32} y={n.y + n.h / 2}
                fill={active ? n.color : '#fff'}
                fontSize={10} fontWeight={active ? 700 : 700}
                style={{ transition: 'fill 0.3s', pointerEvents: 'none' }}>
                {isHovered ? `→ ${n.label}` : n.label}
              </text>
            </g>
          )
        })}

        {/* VPS IP */}
        <text x={375} y={368}
          fill={(hovered || selected) === 'vps' ? '#cbd5e1' : '#475569'}
          fontSize={7.5} textAnchor="middle" fontWeight={500} style={{ transition: 'fill 0.3s' }}>
          43.156.249.23
        </text>
      </svg>
      </div>

      {/* ─── Hover / Selected Info Bar ─── */}
      {hoverInfo && (
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: `linear-gradient(135deg, ${hoverInfo.bg}40 0%, rgba(15,10,25,0.6) 100%)`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          animation: 'hfFadeIn 0.2s ease-out',
          backdropFilter: 'blur(10px)',
        }}>
          <span style={{ fontSize: 32, flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' }}>{hoverInfo.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: hoverInfo.color }}>
                {hoverInfo.label}
              </span>
              {/* Show connections count badge */}
              <span style={{
                fontSize: 9, padding: '3px 8px', borderRadius: 12,
                background: hoverInfo.color + '20', color: hoverInfo.color,
                border: `1px solid ${hoverInfo.color}40`,
                fontWeight: 600,
              }}>
                {ARROWS.filter(a => a.from === hoverInfo.id || a.to === hoverInfo.id).length} connections
              </span>
              {selected === hoverInfo.id && (
                <span style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 500 }}>· pinned</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>
              {hoverInfo.desc}
            </div>
            {/* Connection chips (only when pinned / selected) */}
            {selected === hoverInfo.id && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ARROWS.filter(a => a.from === hoverInfo.id).map(a => (
                  <span key={a.to} style={{
                    fontSize: 9, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)',
                    color: '#d8b4fe', fontWeight: 500
                  }}>
                    → {NODES.find(n => n.id === a.to)?.label || a.to}
                  </span>
                ))}
                {ARROWS.filter(a => a.to === hoverInfo.id).map(a => (
                  <span key={a.from} style={{
                    fontSize: 9, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)',
                    color: '#d8b4fe', fontWeight: 500
                  }}>
                    ← {NODES.find(n => n.id === a.from)?.label || a.from}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Close button — only when pinned */}
          {selected === hoverInfo.id && (
            <button onClick={() => setSelected(null)}
              style={{
                background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
                color: '#c084fc', cursor: 'pointer', fontSize: 18,
                padding: '4px 10px', borderRadius: 6, lineHeight: 1.2, flexShrink: 0,
                fontWeight: 600, transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 12, color: '#6b7280', display: 'flex', justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <span>👆 Hover for info · Click to pin details</span>
        <span style={{ color: '#4b5563' }}>{NODES.length} components · {ARROWS.length} connections</span>
      </div>

      <style>{`
        @keyframes hfFadeIn {
          from { 
            opacity: 0;
            transform: translateY(-4px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

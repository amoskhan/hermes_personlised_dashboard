import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import ForceGraph from '../../components/ForceGraph'
import LiveMessages from '../../components/LiveMessages'

type UsageData = {
  totalCost: number
  creditsRemaining: number
  model: string
  dailyUsage: { date: string; cost: number; tokens: number }[]
}

type VaultStats = {
  totalNotes: number
  recentlyModified: string[]
  brokenLinks: number
  vaultSize: string
  totalLinks: number
}

type DreamingRec = {
  type: string
  message: string
  priority: 'high' | 'medium' | 'low'
}

type DailySummary = {
  date: string
  dayName: string
  dayTheme: string
  greeting: string
  hasNote: boolean
  yesterday: { date: string; hasNote: boolean; items: string[]; total: number }
  todayPlan: string[]
  weekly: {
    summary: string
    tags: { tag: string; count: number }[]
    activeDays: number
    days: { date: string; theme: string; day: string }[]
  }
  suggestions: { category: string; text: string }[]
}

type CalendarEvent = {
  id: string
  summary: string
  start: string
  end: string
  location: string
  isAllDay: boolean
}

type ModelInfo = {
  id: string
  name: string
  provider: string
  costPer1kTokens: number
}

function formatSGD(n: number): string {
  if (n >= 1000) return `S$${(n / 1000).toFixed(1)}k`
  return `S$${n.toFixed(2)}`
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Dashboard() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [vault, setVault] = useState<VaultStats | null>(null)
  const [dreaming, setDreaming] = useState<DreamingRec[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [calendar, setCalendar] = useState<{ date: string; events: CalendarEvent[] } | null>(null)
  const [personas, setPersonas] = useState<{ personas: {id:string,name:string,description:string,emoji:string}[], active: string } | null>(null)
  const [github, setGithub] = useState<{ repos: any[], total_commits: number } | null>(null)
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] })
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [time, setTime] = useState(new Date())
  const [showOnboard, setShowOnboard] = useState(true)

  useEffect(() => {
    fetch('/api/usage').then(r => r.json()).then(setUsage).catch(() => {})
    fetch('/api/vault-stats').then(r => r.json()).then(setVault).catch(() => {})
    fetch('/api/dreaming').then(r => r.json()).then(setDreaming).catch(() => {})
    fetch('/api/models').then(r => r.json()).then(setModels).catch(() => {})
    fetch('/api/calendar').then(r => r.json()).then(setCalendar).catch(() => {})
    fetch('/api/personas').then(r => r.json()).then(setPersonas).catch(() => {})
    fetch('/api/github').then(r => r.json()).then(setGithub).catch(() => {})
    fetch('/api/vault-graph').then(r => r.json()).then(setGraphData).catch(() => {})
    fetch('/api/daily-summary').then(r => r.json()).then(setDailySummary).catch(() => {})
    const t = setInterval(() => setTime(new Date()), 1000)
    const refresh = setInterval(() => {
      fetch('/api/usage').then(r => r.json()).then(setUsage).catch(() => {})
    }, 30000)
    return () => { clearInterval(t); clearInterval(refresh) }
  }, [])

  const totalMonthly = usage?.totalCost || 0
  const subsTotal = 55
  const hoursSaved = 8
  const hourlyRate = 31.50
  const monthlyValue = hoursSaved * hourlyRate * 4.33
  const netRoi = monthlyValue - subsTotal

  // Mini bar data
  const maxToken = Math.max(...(usage?.dailyUsage.map(d => d.tokens) || [1]), 1)

  const modelTag = usage?.model || 'deepseek-v4-flash'
  const isFree = usage?.totalCost === 0

  return (
    <div style={{ padding: '20px 28px', maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>

      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 28, paddingTop: 8
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 30, fontWeight: 800,
            letterSpacing: '-0.03em'
          }}>
            <span className="title-gradient">Visual OS</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            <span className="glow-dot green pulse" /> All systems nominal
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
            {time.toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="time-display" style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg, #f0f0f4, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {time.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* ─── Onboarding Banner ─── */}
      <div className={`onboard-banner ${!showOnboard ? 'dismissed' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🚀</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e0e0f0' }}>Onboarding Complete</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-emerald)' }}>●</span> OpenRouter ·{' '}
                <span style={{ color: 'var(--accent-emerald)' }}>●</span> Obsidian Vault ·{' '}
                <span style={{ color: 'var(--accent-emerald)' }}>●</span> Hermes Agent ·{' '}
                <span style={{ color: 'var(--accent-emerald)' }}>●</span> Cron Jobs
              </p>
            </div>
          </div>
          <button onClick={() => setShowOnboard(false)}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-muted)', padding: '6px 14px', borderRadius: 8,
              cursor: 'pointer', fontSize: 12, transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            Dismiss ✕
          </button>
        </div>
      </div>

      {/* ─── Quick Stats Bar ─── */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap',
        marginTop: 20, marginBottom: 24
      }}>
        <span className="top-stat-chip">
          🎯 <strong>{modelTag}</strong>
        </span>
        <span className="top-stat-chip">
          💰 <strong>{formatSGD(totalMonthly)}</strong> this month
        </span>
        <span className="top-stat-chip">
          📓 <strong>{vault?.totalNotes || '—'}</strong> notes
        </span>
        <span className="top-stat-chip">
          📈 <strong>{netRoi >= 0 ? '+' : ''}S${netRoi.toFixed(0)}</strong> monthly ROI
        </span>
        {vault && vault.brokenLinks > 0 && (
          <span className="top-stat-chip" style={{ borderColor: 'rgba(245,158,11,0.2)', color: 'var(--accent-amber)' }}>
            ⚠️ <strong>{vault.brokenLinks}</strong> broken links
          </span>
        )}
      </div>

      {/* ─── Daily Summary Card ─── */}
      {dailySummary && dailySummary.yesterday && (
        <div className="glass-card" style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(13,18,38,0.92) 0%, rgba(30,12,48,0.92) 100%)',
          border: '1px solid rgba(99,102,241,0.12)',
          borderRadius: 14, padding: '20px 24px',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: '-50px', right: '-40px',
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🌅</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {dailySummary.greeting}, Amos
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                {dailySummary.dayName} · {dailySummary.date}
                {dailySummary.dayTheme && dailySummary.dayTheme !== dailySummary.dayName && (
                  <> · <span style={{ color: 'var(--accent-indigo)' }}>{dailySummary.dayTheme}</span></>
                )}
              </p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.1)' }}>
              {dailySummary.hasNote ? '📓 Note logged' : '📓 No note yet'}
            </span>
          </div>

          {/* 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 16 }}>

            {/* ─── Column 1: Yesterday ─── */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🔙</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Yesterday
                </span>
                {dailySummary.yesterday.total > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>{dailySummary.yesterday.total} items</span>
                )}
              </div>
              {dailySummary.yesterday.items && dailySummary.yesterday.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {dailySummary.yesterday.items.map((item, i) => {
                    const isChecked = item.startsWith('[x]') || item.startsWith('[X]')
                    const text = item.replace(/^\[.\]\s*/, '').trim()
                    return (
                      <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: isChecked ? 'var(--accent-emerald)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <span style={{ flexShrink: 0 }}>{isChecked ? '✅' : '◻️'}</span>
                        <span>{text.length > 80 ? text.substring(0, 80) + '…' : text}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No yesterday note recorded</div>
              )}
            </div>

            {/* ─── Column 2: This Week ─── */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  This Week
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>
                  {dailySummary.weekly?.activeDays || 0} days logged
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-indigo)', fontWeight: 500, marginBottom: 8 }}>
                {dailySummary.weekly?.summary || 'No data'}
              </div>
              {dailySummary.weekly?.tags && dailySummary.weekly.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {dailySummary.weekly.tags.slice(0, 4).map((t, i) => (
                    <span key={i} style={{
                      fontSize: 9, padding: '2px 7px',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.1)',
                      borderRadius: 4, color: 'var(--text-secondary)'
                    }}>
                      #{t.tag} ×{t.count}
                    </span>
                  ))}
                </div>
              )}
              {dailySummary.weekly?.days && dailySummary.weekly.days.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {dailySummary.weekly.days.slice(0, 7).map((d, i) => {
                    const hasTheme = !!d.theme
                    return (
                      <span key={i} style={{
                        width: 22, height: 22, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 600,
                        background: hasTheme ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                        color: hasTheme ? 'var(--accent-indigo)' : 'var(--text-muted)',
                        border: `1px solid ${hasTheme ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'}`,
                        cursor: 'pointer'
                      }} title={d.theme || d.day}>
                        {d.day[0]}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ─── Column 3: Today's Suggestions ─── */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.03) 100%)',
              border: '1px solid rgba(99,102,241,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>💡</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Today's Suggestions
                </span>
              </div>
              {dailySummary.suggestions && dailySummary.suggestions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {dailySummary.suggestions.map((s, i) => {
                    const iconMap: Record<string, string> = {
                      pe_coaching: '🏃', research: '🔬', coding: '💻',
                      vault: '📝', finance: '💰', wellness: '🧘',
                      badminton: '🏸', career: '🎯'
                    }
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: '8px 10px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                        transition: 'all 0.2s'
                      }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                          {iconMap[s.category] || '💡'}
                        </span>
                        <span style={{ fontSize: 11, color: '#cccce0', lineHeight: 1.4 }}>
                          {s.text}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading suggestions…</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ─── TOP ROW: Model Status + Memory ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Model Status */}
        <div className="glass-card dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Model Status</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Token usage & cost overview</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="stat-tile">
              <div className="label">Active Model</div>
              <div className="value small">{modelTag}</div>
              <div style={{ fontSize: 10, color: isFree ? 'var(--accent-emerald)' : 'var(--accent-cyan)', marginTop: 2 }}>
                {isFree ? '🆓 Free tier' : '💰 Paid model'}
              </div>
            </div>
            <div className="stat-tile">
              <div className="label">Monthly Spend</div>
              <div className={`value ${totalMonthly === 0 ? 'green' : 'amber'}`}>{formatSGD(totalMonthly)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Credits Left</div>
              <div className="value small cyan">{usage ? `S$${(usage.creditsRemaining || 0).toFixed(2)}` : '—'}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Subscriptions</div>
              <div className="value small">S${subsTotal}/mo</div>
            </div>
          </div>

          {/* Mini bar chart - token usage */}
          {usage?.dailyUsage && usage.dailyUsage.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>7-Day Token Activity</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  max: {(maxToken / 1000).toFixed(0)}k tokens
                </span>
              </div>
              <div className="mini-bar-wrap">
                {usage.dailyUsage.map((d, i) => {
                  const h = Math.max(4, (d.tokens / maxToken) * 38)
                  const isToday = i === usage.dailyUsage.length - 1
                  const color = isToday
                    ? 'var(--accent-indigo)'
                    : d.tokens > maxToken * 0.7
                      ? 'var(--accent-cyan)'
                      : d.tokens > maxToken * 0.3
                        ? 'var(--accent-indigo)'
                        : 'rgba(99,102,241,0.3)'
                  return (
                    <div key={i} className="mini-bar"
                      title={`${d.date}: ${(d.tokens / 1000).toFixed(0)}k tokens`}
                      style={{ height: h, background: color, opacity: isToday ? 1 : 0.7 }} />
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                {usage.dailyUsage.map((d, i) => (
                  <span key={i} style={{ opacity: i % 2 === 0 ? 1 : 0.4 }}>{d.date}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recharts area chart */}
          {usage?.dailyUsage && usage.dailyUsage.length > 1 && (
            <div style={{ marginTop: 16, height: 110 }}>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={usage.dailyUsage}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555577' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#555577' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(13,13,22,0.95)', border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 8, fontSize: 11, backdropFilter: 'blur(8px)'
                    }}
                    itemStyle={{ color: '#e0e0f0' }}
                    labelStyle={{ color: '#8888aa' }}
                  />
                  <Area
                    type="monotone" dataKey="tokens"
                    stroke="#6366f1" fillOpacity={1} fill="url(#colorTokens)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#818cf8', stroke: '#6366f1', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Memory Map */}
        <div className="glass-card cyan dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22 }}>🧠</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Memory Map</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Obsidian vault graph</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="stat-tile">
              <div className="label">Vault Notes</div>
              <div className={`value small ${vault?.totalNotes ? 'indigo' : ''}`}>{vault?.totalNotes || '—'}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Total Links</div>
              <div className={`value small ${vault?.totalLinks ? 'cyan' : ''}`}>{vault?.totalLinks || '—'}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Vault Size</div>
              <div className="value small">{vault?.vaultSize || '—'}</div>
            </div>
          </div>

          {graphData.nodes.length > 0 && graphData.nodes.length <= 200 ? (
            <ForceGraph data={graphData} />
          ) : (
            <div className="empty-state">
              <div className="icon">🗄️</div>
              <div className="text">
                {graphData.nodes.length > 200
                  ? `${graphData.nodes.length} nodes — too many to graph`
                  : 'No vault data to graph'}
              </div>
              <div className="sub">Sync Obsidian to populate the graph</div>
            </div>
          )}

          {vault && (
            <div style={{
              marginTop: 12, fontSize: 11,
              color: vault.brokenLinks > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)',
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <span className={`glow-dot ${vault.brokenLinks > 0 ? 'amber' : 'green'}`}
                style={vault.brokenLinks === 0 ? { animation: 'pulse-glow 3s ease-in-out infinite' } : {}} />
              {vault.brokenLinks > 0
                ? `⚠ ${vault.brokenLinks} broken link(s) — review needed`
                : 'All links healthy'}
            </div>
          )}

          {/* Recently modified */}
          {vault && vault.recentlyModified.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                📝 Recently Modified
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {vault.recentlyModified.slice(0, 5).map((f, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '3px 8px',
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)',
                    borderRadius: 4, color: 'var(--text-secondary)'
                  }}>
                    {f.replace('.md', '')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MIDDLE ROW: Today's Schedule ─── */}
      <div style={{ marginBottom: 20 }}>
        <div className="glass-card dashboard-card" style={{ background: 'linear-gradient(135deg, rgba(15,15,30,0.9) 0%, rgba(20,10,40,0.9) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22 }}>📅</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Today's Schedule
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                {time.toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {calendar && calendar.events.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.15)' }}>
                {calendar.events.length} event{calendar.events.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {calendar && calendar.events.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {calendar.events.map((evt, i) => {
                let timeLabel = ''
                let timeColor = 'var(--accent-indigo)'
                if (evt.isAllDay) {
                  timeLabel = '🌅 All day'
                  timeColor = 'var(--accent-emerald)'
                } else if (evt.start) {
                  const st = evt.start.split('T')[1]?.substring(0, 5)
                  const en = evt.end?.split('T')[1]?.substring(0, 5)
                  timeLabel = `${st} – ${en}`
                  // Color code by time of day
                  const hour = parseInt(evt.start.split('T')[1]?.substring(0, 2) || '0')
                  if (hour >= 17) timeColor = '#f59e0b'  // evening - amber
                  else if (hour >= 12) timeColor = '#6366f1'  // afternoon - indigo
                  else timeColor = '#06b6d4'  // morning - cyan
                }

                // Determine event icon
                let icon = '📌'
                const summary = evt.summary?.toLowerCase() || ''
                if (summary.includes('badminton') || summary.includes('coach')) icon = '🏸'
                else if (summary.includes('cowork') || summary.includes('enterprise')) icon = '💼'
                else if (summary.includes('teach') || summary.includes('lesson') || summary.includes('class') || summary.includes('mt')) icon = '📚'
                else if (summary.includes('birthday') || summary.includes('party')) icon = '🎂'
                else if (summary.includes('meet')) icon = '🤝'
                else if (summary.includes('dental') || summary.includes('doctor') || summary.includes('med')) icon = '🩺'
                else if (summary.includes('gym') || summary.includes('fit')) icon = '💪'
                else if (summary.includes('nie') || summary.includes('qed') || summary.includes('module') || summary.includes('course')) icon = '🎓'

                return (
                  <div key={evt.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: 'rgba(99,102,241,0.03)',
                    border: '1px solid rgba(99,102,241,0.06)',
                    borderRadius: 10,
                    transition: 'all 0.2s'
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {evt.summary}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: timeColor, fontWeight: 500 }}>
                          {timeLabel}
                        </span>
                        {evt.location && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            📍 {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      width: 3, height: 36, borderRadius: 2, flexShrink: 0,
                      background: timeColor, opacity: 0.6
                    }} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="icon">📅</div>
              <div className="text">{calendar ? 'No events today' : 'Loading schedule...'}</div>
              <div className="sub">{calendar ? 'Enjoy your free day! 🎉' : 'Fetching from Google Calendar...'}</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── BOTTOM ROW: Dreaming + ROI ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Dreaming Engine */}
        <div className="glass-card amber dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22 }}>💭</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Dreaming Engine</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Daily self-improvement recommendations
              </p>
            </div>
          </div>

          {dreaming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dreaming.slice(0, 4).map((rec, i) => {
                const iconMap: Record<string, string> = {
                  skill: '🔧', cost_save: '💰', vault: '📝',
                  task_gap: '⚡', insight: '💡'
                }
                const clsMap: Record<string, string> = {
                  skill: 'skill', cost_save: 'medium', vault: 'low',
                  task_gap: 'high', insight: 'medium'
                }
                const cls = clsMap[rec.type] || rec.priority
                return (
                  <div key={i} className={`dream-item ${cls}`}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                      {iconMap[rec.type] || '💡'}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2, textTransform: 'capitalize' }}>
                        {rec.type.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.5 }}>{rec.message}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">🌙</div>
              <div className="text">Dreaming engine hasn't run yet</div>
              <div className="sub">Fires daily at 6:00 AM SGT · Next run: tomorrow</div>
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
            Powered by Hermes Agent · {dreaming.length} suggestions
          </div>
        </div>

        {/* ROI Tracker */}
        <div className="glass-card emerald dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22 }}>📊</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>ROI Tracker</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Time & value saved with AI workflows
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="stat-tile">
              <div className="label">Time Saved (est.)</div>
              <div className="value small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                ~{hoursSaved}h/week
                <span style={{ fontSize: 10, color: 'var(--accent-emerald)', fontWeight: 400 }}>+20% vs last month</span>
              </div>
            </div>
            <div className="stat-tile">
              <div className="label">Hourly Rate</div>
              <div className="value small">S${hourlyRate}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Monthly Value</div>
              <div className="value green">S${monthlyValue.toFixed(0)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Subscriptions</div>
              <div className="value small rose">-S${subsTotal}</div>
            </div>
          </div>

          <div className="roi-glow" style={{ marginTop: 18 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Net Monthly ROI</div>
              <div style={{
                fontSize: 34, fontWeight: 800,
                color: netRoi >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '-0.03em'
              }}>
                {netRoi >= 0 ? '+' : ''}S${netRoi.toFixed(0)}
              </div>
              <div style={{
                width: '100%', height: 4, marginTop: 10,
                background: 'rgba(255,255,255,0.04)', borderRadius: 2,
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min(100, (netRoi / 1500) * 100)}%`, height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-emerald))',
                  borderRadius: 2, transition: 'width 1s ease'
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                Based on ~{hoursSaved}h/week saved at S${hourlyRate}/h (MOE GEO2 rate)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── GitHub Activity ─── */}
      {github && github.repos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="glass-card dashboard-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>🐙</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>GitHub Activity</h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  Recent commits across {github.repos.length} repos · {github.total_commits} commits
                </p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                <a href="https://github.com/amoskhan" target="_blank" rel="noopener" style={{ color: 'var(--accent-indigo)', textDecoration: 'none' }}>
                  github.com/amoskhan ↗
                </a>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {github.repos.slice(0, 4).map((repo, ri) => (
                <div key={ri}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      color: 'var(--accent-indigo)', letterSpacing: '0.05em'
                    }}>
                      📁 {repo.name}
                    </span>
                    {repo.pushed_at && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        pushed {repo.pushed_at}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {repo.commits.map((c: any, ci: number) => (
                      <div key={ci} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.01)',
                        fontSize: 11
                      }}>
                        <code style={{
                          fontSize: 9, color: '#555', fontFamily: "'JetBrains Mono', monospace",
                          background: 'rgba(99,102,241,0.06)', padding: '1px 4px', borderRadius: 3,
                          flexShrink: 0
                        }}>
                          {c.sha}
                        </code>
                        <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.message}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {c.date}
                        </span>
                      </div>
                    ))}
                  </div>
                  {ri < github.repos.length - 1 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', marginTop: 12 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Persona Switcher ─── */}
      {personas && personas.personas.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="glass-card dashboard-card" style={{ background: 'linear-gradient(135deg, rgba(30,10,50,0.9) 0%, rgba(15,15,30,0.9) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>🎭</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Persona Switcher</h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  Currently active: <strong style={{ color: 'var(--accent-indigo)' }}>{personas.active.charAt(0).toUpperCase() + personas.active.slice(1)}</strong>
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {personas.personas.map((p) => {
                const isActive = p.id === personas.active
                return (
                  <button
                    key={p.id}
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/personas', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ persona: p.id })
                        })
                        if (res.ok) {
                          // Refresh persona list
                          fetch('/api/personas').then(r => r.json()).then(setPersonas).catch(() => {})
                        }
                      } catch {}
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: isActive
                        ? '1px solid rgba(99,102,241,0.4)'
                        : '1px solid rgba(255,255,255,0.04)',
                      background: isActive
                        ? 'rgba(99,102,241,0.12)'
                        : 'rgba(255,255,255,0.02)',
                      color: isActive ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 12,
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      width: '100%'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.06)'
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                      }
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{p.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description}
                        </div>
                      )}
                    </div>
                    {isActive && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent-emerald)' }}>●</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Live Messages ─── */}
      <LiveMessages />

      {/* ─── Models Quick Reference ─── */}
      {models.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>🤖</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Available Models</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {models.filter(m => m.costPer1kTokens === 0).length} free · {models.filter(m => m.costPer1kTokens > 0).length} paid
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {models.map((m, i) => {
                const isActive = m.id === modelTag
                const isFreeTier = m.costPer1kTokens === 0
                return (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 6, fontSize: 11,
                    background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    color: isActive ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.2s'
                  }}>
                    {isActive && '▶ '}
                    {m.name}
                    {isFreeTier && <span style={{ fontSize: 9, color: 'var(--accent-emerald)' }}>FREE</span>}
                    {isActive && <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>(active)</span>}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Footer ─── */}
      <div className="footer">
        <span>Visual OS · Running on Hermes Agent</span>
        <span>Amos Khan · Singapore SGT (GMT+8)</span>
        <span>{time.toLocaleDateString('en-SG')}</span>
      </div>
    </div>
  )
}

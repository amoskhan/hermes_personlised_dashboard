import { useEffect, useRef, useState } from 'react'

type MessageEntry = {
  time: string
  source: string
  text: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return formatTime(iso)
}

const ICONS: Record<string, string> = {
  system: '⚙️',
  cron: '⏰',
  vault: '📓',
  bot: '🤖',
  dashboard: '📊',
  telegram: '💬',
  research: '🔬',
}

const TYPE_STYLES: Record<string, { dot: string; bg: string; border: string }> = {
  info:    { dot: '#6366f1', bg: 'rgba(99,102,241,0.03)', border: 'rgba(99,102,241,0.06)' },
  success: { dot: '#22c55e', bg: 'rgba(34,197,94,0.03)', border: 'rgba(34,197,94,0.06)' },
  warning: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.03)', border: 'rgba(245,158,11,0.06)' },
  error:   { dot: '#ef4444', bg: 'rgba(239,68,68,0.03)', border: 'rgba(239,68,68,0.06)' },
}

export default function LiveMessages() {
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const POLL_INTERVAL = 15_000 // 15s

  // Poll for new messages
  useEffect(() => {
    let latestTime = 0
    const seen = new Set<string>()

    const fetchMessages = async (since: number) => {
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        const data = await res.json()
        if (data.messages?.length) {
          setMessages(prev => {
            const newOnes = data.messages.filter(
              (m: MessageEntry) => !seen.has(m.time + m.text)
            )
            newOnes.forEach((m: MessageEntry) => seen.add(m.time + m.text))
            const combined = [...prev, ...newOnes]
            // Keep max 50 messages
            return combined.slice(-50)
          })
          const latest = data.messages[data.messages.length - 1]
          latestTime = new Date(latest.time).getTime()

          // Auto-scroll
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
          }, 50)
        }
      } catch { /* silent */ }
    }

    // Initial load
    fetchMessages(0).then(() => {
      setConnected(true)
    })

    const interval = setInterval(() => {
      fetchMessages(latestTime)
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>💬</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Live Messages</h3>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            Real-time agent activity &amp; updates
            <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className={`glow-dot ${connected ? 'green' : 'amber'}`}
                style={connected ? { animation: 'pulse-glow 2s ease-in-out infinite', width: 6, height: 6 } : { width: 6, height: 6 }} />
              <span style={{ fontSize: 9 }}>{connected ? 'Polling' : 'Connecting…'}</span>
            </span>
          </p>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.1)' }}>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {messages.length > 0 ? (
        <div
          ref={scrollRef}
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingRight: 4,
          }}
        >
          {messages.map((msg, i) => {
            const style = TYPE_STYLES[msg.type || 'info'] || TYPE_STYLES.info
            const icon = ICONS[msg.source] || '💡'
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  fontSize: 12,
                  lineHeight: 1.5,
                  animation: i >= messages.length - 5 ? 'fade-in-up 0.3s ease both' : undefined,
                  animationDelay: i >= messages.length - 5 ? `${(i - messages.length + 5) * 0.06}s` : undefined,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {msg.source}
                    </span>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: style.dot, flexShrink: 0
                    }} />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {timeAgo(msg.time)}
                    </span>
                  </div>
                  <div style={{ color: '#cccce0', wordBreak: 'break-word' }}>{msg.text}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <div className="icon">📭</div>
          <div className="text">No messages yet</div>
          <div className="sub">Activity will appear here once the agent starts logging</div>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
        Polls every {POLL_INTERVAL / 1000}s · <code style={{ fontSize: 9 }}>messages.log</code>
      </div>
    </div>
  )
}

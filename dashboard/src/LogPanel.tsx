import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogLine } from './types'

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const
type LevelFilter = (typeof LEVELS)[number]

// Cap how many lines we actually render to keep the DOM light.
const RENDER_CAP = 1500

export function LogPanel({ logs }: { logs: LogLine[] }) {
  const [level, setLevel] = useState<LevelFilter>('ALL')
  const [q, setQ] = useState('')
  const [follow, setFollow] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = logs
    if (level !== 'ALL') out = out.filter((l) => l.level === level)
    if (needle) out = out.filter((l) => l.raw.toLowerCase().includes(needle))
    return out.length > RENDER_CAP ? out.slice(-RENDER_CAP) : out
  }, [logs, level, q])

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [filtered, follow])

  // Turn follow off if the user scrolls up; back on if they return to the bottom.
  const onScroll = () => {
    const el = boxRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    setFollow(atBottom)
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of logs) c[l.level || 'OTHER'] = (c[l.level || 'OTHER'] || 0) + 1
    return c
  }, [logs])

  return (
    <section className="logs">
      <div className="logs-bar">
        <div className="logs-levels">
          {LEVELS.map((lv) => (
            <button key={lv} className={`lvbtn ${level === lv ? 'on' : ''} ${lv.toLowerCase()}`} onClick={() => setLevel(lv)}>
              {lv}
              {lv !== 'ALL' && counts[lv] ? <span className="cnt">{counts[lv]}</span> : null}
            </button>
          ))}
        </div>
        <input className="logfilter" placeholder="filter text…" value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} />
        <label className={`follow ${follow ? 'on' : ''}`}>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow
        </label>
        <span className="muted logcount">{filtered.length} shown · {logs.length} total</span>
      </div>
      <div className="logbox" ref={boxRef} onScroll={onScroll}>
        {filtered.map((l) => (
          <div key={l.id} className={`logline ${(l.level || 'other').toLowerCase()}`}>
            {l.ts && <span className="lts">{l.ts.slice(11)}</span>}
            <span className="llv">{l.level || '·'}</span>
            <span className="lmsg">{l.text}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="muted" style={{ padding: 8 }}>No log lines.</div>}
      </div>
    </section>
  )
}

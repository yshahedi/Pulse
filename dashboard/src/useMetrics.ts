import { useEffect, useRef, useState } from 'react'
import type { Snapshot, Derived, WorkerView, PoolView, WorkerStatus, LogLine } from './types'

// A worker is "stalled" if it has been BUSY on the same task longer than this.
const STALL_MS = 3000
// History kept for sparklines (number of snapshots ~= seconds*2 at 500ms).
const HISTORY = 120
// Max log lines retained in the panel.
const LOG_MAX = 3000

export interface MetricsState {
  connected: boolean
  enabled: boolean
  snapshot: Snapshot | null
  derived: Derived | null
  history: number[] // aggregate tasks/sec over time
  logs: LogLine[]
  lastError: string | null
}

const LOG_RE = /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+)\s+\[(\w+)\]\s?([\s\S]*)$/

function parseLogLine(raw: string, id: number): LogLine {
  const m = LOG_RE.exec(raw)
  if (m) return { id, ts: m[1], level: m[2], text: m[3], raw }
  return { id, ts: '', level: '', text: raw, raw }
}

function deriveWorkerStatus(
  w: Snapshot['workers'][number],
  prevSeenSlots: Set<number>,
): WorkerStatus {
  if (w.state === 'busy') return w.age_ms > STALL_MS ? 'stalled' : 'busy'
  // A freshly appeared slot that is already producing → treat as restarting/warming.
  if (!prevSeenSlots.has(w.slot) && prevSeenSlots.size > 0) return 'restarting'
  return 'idle'
}

function derive(cur: Snapshot, prev: Snapshot | null): Derived {
  const dt = prev ? (cur.ts - prev.ts) / 1000 : 0
  const prevWorkers = new Map<number, number>()
  const prevSeenSlots = new Set<number>()
  if (prev) {
    for (const w of prev.workers) {
      prevWorkers.set(w.slot, w.processed)
      prevSeenSlots.add(w.slot)
    }
  }

  const workers: WorkerView[] = cur.workers.map((w) => {
    const before = prevWorkers.get(w.slot)
    const rate = dt > 0 && before !== undefined ? Math.max(0, (w.processed - before) / dt) : 0
    return { ...w, rate, status: deriveWorkerStatus(w, prevSeenSlots) }
  })

  const prevPool = new Map<number, { processed: number; errors: number }>()
  if (prev) for (const p of prev.pools) prevPool.set(p.id, { processed: p.processed, errors: p.errors })

  const pools: PoolView[] = cur.pools.map((p) => {
    const before = prevPool.get(p.id)
    const rate = dt > 0 && before ? Math.max(0, (p.processed - before.processed) / dt) : 0
    const errorRate = dt > 0 && before ? Math.max(0, (p.errors - before.errors) / dt) : 0
    let status: WorkerStatus
    if (!p.running || p.workers === 0) status = 'crashed'
    else if (workers.some((w) => w.pool === p.id && w.status === 'stalled')) status = 'stalled'
    else if (p.busy > 0) status = 'busy'
    else status = 'idle'
    return { ...p, rate, errorRate, status }
  })

  const totals = {
    workers: cur.workers.length,
    busy: cur.workers.filter((w) => w.state === 'busy').length,
    idle: cur.workers.filter((w) => w.state === 'idle').length,
    queued: pools.reduce((s, p) => s + (p.queued > 0 ? p.queued : 0), 0),
    rate: pools.reduce((s, p) => s + p.rate, 0),
    errors: pools.reduce((s, p) => s + p.errors, 0),
  }

  return { ts: cur.ts, pools, workers, totals }
}

export function useMetrics(url: string): MetricsState {
  const [state, setState] = useState<MetricsState>({
    connected: false,
    enabled: false,
    snapshot: null,
    derived: null,
    history: [],
    logs: [],
    lastError: null,
  })
  const prevRef = useRef<Snapshot | null>(null)
  const histRef = useRef<number[]>([])
  const logsRef = useRef<LogLine[]>([])
  const logIdRef = useRef(0)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let closed = false

    const connect = () => {
      ws = new WebSocket(url)
      ws.onopen = () => setState((s) => ({ ...s, connected: true, lastError: null }))
      ws.onmessage = (ev) => {
        let msg: any
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }
        // Log message: { type:"log", backlog, lines:[...] }
        if (msg && msg.type === 'log') {
          if (msg.backlog) logsRef.current = []
          const parsed = (msg.lines as string[]).map((l) => parseLogLine(l, logIdRef.current++))
          logsRef.current = [...logsRef.current, ...parsed].slice(-LOG_MAX)
          setState((s) => ({ ...s, logs: logsRef.current }))
          return
        }
        // Otherwise it's a metrics snapshot.
        const snap = msg as Snapshot
        if (!snap.enabled) {
          setState((s) => ({ ...s, enabled: false, snapshot: snap }))
          return
        }
        const derived = derive(snap, prevRef.current)
        prevRef.current = snap
        const hist = [...histRef.current, derived.totals.rate].slice(-HISTORY)
        histRef.current = hist
        setState((s) => ({ ...s, connected: true, enabled: true, snapshot: snap, derived, history: hist, lastError: null }))
      }
      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false }))
        prevRef.current = null
        if (!closed) retry = setTimeout(connect, 1000)
      }
      ws.onerror = () => setState((s) => ({ ...s, lastError: 'WebSocket error' }))
    }
    connect()

    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      ws?.close()
    }
  }, [url])

  return state
}

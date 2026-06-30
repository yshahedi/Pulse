// Wire schema — must match pmetrics::snapshot_json() in metrics.h.

export interface ProcessStat {
  cpu_pct: number
  rss_kb: number
  threads: number
}

export interface PoolRaw {
  id: number
  name: string
  workers: number
  busy: number
  idle: number
  queued: number // -1 means "unknown" (inbound: multi-site enqueue)
  processed: number
  errors: number
  running: boolean
}

export interface WorkerRaw {
  slot: number
  pool: number
  pool_name: string
  state: 'idle' | 'busy' | 'unused'
  processed: number
  errors: number
  last_seen_ms: number
  age_ms: number
  tid: number
}

export interface Snapshot {
  enabled: boolean
  ts: number
  uptime_ms: number
  process: ProcessStat
  pools: PoolRaw[]
  workers: WorkerRaw[]
}

export type WorkerStatus = 'idle' | 'busy' | 'stalled' | 'crashed' | 'restarting'

export interface WorkerView extends WorkerRaw {
  status: WorkerStatus
  rate: number // tasks/sec since previous snapshot
}

export interface PoolView extends PoolRaw {
  status: WorkerStatus
  rate: number // tasks/sec aggregate
  errorRate: number
}

export interface LogLine {
  id: number
  ts: string
  level: string // INFO | WARN | ERROR | DEBUG | ''
  text: string
  raw: string
}

export interface Derived {
  ts: number
  pools: PoolView[]
  workers: WorkerView[]
  totals: {
    workers: number
    busy: number
    idle: number
    queued: number
    rate: number
    errors: number
  }
}

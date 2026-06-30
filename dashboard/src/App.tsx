import { useMemo, useState } from 'react'
import { useMetrics } from './useMetrics'
import { Sparkline } from './Sparkline'
import { LogPanel } from './LogPanel'
import type { WorkerStatus } from './types'

const DEFAULT_URL = `ws://${location.hostname || '127.0.0.1'}:4002`

function fmtAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`
}

function Badge({ status }: { status: WorkerStatus }) {
  return <span className={`badge ${status}`}>{status}</span>
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function App() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [poolFilter, setPoolFilter] = useState<number | null>(null)
  const { connected, enabled, snapshot, derived, history, logs } = useMetrics(url)

  const workers = useMemo(() => {
    if (!derived) return []
    const list = poolFilter == null ? derived.workers : derived.workers.filter((w) => w.pool === poolFilter)
    return [...list].sort((a, b) => (a.pool - b.pool) || (a.slot - b.slot))
  }, [derived, poolFilter])

  return (
    <div className="app">
      <header>
        <h1>Pulse Worker Monitor</h1>
        <div className="conn">
          <span className={`dot ${connected ? 'on' : 'off'}`} />
          {connected ? 'live' : 'disconnected'}
          <input className="url" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
        </div>
      </header>

      {!connected && (
        <div className="banner err">
          Backend unreachable at {url} — Pulse is down or built without <code>-DPULSE_METRICS</code>.
        </div>
      )}
      {connected && !enabled && (
        <div className="banner warn">
          Connected, but metrics are disabled (Pulse built without <code>-DPULSE_METRICS</code>).
        </div>
      )}

      {derived && snapshot && (
        <>
          <section className="cards">
            <Stat label="Workers" value={String(derived.totals.workers)} sub={`${derived.totals.busy} busy · ${derived.totals.idle} idle`} />
            <Stat label="Throughput" value={`${derived.totals.rate.toFixed(1)}/s`} sub="tasks across all pools" />
            <Stat label="Queued" value={String(derived.totals.queued)} sub="in-flight backlog" />
            <Stat label="Errors" value={String(derived.totals.errors)} sub="cumulative" />
            <Stat label="CPU" value={`${snapshot.process.cpu_pct.toFixed(1)}%`} sub={`${snapshot.process.threads} OS threads`} />
            <Stat label="RSS" value={`${(snapshot.process.rss_kb / 1024).toFixed(0)} MB`} sub={`up ${fmtAge(snapshot.uptime_ms)}`} />
          </section>

          <section className="spark-row">
            <span>Aggregate throughput</span>
            <Sparkline data={history} width={520} height={48} />
            <span className="muted">{derived.totals.rate.toFixed(1)} tasks/s</span>
          </section>

          <section>
            <h2>Pools</h2>
            <table className="pools">
              <thead>
                <tr>
                  <th></th><th>Pool</th><th>Status</th><th>Workers</th><th>Busy</th>
                  <th>Idle</th><th>Queued</th><th>Tasks/s</th><th>Processed</th><th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {derived.pools.map((p) => (
                  <tr key={p.id} className={poolFilter === p.id ? 'sel' : ''}
                      onClick={() => setPoolFilter(poolFilter === p.id ? null : p.id)}>
                    <td><input type="radio" readOnly checked={poolFilter === p.id} /></td>
                    <td className="mono">{p.name}</td>
                    <td><Badge status={p.status} /></td>
                    <td>{p.workers}</td>
                    <td>{p.busy}</td>
                    <td>{p.idle}</td>
                    <td>{p.queued < 0 ? '—' : p.queued}</td>
                    <td>{p.rate.toFixed(1)}</td>
                    <td>{p.processed}</td>
                    <td className={p.errors ? 'err-cell' : ''}>{p.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>
              Workers {poolFilter != null && <button className="clear" onClick={() => setPoolFilter(null)}>show all</button>}
              <span className="muted"> ({workers.length})</span>
            </h2>
            <div className="worker-grid">
              {workers.map((w) => (
                <div key={w.slot} className={`worker ${w.status}`} title={`tid ${w.tid}`}>
                  <div className="worker-top">
                    <span className="mono">{w.pool_name}#{w.slot}</span>
                    <Badge status={w.status} />
                  </div>
                  <div className="worker-row"><span>rate</span><b>{w.rate.toFixed(1)}/s</b></div>
                  <div className="worker-row"><span>done</span><b>{w.processed}</b></div>
                  <div className="worker-row"><span>seen</span><b>{fmtAge(w.age_ms)} ago</b></div>
                  {w.errors > 0 && <div className="worker-row err-cell"><span>err</span><b>{w.errors}</b></div>}
                </div>
              ))}
              {workers.length === 0 && <div className="muted">No active workers.</div>}
            </div>
          </section>
        </>
      )}

      {connected && (
        <section>
          <h2>Logs <span className="muted">live tail</span></h2>
          <LogPanel logs={logs} />
        </section>
      )}
    </div>
  )
}

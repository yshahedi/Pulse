import { useEffect, useState } from 'react'
import { apiCall, listRows, addRow, editRow, deleteRow } from './api'

// ── Shared helpers ────────────────────────────────────────────────────────────

const METHODS = [
  { v: 1, label: 'POST' },
  { v: 2, label: 'GET' },
  { v: 3, label: 'PUT' },
  { v: 4, label: 'DELETE' },
  { v: 5, label: 'PATCH' },
]
const methodLabel = (m: number) => METHODS.find((x) => x.v === m)?.label || String(m)

function useAsyncError(): [string | null, (fn: () => Promise<void>) => Promise<void>, boolean] {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => {
    setErr(null)
    setBusy(true)
    try {
      await fn()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }
  return [err, run, busy]
}

function StatusDot({ active, runtime }: { active: number; runtime: number | null }) {
  if (active !== 1) return <span className="pill off">disabled</span>
  if (runtime) return <span className="pill on">live #{runtime}</span>
  return <span className="pill pending">not applied</span>
}

// ── Routes ────────────────────────────────────────────────────────────────────

interface RouteRow {
  id: number; name: string; description: string; source: string
  method: number; timeout: number; is_active: number; runtime_id: number | null
}

const SAMPLE_ROUTE = `// Inbound route handler. The request body arrives as the string \`request\`.
// Assign the reply to \`response\`. Call any registered function, including
// operator functions via Custom('<name>', data).
let body = {};
try { body = JSON.parse(request); } catch (_) {}
response = JSON.stringify({ ok: true, echo: body });`

export function RoutesPanel() {
  const [rows, setRows] = useState<RouteRow[]>([])
  const [editing, setEditing] = useState<Partial<RouteRow> | null>(null)
  const [err, run, busy] = useAsyncError()

  const reload = () => run(async () => {
    const r = await listRows<RouteRow>('route_tab')
    setRows(r.rows)
  })
  useEffect(() => { reload() }, [])

  const blank = (): Partial<RouteRow> => ({ name: '', description: '', source: SAMPLE_ROUTE, method: 1, timeout: 60000, is_active: 1 })

  const save = (apply: boolean) => run(async () => {
    if (!editing?.name) throw new Error('Route name is required')
    const record: any = {
      name: editing.name, description: editing.description || '', source: editing.source || '',
      method: Number(editing.method) || 1, timeout: Number(editing.timeout) || 60000,
      is_active: editing.is_active ? 1 : 0,
    }
    let id = editing.id
    if (id) { record.id = id; await editRow('route_tab', record) } else { id = await addRow('route_tab', record) }
    if (apply) await apiCall('admin', 'apply_route', { id })
    setEditing(null)
    await run(async () => { const r = await listRows<RouteRow>('route_tab'); setRows(r.rows) })
  })

  const apply = (id: number) => run(async () => { await apiCall('admin', 'apply_route', { id }); const r = await listRows<RouteRow>('route_tab'); setRows(r.rows) })
  const unregister = (id: number) => run(async () => { await apiCall('admin', 'remove_route', { id }); const r = await listRows<RouteRow>('route_tab'); setRows(r.rows) })
  const remove = (id: number) => run(async () => { await apiCall('admin', 'remove_route', { id }); await deleteRow('route_tab', id); const r = await listRows<RouteRow>('route_tab'); setRows(r.rows) })

  return (
    <div>
      <div className="panel-head">
        <h2>Inbound Routes <span className="muted">({rows.length})</span></h2>
        <div className="row-gap">
          <button className="btn" onClick={reload} disabled={busy}>Refresh</button>
          <button className="btn primary" onClick={() => setEditing(blank())}>+ New route</button>
        </div>
      </div>
      {err && <div className="banner err">{err}</div>}

      <table className="grid">
        <thead><tr><th>ID</th><th>Path</th><th>Method</th><th>Status</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td className="mono">/{r.name}</td>
              <td>{methodLabel(r.method)}</td>
              <td><StatusDot active={r.is_active} runtime={r.runtime_id} /></td>
              <td className="muted">{r.description}</td>
              <td className="actions">
                {r.runtime_id
                  ? <button className="btn xs warn" onClick={() => unregister(r.id)}>Stop</button>
                  : <button className="btn xs primary" onClick={() => apply(r.id)}>Start</button>}
                <button className="btn xs" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn xs danger" onClick={() => remove(r.id)}>Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No routes yet.</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div className="editor">
          <h3>{editing.id ? `Edit route #${editing.id}` : 'New route'}</h3>
          <div className="form-row">
            <label>Path <span className="muted">→ /your-path on :4001</span></label>
            <input className="field" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="my_route" />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Method</label>
              <select className="field" value={editing.method} onChange={(e) => setEditing({ ...editing, method: Number(e.target.value) })}>
                {METHODS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Timeout (ms)</label>
              <input className="field" type="number" value={editing.timeout} onChange={(e) => setEditing({ ...editing, timeout: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Active</label>
              <input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })} />
            </div>
          </div>
          <div className="form-row">
            <label>Description</label>
            <input className="field" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Handler source (JS)</label>
            <textarea className="code" spellCheck={false} value={editing.source || ''} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
          </div>
          <div className="row-gap">
            <button className="btn primary" onClick={() => save(true)} disabled={busy}>Save &amp; Apply</button>
            <button className="btn" onClick={() => save(false)} disabled={busy}>Save only</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Services ──────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: number; name: string; description: string; url: string
  method: number; timeout: number; headers: string; is_active: number; runtime_id: number | null
}

export function ServicesPanel() {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [editing, setEditing] = useState<Partial<ServiceRow> | null>(null)
  const [err, run, busy] = useAsyncError()

  const fetchRows = async () => { const r = await listRows<ServiceRow>('service_tab'); setRows(r.rows) }
  const reload = () => run(fetchRows)
  useEffect(() => { reload() }, [])

  const blank = (): Partial<ServiceRow> => ({ name: '', description: '', url: 'https://', method: 1, timeout: 60000, headers: '[]', is_active: 1 })

  const save = (apply: boolean) => run(async () => {
    if (!editing?.name) throw new Error('Service name is required')
    if (!editing?.url) throw new Error('URL is required')
    let headers = editing.headers || '[]'
    try { JSON.parse(headers) } catch { throw new Error('Headers must be a JSON array of {key,value}') }
    const record: any = {
      name: editing.name, description: editing.description || '', url: editing.url,
      method: Number(editing.method) || 1, timeout: Number(editing.timeout) || 60000,
      headers, is_active: editing.is_active ? 1 : 0,
    }
    let id = editing.id
    if (id) { record.id = id; await editRow('service_tab', record) } else { id = await addRow('service_tab', record) }
    if (apply) await apiCall('admin', 'apply_service', { id })
    setEditing(null)
    await fetchRows()
  })

  const apply = (id: number) => run(async () => { await apiCall('admin', 'apply_service', { id }); await fetchRows() })
  const unregister = (id: number) => run(async () => { await apiCall('admin', 'remove_service', { id }); await fetchRows() })
  const remove = (id: number) => run(async () => { await apiCall('admin', 'remove_service', { id }); await deleteRow('service_tab', id); await fetchRows() })

  return (
    <div>
      <div className="panel-head">
        <h2>Outbound Services <span className="muted">({rows.length})</span></h2>
        <div className="row-gap">
          <button className="btn" onClick={reload} disabled={busy}>Refresh</button>
          <button className="btn primary" onClick={() => setEditing(blank())}>+ New service</button>
        </div>
      </div>
      {err && <div className="banner err">{err}</div>}

      <table className="grid">
        <thead><tr><th>ID</th><th>Name</th><th>URL</th><th>Method</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td className="mono truncate">{r.url}</td>
              <td>{methodLabel(r.method)}</td>
              <td><StatusDot active={r.is_active} runtime={r.runtime_id} /></td>
              <td className="actions">
                {r.runtime_id
                  ? <button className="btn xs warn" onClick={() => unregister(r.id)}>Stop</button>
                  : <button className="btn xs primary" onClick={() => apply(r.id)}>Start</button>}
                <button className="btn xs" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn xs danger" onClick={() => remove(r.id)}>Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No services yet.</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div className="editor">
          <h3>{editing.id ? `Edit service #${editing.id}` : 'New service'}</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Name</label>
              <input className="field" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="payment_api" />
            </div>
            <div className="form-row">
              <label>Method</label>
              <select className="field" value={editing.method} onChange={(e) => setEditing({ ...editing, method: Number(e.target.value) })}>
                {METHODS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Timeout (ms)</label>
              <input className="field" type="number" value={editing.timeout} onChange={(e) => setEditing({ ...editing, timeout: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Active</label>
              <input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })} />
            </div>
          </div>
          <div className="form-row">
            <label>URL</label>
            <input className="field" value={editing.url || ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://api.example.com/v1/" />
          </div>
          <div className="form-row">
            <label>Description</label>
            <input className="field" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Headers (JSON array of {'{key,value}'})</label>
            <textarea className="code small" spellCheck={false} value={editing.headers || '[]'} onChange={(e) => setEditing({ ...editing, headers: e.target.value })} />
          </div>
          <p className="muted small">Once applied, reach it from any handler with <code>CallService(JSON.stringify({'{ id, request }'}))</code> using the live id shown in the table.</p>
          <div className="row-gap">
            <button className="btn primary" onClick={() => save(true)} disabled={busy}>Save &amp; Apply</button>
            <button className="btn" onClick={() => save(false)} disabled={busy}>Save only</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Schedulers ────────────────────────────────────────────────────────────────

interface SchedulerRow {
  id: number; name: string; description: string; source: string
  interval: number; timeout: number; is_active: number; runtime_id: number | null
}

const SAMPLE_SCHED = `// Scheduler body — runs every \`interval\` ms. Call any registered function,
// including operator functions: Custom('<name>', { ... }).
Log('scheduler tick');`

export function SchedulersPanel() {
  const [rows, setRows] = useState<SchedulerRow[]>([])
  const [editing, setEditing] = useState<Partial<SchedulerRow> | null>(null)
  const [err, run, busy] = useAsyncError()

  const fetchRows = async () => { const r = await listRows<SchedulerRow>('scheduler_tab'); setRows(r.rows) }
  const reload = () => run(fetchRows)
  useEffect(() => { reload() }, [])

  const blank = (): Partial<SchedulerRow> => ({ name: '', description: '', source: SAMPLE_SCHED, interval: 60000, timeout: 30000, is_active: 1 })

  const save = (apply: boolean) => run(async () => {
    if (!editing?.name) throw new Error('Scheduler name is required')
    const record: any = {
      name: editing.name, description: editing.description || '', source: editing.source || '',
      interval: Number(editing.interval) || 60000, timeout: Number(editing.timeout) || 30000,
      is_active: editing.is_active ? 1 : 0,
    }
    let id = editing.id
    if (id) { record.id = id; await editRow('scheduler_tab', record) } else { id = await addRow('scheduler_tab', record) }
    if (apply) await apiCall('admin', 'apply_scheduler', { id })
    setEditing(null)
    await fetchRows()
  })

  const apply = (id: number) => run(async () => { await apiCall('admin', 'apply_scheduler', { id }); await fetchRows() })
  const unregister = (id: number) => run(async () => { await apiCall('admin', 'remove_scheduler', { id }); await fetchRows() })
  const remove = (id: number) => run(async () => { await apiCall('admin', 'remove_scheduler', { id }); await deleteRow('scheduler_tab', id); await fetchRows() })

  return (
    <div>
      <div className="panel-head">
        <h2>Schedulers <span className="muted">({rows.length})</span></h2>
        <div className="row-gap">
          <button className="btn" onClick={reload} disabled={busy}>Refresh</button>
          <button className="btn primary" onClick={() => setEditing(blank())}>+ New scheduler</button>
        </div>
      </div>
      {err && <div className="banner err">{err}</div>}

      <table className="grid">
        <thead><tr><th>ID</th><th>Name</th><th>Interval</th><th>Status</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>{(r.interval / 1000).toFixed(0)}s</td>
              <td><StatusDot active={r.is_active} runtime={r.runtime_id} /></td>
              <td className="muted">{r.description}</td>
              <td className="actions">
                {r.runtime_id
                  ? <button className="btn xs warn" onClick={() => unregister(r.id)}>Stop</button>
                  : <button className="btn xs primary" onClick={() => apply(r.id)}>Start</button>}
                <button className="btn xs" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn xs danger" onClick={() => remove(r.id)}>Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No schedulers yet.</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div className="editor">
          <h3>{editing.id ? `Edit scheduler #${editing.id}` : 'New scheduler'}</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Name</label>
              <input className="field" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="nightly_job" />
            </div>
            <div className="form-row">
              <label>Interval (ms)</label>
              <input className="field" type="number" value={editing.interval} onChange={(e) => setEditing({ ...editing, interval: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Timeout (ms)</label>
              <input className="field" type="number" value={editing.timeout} onChange={(e) => setEditing({ ...editing, timeout: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Active</label>
              <input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })} />
            </div>
          </div>
          <div className="form-row">
            <label>Description</label>
            <input className="field" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Scheduler source (JS)</label>
            <textarea className="code" spellCheck={false} value={editing.source || ''} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
          </div>
          <div className="row-gap">
            <button className="btn primary" onClick={() => save(true)} disabled={busy}>Save &amp; Apply</button>
            <button className="btn" onClick={() => save(false)} disabled={busy}>Save only</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Functions (the single Custom() file) ──────────────────────────────────────

interface FunctionRow {
  id: number; name: string; description: string; source: string; is_active: number
}

const SAMPLE_FN = `// Body of a function callable as Custom('<name>', req).
// \`req\` is whatever the caller passes; return any JSON-serialisable value.
return { hello: req && req.who ? req.who : 'world' };`

export function FunctionsPanel() {
  const [rows, setRows] = useState<FunctionRow[]>([])
  const [editing, setEditing] = useState<Partial<FunctionRow> | null>(null)
  const [err, run, busy] = useAsyncError()

  const fetchRows = async () => { const r = await listRows<FunctionRow>('function_tab'); setRows(r.rows) }
  const reload = () => run(fetchRows)
  useEffect(() => { reload() }, [])

  const blank = (): Partial<FunctionRow> => ({ name: '', description: '', source: SAMPLE_FN, is_active: 1 })

  const save = () => run(async () => {
    if (!editing?.name) throw new Error('Function name is required')
    await apiCall('admin', 'save_function', { id: editing.id, name: editing.name, description: editing.description || '', source: editing.source || '' })
    setEditing(null)
    await fetchRows()
  })
  const remove = (id: number) => run(async () => { await apiCall('admin', 'delete_function', { id }); await fetchRows() })

  return (
    <div>
      <div className="panel-head">
        <h2>Functions <span className="muted">({rows.length})</span></h2>
        <div className="row-gap">
          <button className="btn" onClick={reload} disabled={busy}>Refresh</button>
          <button className="btn primary" onClick={() => setEditing(blank())}>+ New function</button>
        </div>
      </div>
      <p className="muted small">All functions live together in <code>js/functions/custom.js</code> and are callable from any route or scheduler as <code>Custom('name', data)</code>.</p>
      {err && <div className="banner err">{err}</div>}

      <table className="grid">
        <thead><tr><th>ID</th><th>Name</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td className="mono">Custom('{r.name}')</td>
              <td className="muted">{r.description}</td>
              <td className="actions">
                <button className="btn xs" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn xs danger" onClick={() => remove(r.id)}>Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="muted">No functions yet.</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div className="editor">
          <h3>{editing.id ? `Edit function #${editing.id}` : 'New function'}</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Name (the Custom key)</label>
              <input className="field" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="greet" />
            </div>
            <div className="form-row wide">
              <label>Description</label>
              <input className="field" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label>Function body (JS) — receives <code>req</code>, may <code>return</code> a value</label>
            <textarea className="code" spellCheck={false} value={editing.source || ''} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
          </div>
          <div className="row-gap">
            <button className="btn primary" onClick={save} disabled={busy}>Save function</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

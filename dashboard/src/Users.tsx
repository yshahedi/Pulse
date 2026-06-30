import { Fragment, useEffect, useState } from 'react'
import {
  listUsers, createUser, setUserPassword, setUserActive, setUserAdmin, deleteUser,
  verifyPassword, getUser, getUserId, type UserRow,
} from './api'

function useAsync(): [string | null, string | null, (fn: () => Promise<string | void>) => Promise<void>, boolean] {
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<string | void>) => {
    setErr(null); setOk(null); setBusy(true)
    try {
      const msg = await fn()
      if (typeof msg === 'string') setOk(msg)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }
  return [err, ok, run, busy]
}

// ── My password ───────────────────────────────────────────────────────────────

function MyPassword() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, ok, run, busy] = useAsync()
  const me = getUser()
  const myId = getUserId()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      if (!myId) throw new Error('No current user id — sign out and back in.')
      if (next.length < 4) throw new Error('New password must be at least 4 characters')
      if (next !== confirm) throw new Error('New password and confirmation do not match')
      if (me) await verifyPassword(me, cur) // throws on wrong current password
      await setUserPassword(myId, next)
      setCur(''); setNext(''); setConfirm('')
      return 'Password changed.'
    })
  }

  return (
    <div className="editor">
      <h3>Change my password <span className="muted">({me})</span></h3>
      {err && <div className="banner err">{err}</div>}
      {ok && <div className="banner ok">{ok}</div>}
      <form onSubmit={submit}>
        <div className="form-grid three">
          <div className="form-row"><label>Current password</label>
            <input className="field" type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="form-row"><label>New password</label>
            <input className="field" type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div className="form-row"><label>Confirm new</label>
            <input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        </div>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  )
}

// ── Create user ───────────────────────────────────────────────────────────────

function CreateUser({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [err, ok, run, busy] = useAsync()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      if (!username.trim()) throw new Error('Username is required')
      if (password.length < 4) throw new Error('Password must be at least 4 characters')
      await createUser(username.trim(), password, isAdmin)
      setUsername(''); setPassword(''); setIsAdmin(false)
      onCreated()
      return 'User created.'
    })
  }

  return (
    <div className="editor">
      <h3>Create user</h3>
      {err && <div className="banner err">{err}</div>}
      {ok && <div className="banner ok">{ok}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-row"><label>Username</label>
            <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jdoe" /></div>
          <div className="form-row"><label>Password</label>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="form-row"><label>Administrator</label>
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /></div>
          <div className="form-row"><label>&nbsp;</label>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Creating…' : '+ Create'}</button></div>
        </div>
      </form>
    </div>
  )
}

// ── Reset-password inline row ──────────────────────────────────────────────────

function ResetRow({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, ok, run, busy] = useAsync()
  return (
    <tr className="subrow">
      <td colSpan={6}>
        <div className="row-gap">
          <span className="muted">New password for <b>{user.username}</b>:</span>
          <input className="field inline" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn xs primary" disabled={busy} onClick={() => run(async () => {
            if (pw.length < 4) throw new Error('Password must be at least 4 characters')
            await setUserPassword(user.id, pw); setPw(''); onDone(); return 'Done.'
          })}>Set</button>
          {err && <span className="err-cell">{err}</span>}
          {ok && <span className="ok-cell">{ok}</span>}
        </div>
      </td>
    </tr>
  )
}

// ── Users table ───────────────────────────────────────────────────────────────

export function UsersPanel() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [resetId, setResetId] = useState<number | null>(null)
  const [err, , run, busy] = useAsync()
  const myId = getUserId()

  const reload = () => run(async () => { const r = await listUsers(); setRows(r.rows) })
  useEffect(() => { reload() }, [])

  const toggleActive = (u: UserRow) => run(async () => {
    if (u.id === myId && u.status_id_fk === 1) throw new Error('You cannot deactivate the account you are signed in as')
    await setUserActive(u.id, u.status_id_fk !== 1)
    await reloadInner()
  })
  const toggleAdmin = (u: UserRow) => run(async () => { await setUserAdmin(u.id, u.is_admin !== 1); await reloadInner() })
  const remove = (u: UserRow) => run(async () => {
    if (u.id === myId) throw new Error('You cannot delete the account you are signed in as')
    await deleteUser(u.id); await reloadInner()
  })
  const reloadInner = async () => { const r = await listUsers(); setRows(r.rows) }

  return (
    <div>
      <MyPassword />
      <CreateUser onCreated={reload} />

      <div className="panel-head" style={{ marginTop: 18 }}>
        <h2>Users <span className="muted">({rows.length})</span></h2>
        <button className="btn" onClick={reload} disabled={busy}>Refresh</button>
      </div>
      {err && <div className="banner err">{err}</div>}

      <table className="grid">
        <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <Fragment key={u.id}>
              <tr>
                <td>{u.id}</td>
                <td className="mono">{u.username}{u.id === myId && <span className="muted"> (you)</span>}</td>
                <td>{u.is_admin === 1 ? <span className="pill on">admin</span> : <span className="pill off">user</span>}</td>
                <td>{u.status_id_fk === 1 ? <span className="pill on">active</span> : <span className="pill pending">disabled</span>}</td>
                <td className="muted">{u.last_login_date ? new Date(u.last_login_date * 1000).toLocaleString() : '—'}</td>
                <td className="actions">
                  <button className="btn xs" onClick={() => setResetId(resetId === u.id ? null : u.id)}>Password</button>
                  <button className="btn xs" onClick={() => toggleAdmin(u)}>{u.is_admin === 1 ? 'Demote' : 'Promote'}</button>
                  {u.status_id_fk === 1
                    ? <button className="btn xs warn" disabled={u.id === myId} onClick={() => toggleActive(u)}>Deactivate</button>
                    : <button className="btn xs primary" onClick={() => toggleActive(u)}>Activate</button>}
                  <button className="btn xs danger" disabled={u.id === myId} onClick={() => remove(u)}>Del</button>
                </td>
              </tr>
              {resetId === u.id && <ResetRow user={u} onDone={() => setResetId(null)} />}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No users.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

import { useState } from 'react'
import { login, getApiBase, setApiBase, defaultApiBase } from './api'
import { ThemeToggle } from './ThemeToggle'

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('ADMIN')
  const [password, setPassword] = useState('')
  const [base, setBase] = useState(getApiBase())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      setApiBase(base.trim() || defaultApiBase())
      await login(username.trim(), password)
      onLoggedIn()
    } catch (e: any) {
      setErr(e?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-top"><ThemeToggle /></div>
        <h1>Pulse Admin</h1>
        <p className="muted">Sign in to manage routes, services, schedulers &amp; functions.</p>
        {err && <div className="banner err">{err}</div>}
        <label>Username</label>
        <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label>Password</label>
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label>API endpoint</label>
        <input className="field" value={base} onChange={(e) => setBase(e.target.value)} spellCheck={false} />
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">Default credentials: ADMIN / admin123</p>
      </form>
    </div>
  )
}

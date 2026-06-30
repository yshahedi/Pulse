import { useState } from 'react'
import { Monitor } from './Monitor'
import { Login } from './Login'
import { RoutesPanel, ServicesPanel, SchedulersPanel, FunctionsPanel } from './Admin'
import { UsersPanel } from './Users'
import { ThemeToggle } from './ThemeToggle'
import { isAuthed, getUser, getIsAdmin, logout } from './api'

type Tab = 'monitor' | 'routes' | 'services' | 'schedulers' | 'functions' | 'users'

// `admin: true` tabs are management pages; non-admin ("user" role) accounts only
// get the Monitoring tab. The backend independently enforces this via
// PERMISSION_MAP, so hiding the tabs is a UX guard, not the security boundary.
const TABS: { id: Tab; label: string; admin: boolean }[] = [
  { id: 'routes', label: 'Routes', admin: true },
  { id: 'services', label: 'Services', admin: true },
  { id: 'schedulers', label: 'Schedulers', admin: true },
  { id: 'functions', label: 'Functions', admin: true },
  { id: 'users', label: 'Users', admin: true },
  { id: 'monitor', label: 'Monitoring', admin: false },
]

export function App() {
  const [authed, setAuthed] = useState(isAuthed())
  const isAdmin = getIsAdmin()
  const visibleTabs = TABS.filter((t) => isAdmin || !t.admin)
  const [tab, setTab] = useState<Tab>(isAdmin ? 'routes' : 'monitor')

  if (!authed) return <Login onLoggedIn={() => setAuthed(true)} />

  const signOut = () => { logout(); setAuthed(false) }

  return (
    <div className="app">
      <header>
        <h1>Pulse Admin</h1>
        <div className="conn">
          <span className="muted">{getUser()}</span>
          <span className={`pill ${isAdmin ? 'on' : 'off'}`}>{isAdmin ? 'admin' : 'user'}</span>
          <ThemeToggle />
          <button className="btn xs" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav className="tabs">
        {visibleTabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <main>
        {isAdmin && tab === 'routes' && <RoutesPanel />}
        {isAdmin && tab === 'services' && <ServicesPanel />}
        {isAdmin && tab === 'schedulers' && <SchedulersPanel />}
        {isAdmin && tab === 'functions' && <FunctionsPanel />}
        {isAdmin && tab === 'users' && <UsersPanel />}
        {tab === 'monitor' && <Monitor />}
      </main>
    </div>
  )
}

import { useState } from 'react'
import { getTheme, setTheme, type Theme } from './theme'

export function ThemeToggle() {
  const [t, setT] = useState<Theme>(getTheme())
  const toggle = () => {
    const next: Theme = t === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setT(next)
  }
  return (
    <button className="btn xs" onClick={toggle} title="Toggle light / dark theme">
      {t === 'dark' ? '☀ Light' : '🌙 Dark'}
    </button>
  )
}

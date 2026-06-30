// Light/dark theme. The palette lives in styles.css as CSS variables; switching
// just sets data-theme on <html>, which a [data-theme="light"] block overrides.
// The choice is persisted so it survives reloads.

export type Theme = 'dark' | 'light'

const KEY = 'pulse_admin_theme'

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) === 'light' ? 'light' : 'dark'
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t)
  applyTheme(t)
}

// Call once at startup before render so there's no flash of the wrong theme.
export function initTheme() {
  applyTheme(getTheme())
}

export const THEME_STORAGE_KEY = 'mux.theme'

export type ColorMode = 'light' | 'dark' | 'system'

export type ThemeAccent = 'neutral' | 'blue' | 'violet' | 'green' | 'orange' | 'rose'

export type ThemePrefs = {
  colorMode: ColorMode
  accent: ThemeAccent
}

export const DEFAULT_THEME_PREFS: ThemePrefs = {
  colorMode: 'dark',
  accent: 'neutral',
}

export const THEME_ACCENTS: ReadonlyArray<{ id: ThemeAccent; label: string; swatch: string }> = [
  { id: 'neutral', label: 'Neutral', swatch: 'oklch(0.556 0 0)' },
  { id: 'blue', label: 'Blue', swatch: 'oklch(0.55 0.19 255)' },
  { id: 'violet', label: 'Violet', swatch: 'oklch(0.55 0.22 290)' },
  { id: 'green', label: 'Green', swatch: 'oklch(0.58 0.17 145)' },
  { id: 'orange', label: 'Orange', swatch: 'oklch(0.68 0.17 55)' },
  { id: 'rose', label: 'Rose', swatch: 'oklch(0.58 0.2 15)' },
]

const ACCENT_SET = new Set<string>(THEME_ACCENTS.map((a) => a.id))

function isColorMode(v: unknown): v is ColorMode {
  return v === 'light' || v === 'dark' || v === 'system'
}

function isThemeAccent(v: unknown): v is ThemeAccent {
  return typeof v === 'string' && ACCENT_SET.has(v)
}

export function readThemePrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw == null) return { ...DEFAULT_THEME_PREFS }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      colorMode: isColorMode(parsed.colorMode) ? parsed.colorMode : DEFAULT_THEME_PREFS.colorMode,
      accent: isThemeAccent(parsed.accent) ? parsed.accent : DEFAULT_THEME_PREFS.accent,
    }
  } catch {
    return { ...DEFAULT_THEME_PREFS }
  }
}

export function writeThemePrefs(prefs: ThemePrefs): ThemePrefs {
  const normalized: ThemePrefs = {
    colorMode: isColorMode(prefs.colorMode) ? prefs.colorMode : DEFAULT_THEME_PREFS.colorMode,
    accent: isThemeAccent(prefs.accent) ? prefs.accent : DEFAULT_THEME_PREFS.accent,
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    /* quota / private mode */
  }
  return normalized
}

export function resolveColorScheme(colorMode: ColorMode): 'light' | 'dark' {
  if (colorMode === 'light') return 'light'
  if (colorMode === 'dark') return 'dark'
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

/** Apply prefs to `<html>`; returns the resolved light/dark scheme. */
export function applyTheme(prefs: ThemePrefs): 'light' | 'dark' {
  const scheme = resolveColorScheme(prefs.colorMode)
  const root = document.documentElement
  root.classList.toggle('dark', scheme === 'dark')
  root.dataset.accent = prefs.accent
  return scheme
}

import { create } from 'zustand'

import {
  applyTheme,
  readThemePrefs,
  writeThemePrefs,
  type ColorMode,
  type ThemeAccent,
  type ThemePrefs,
} from '@/lib/persisted-theme'

type ThemeState = {
  colorMode: ColorMode
  accent: ThemeAccent
  resolvedScheme: 'light' | 'dark'
  setColorMode: (mode: ColorMode) => void
  setAccent: (accent: ThemeAccent) => void
  hydrateFromDisk: () => void
}

function syncDom(prefs: ThemePrefs): 'light' | 'dark' {
  return applyTheme(prefs)
}

function syncNativeChrome(colorMode: ColorMode): void {
  void window.mux.theme.syncNativeChrome(colorMode)
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorMode: readThemePrefs().colorMode,
  accent: readThemePrefs().accent,
  resolvedScheme: 'dark',

  hydrateFromDisk: () => {
    const prefs = readThemePrefs()
    const resolvedScheme = syncDom(prefs)
    syncNativeChrome(prefs.colorMode)
    set({ colorMode: prefs.colorMode, accent: prefs.accent, resolvedScheme })
  },

  setColorMode: (mode) => {
    const prefs = writeThemePrefs({ ...get(), colorMode: mode })
    const resolvedScheme = syncDom(prefs)
    syncNativeChrome(prefs.colorMode)
    set({ colorMode: prefs.colorMode, resolvedScheme })
  },

  setAccent: (accent) => {
    const prefs = writeThemePrefs({ ...get(), accent })
    const resolvedScheme = syncDom(prefs)
    set({ accent: prefs.accent, resolvedScheme })
  },
}))

import { BrowserWindow, nativeTheme } from 'electron'

/** Matches renderer `--background` (oklch(0.145 0 0)). */
export const DARK_WINDOW_BACKGROUND = '#252525'
export const LIGHT_WINDOW_BACKGROUND = '#ffffff'

export type UiColorMode = 'light' | 'dark' | 'system'

export function isUiColorMode(value: unknown): value is UiColorMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function defaultUiColorMode(): UiColorMode {
  return 'dark'
}

function isDarkChrome(colorMode: UiColorMode): boolean {
  if (colorMode === 'dark') return true
  if (colorMode === 'light') return false
  return nativeTheme.shouldUseDarkColors
}

/** Window fill before the renderer paints; call after `nativeTheme.themeSource` is set. */
export function windowBackgroundColor(colorMode: UiColorMode): string {
  return isDarkChrome(colorMode) ? DARK_WINDOW_BACKGROUND : LIGHT_WINDOW_BACKGROUND
}

/**
 * Sync OS chrome (title bar, menu bar, context menus) with app light/dark/system mode.
 * On Windows, set `nativeTheme.themeSource` before creating the window when possible.
 */
export function applyNativeChromeTheme(colorMode: UiColorMode, win?: BrowserWindow | null): void {
  nativeTheme.themeSource = colorMode
  const bg = windowBackgroundColor(colorMode)
  const targets = win ? [win] : BrowserWindow.getAllWindows()
  for (const target of targets) {
    if (target.isDestroyed()) continue
    target.setBackgroundColor(bg)
  }
}

let nativeThemeListenerRegistered = false

/** Re-apply chrome when OS appearance changes while the app is in system mode. */
export function registerNativeChromeThemeListener(
  readColorMode: () => UiColorMode,
): void {
  if (nativeThemeListenerRegistered) return
  nativeThemeListenerRegistered = true
  nativeTheme.on('updated', () => {
    if (readColorMode() !== 'system') return
    applyNativeChromeTheme('system')
  })
}

import os from 'node:os'

import { ipcMain } from 'electron'

import {
  applyNativeChromeTheme,
  isUiColorMode,
  registerNativeChromeThemeListener,
} from './native-chrome-theme'
import { readUiColorMode, writeUiColorMode } from './persisted-store'

/** App-level IPC registered with the rest of the main process (re-register safe for dev HMR). */
export function registerAppIpc() {
  ipcMain.removeHandler('app:getHomeDir')
  ipcMain.handle('app:getHomeDir', () => os.homedir())

  ipcMain.removeHandler('theme:sync-native-chrome')
  ipcMain.handle('theme:sync-native-chrome', (_event, payload: unknown) => {
    if (!isUiColorMode(payload)) {
      return { ok: false as const, colorMode: readUiColorMode() }
    }
    const colorMode = writeUiColorMode(payload)
    applyNativeChromeTheme(colorMode)
    return { ok: true as const, colorMode }
  })

  registerNativeChromeThemeListener(readUiColorMode)
}

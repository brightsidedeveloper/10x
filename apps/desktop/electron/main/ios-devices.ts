import { execFile } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { ipcMain } from 'electron'

const execFileAsync = promisify(execFile)

/**
 * Open the generated `.xcworkspace` in Xcode (falls back to the ios/ dir, then the app) so the
 * user can do the one-time signing setup + first device build that the CLI can't drive.
 */
async function openIosProject(cwd: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const iosDir = path.join(cwd, 'ios')
    let target = iosDir
    if (existsSync(iosDir)) {
      const ws = readdirSync(iosDir).find((entry) => entry.endsWith('.xcworkspace'))
      if (ws) target = path.join(iosDir, ws)
    }
    if (existsSync(target)) {
      await execFileAsync('open', ['-a', 'Xcode', target])
    } else {
      await execFileAsync('open', ['-a', 'Xcode'])
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function registerIosIpc() {
  ipcMain.handle('ios:openProject', (_event, cwd: unknown) =>
    typeof cwd === 'string'
      ? openIosProject(cwd)
      : Promise.resolve({ ok: false as const, error: 'No workspace selected.' }),
  )
}

import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { BrowserWindow, ipcMain } from 'electron'
import type { IPty } from 'node-pty'

import fixPath from 'fix-path'

const require = createRequire(import.meta.url)
const pty = require('node-pty') as typeof import('node-pty')

/**
 * Expo only prints the `exp://` dev-client URL when it runs in an interactive TTY, so Expo is
 * spawned through a PTY. The URL arrives wrapped in ANSI escapes — strip those before matching.
 */
// Plain Expo Go (`exp://…`) or a dev-client URL (`exp+<scheme>://expo-development-client/?url=…`).
const EXP_URL_RE = /exp(?:\+[a-z0-9-]+)?:\/\/[A-Za-z0-9._\-:/?=&%@]+/i

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g

/** Keep a little tail of output so a failed start can surface a useful error. */
const ERROR_TAIL_LIMIT = 4_000

export type ExpoState = 'installing' | 'starting' | 'ready' | 'error' | 'closed'

export type ExpoSnapshot = {
  id: string
  cwd: string
  label: string
  state: ExpoState
  url: string | null
  error: string | null
}

type ExpoRecord = ExpoSnapshot & {
  proc: IPty | null
  tail: string
  canceled: boolean
}

const sessions = new Map<string, ExpoRecord>()

let suppressCloseBroadcast = false

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

function snapshot(record: ExpoRecord): ExpoSnapshot {
  const { proc: _proc, tail: _tail, canceled: _canceled, ...view } = record
  return view
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function emitStatus(record: ExpoRecord) {
  broadcast('expo:status', snapshot(record))
}

/** Env for spawned node tooling: keep it out of CI mode (which disables watch/reloads). */
function toolingEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, BROWSER: 'none', NO_COLOR: '1' }
  delete env.CI
  return env
}

/** node-pty wants a fully-defined string env. */
function ptyEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(toolingEnv())) {
    if (value !== undefined) out[key] = String(value)
  }
  return out
}

/**
 * Whether `cwd` looks like an Expo project: `expo` in (dev)dependencies, or an Expo app config
 * (`app.json` with an `expo` key / `app.config.{js,ts,cjs,mjs}`).
 */
export function isExpoProject(cwd: string): boolean {
  if (!cwd) return false
  try {
    const pkgPath = path.join(cwd, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      if (pkg.dependencies?.expo || pkg.devDependencies?.expo) return true
    }
  } catch {
    /* unreadable / malformed package.json — fall through to config checks */
  }

  for (const config of ['app.config.js', 'app.config.ts', 'app.config.cjs', 'app.config.mjs']) {
    if (existsSync(path.join(cwd, config))) return true
  }
  try {
    const appJsonPath = path.join(cwd, 'app.json')
    if (existsSync(appJsonPath)) {
      const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as { expo?: unknown }
      if (appJson.expo) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Whether the project has `expo-dev-client` — i.e. `expo start` serves a dev build, not Expo Go. */
export function isExpoDevClientProject(cwd: string): boolean {
  if (!cwd) return false
  try {
    const pkgPath = path.join(cwd, 'package.json')
    if (!existsSync(pkgPath)) return false
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return Boolean(
      pkg.dependencies?.['expo-dev-client'] || pkg.devDependencies?.['expo-dev-client'],
    )
  } catch {
    return false
  }
}

/** Login shell + args that source the user's profile, so nvm/volta/Homebrew node resolves. */
function resolveLaunchShell(): { command: string; args: (cmd: string) => string[] } {
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe'
    return { command: comspec, args: (cmd) => ['/d', '/s', '/c', cmd] }
  }
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh']
  const shell = candidates.find((c) => c && existsSync(c)) ?? '/bin/sh'
  return { command: shell, args: (cmd) => ['-lc', cmd] }
}

/** Run a one-off command through the login shell, resolving with its exit code + output tail. */
function runShell(command: string, cwd: string): Promise<{ code: number; tail: string }> {
  return new Promise((resolve) => {
    const { command: shell, args } = resolveLaunchShell()
    let tail = ''
    let child: ChildProcess
    try {
      child = spawn(shell, args(command), { cwd, env: toolingEnv(), windowsHide: true })
    } catch (err) {
      resolve({ code: 1, tail: err instanceof Error ? err.message : String(err) })
      return
    }
    const capture = (buf: Buffer) => {
      tail = (tail + buf.toString('utf8')).slice(-ERROR_TAIL_LIMIT)
    }
    child.stdout?.on('data', capture)
    child.stderr?.on('data', capture)
    child.on('error', (err) => resolve({ code: 1, tail: tail || err.message }))
    child.on('close', (code) => resolve({ code: code ?? 1, tail }))
  })
}

/** Expo's `--tunnel` needs `@expo/ngrok`; install it globally (what Expo's own prompt would do). */
async function ensureNgrok(cwd: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await runShell('npm ls -g @expo/ngrok --depth=0', cwd)
  if (check.code === 0) return { ok: true }
  const install = await runShell('npm install -g @expo/ngrok', cwd)
  if (install.code === 0) return { ok: true }
  return {
    ok: false,
    error: `Could not install @expo/ngrok (required for Expo tunnels).\n${install.tail}`.trim(),
  }
}

function killPty(record: ExpoRecord) {
  if (!record.proc) return
  try {
    record.proc.kill()
  } catch {
    /* ignore */
  }
}

export type StartExpoResult =
  | { ok: true; session: ExpoSnapshot }
  | { ok: false; error: string }

/** Spawn `expo start --tunnel` in a PTY and wire output parsing onto an already-registered record. */
function spawnExpo(record: ExpoRecord) {
  const shell = resolveLaunchShell()
  let proc: IPty
  try {
    proc = pty.spawn(shell.command, shell.args('npx expo start --tunnel'), {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: record.cwd,
      env: ptyEnv(),
    })
  } catch (err) {
    record.state = 'error'
    record.error = err instanceof Error ? err.message : String(err)
    emitStatus(record)
    sessions.delete(record.id)
    return
  }

  record.proc = proc
  record.state = 'starting'
  emitStatus(record)

  // Stop was requested while we were installing ngrok — tear down now.
  if (record.canceled) {
    killPty(record)
    return
  }

  proc.onData((data) => {
    record.tail = (record.tail + data).slice(-ERROR_TAIL_LIMIT)
    if (record.url) return
    // Match against the accumulated, ANSI-stripped tail so a URL split across chunks still hits.
    const match = EXP_URL_RE.exec(stripAnsi(record.tail))
    if (match) {
      record.url = match[0]
      record.state = 'ready'
      emitStatus(record)
    }
  })

  proc.onExit(({ exitCode }) => {
    if (record.state !== 'error') {
      record.state = record.state === 'ready' || exitCode === 0 ? 'closed' : 'error'
      if (record.state === 'error' && !record.error) {
        const tail = stripAnsi(record.tail)
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-6)
          .join('\n')
        record.error =
          tail.length > 0
            ? tail
            : `expo start exited with code ${exitCode} before a URL was ready`
      }
    }
    if (!suppressCloseBroadcast) emitStatus(record)
    sessions.delete(record.id)
  })
}

async function launch(record: ExpoRecord) {
  record.state = 'installing'
  emitStatus(record)
  const ngrok = await ensureNgrok(record.cwd)
  if (record.canceled) return
  if (!ngrok.ok) {
    record.state = 'error'
    record.error = ngrok.error
    emitStatus(record)
    sessions.delete(record.id)
    return
  }
  spawnExpo(record)
}

function startExpo(cwd: string): StartExpoResult {
  if (!cwd || !existsSync(cwd)) {
    return { ok: false, error: 'Workspace folder not found.' }
  }
  if (!isExpoProject(cwd)) {
    return { ok: false, error: 'This workspace does not look like an Expo project.' }
  }

  // Reuse a live session for the same folder instead of starting a second Metro.
  for (const existing of sessions.values()) {
    if (existing.cwd === cwd && existing.state !== 'closed' && existing.state !== 'error') {
      return { ok: true, session: snapshot(existing) }
    }
  }

  try {
    fixPath()
  } catch {
    /* ignore */
  }

  const record: ExpoRecord = {
    id: randomUUID(),
    cwd,
    label: path.basename(cwd) || cwd,
    state: 'installing',
    url: null,
    error: null,
    proc: null,
    tail: '',
    canceled: false,
  }
  sessions.set(record.id, record)
  void launch(record)

  return { ok: true, session: snapshot(record) }
}

function stopExpo(id: string): boolean {
  const record = sessions.get(id)
  if (!record) return true
  record.canceled = true
  if (record.proc) {
    killPty(record)
  } else {
    // Not spawned yet (still installing ngrok) — just drop it.
    sessions.delete(id)
  }
  return true
}

export function stopAllExpoSessions(): void {
  suppressCloseBroadcast = true
  for (const record of sessions.values()) {
    record.canceled = true
    killPty(record)
  }
  sessions.clear()
}

export function registerExpoIpc() {
  ipcMain.handle('expo:isProject', (_event, cwd: unknown) =>
    typeof cwd === 'string' ? isExpoProject(cwd) : false,
  )

  ipcMain.handle('expo:isDevClient', (_event, cwd: unknown) =>
    typeof cwd === 'string' ? isExpoDevClientProject(cwd) : false,
  )

  ipcMain.handle('expo:start', (_event, cwd: unknown) => {
    if (typeof cwd !== 'string') {
      return { ok: false as const, error: 'No workspace selected.' }
    }
    return startExpo(cwd)
  })

  ipcMain.handle('expo:stop', (_event, id: unknown) => {
    if (typeof id !== 'string') return false
    return stopExpo(id)
  })

  ipcMain.handle('expo:list', () => [...sessions.values()].map(snapshot))
}

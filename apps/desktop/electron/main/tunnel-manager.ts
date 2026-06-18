import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BrowserWindow } from 'electron'

import fixPath from 'fix-path'

import { bridge } from './ipc-bridge'
import { emitToRemotes } from './remote/remote-broadcast'

const PROBE_TIMEOUT_MS = 12_000

/** Quick tunnels print this once the edge connection is up. */
const TRYCLOUDFLARE_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

export type TunnelKind = 'web' | 'expo' | 'control'

export type TunnelState = 'starting' | 'ready' | 'error' | 'closed'

/** Renderer-facing view of a tunnel (no live process handle). */
export type TunnelSnapshot = {
  id: string
  port: number
  kind: TunnelKind
  state: TunnelState
  url: string | null
  error: string | null
}

type TunnelRecord = TunnelSnapshot & { proc: ChildProcess }

const tunnels = new Map<string, TunnelRecord>()

/** When true, child `close` events are not broadcast (app is quitting / bulk-killing). */
let suppressCloseBroadcast = false

function snapshot(record: TunnelRecord): TunnelSnapshot {
  const { proc: _proc, ...view } = record
  return view
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function emitStatus(record: TunnelRecord) {
  const view = snapshot(record)
  broadcast('tunnel:status', view)
  emitToRemotes('tunnel:status', view)
}

/**
 * Absolute path to `cloudflared`, using the same PATH rules GUI apps get after `fix-path`
 * (macOS) plus the common Homebrew / system locations. Returns null when not found.
 */
function resolveCloudflaredPath(): string | null {
  try {
    fixPath()
  } catch {
    /* fix-path can throw in minimal environments */
  }

  const isWin = process.platform === 'win32'
  const candidates = isWin
    ? [
        path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'cloudflared', 'cloudflared.exe'),
        path.join(os.homedir(), '.local', 'bin', 'cloudflared.exe'),
      ]
    : [
        '/opt/homebrew/bin/cloudflared',
        '/usr/local/bin/cloudflared',
        '/usr/bin/cloudflared',
        path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
      ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  try {
    if (isWin) {
      const comspec = process.env.ComSpec || 'cmd.exe'
      const out = execFileSync(comspec, ['/d', '/s', '/c', 'where cloudflared'], {
        encoding: 'utf8',
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
        env: process.env,
      })
      const first = out.split(/\r?\n/).find((line) => line.trim().length > 0)
      return first ? first.trim() : null
    }
    const out = execFileSync('/bin/sh', ['-c', 'command -v cloudflared'], {
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      env: process.env,
    })
    const resolved = out.trim()
    return resolved.length > 0 ? resolved : null
  } catch {
    return null
  }
}

export function isCloudflaredInstalled(): boolean {
  return resolveCloudflaredPath() !== null
}

export type CloudflaredInstallInfo = {
  command: string
  label: string
  isWindows: boolean
}

/** Suggested install command for the user's platform when `cloudflared` is missing. */
export function cloudflaredInstallInfo(): CloudflaredInstallInfo {
  if (process.platform === 'darwin') {
    return { command: 'brew install cloudflared', label: 'Homebrew', isWindows: false }
  }
  if (process.platform === 'win32') {
    return { command: 'winget install --id Cloudflare.cloudflared', label: 'winget', isWindows: true }
  }
  return {
    command:
      'curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared',
    label: 'manual',
    isWindows: false,
  }
}

function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

export type StartTunnelResult =
  | { ok: true; tunnel: TunnelSnapshot }
  | { ok: false; error: string }

function startTunnel(port: number, kind: TunnelKind): StartTunnelResult {
  const cloudflaredPath = resolveCloudflaredPath()
  if (!cloudflaredPath) {
    return {
      ok: false,
      error: 'cloudflared is not installed. Install it, then try sharing again.',
    }
  }

  // Reuse a live tunnel for the same port instead of spawning a duplicate.
  for (const existing of tunnels.values()) {
    if (existing.port === port && existing.state !== 'closed' && existing.state !== 'error') {
      return { ok: true, tunnel: snapshot(existing) }
    }
  }

  const id = randomUUID()
  let child: ChildProcess
  try {
    child = spawn(
      cloudflaredPath,
      ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`],
      { env: process.env, windowsHide: true },
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const record: TunnelRecord = {
    id,
    port,
    kind,
    state: 'starting',
    url: null,
    error: null,
    proc: child,
  }
  tunnels.set(id, record)

  const handleChunk = (buf: Buffer) => {
    if (record.url) return
    const match = TRYCLOUDFLARE_URL_RE.exec(buf.toString('utf8'))
    if (match) {
      record.url = match[0]
      record.state = 'ready'
      emitStatus(record)
    }
  }
  // cloudflared logs (and the URL banner) go to stderr; watch both streams to be safe.
  child.stdout?.on('data', handleChunk)
  child.stderr?.on('data', handleChunk)

  child.on('error', (err) => {
    record.state = 'error'
    record.error = err.message
    emitStatus(record)
  })

  child.on('close', (code) => {
    const wasReady = record.state === 'ready'
    if (record.state !== 'error') {
      record.state = code === 0 || wasReady ? 'closed' : 'error'
      if (record.state === 'error' && !record.error) {
        record.error = `cloudflared exited with code ${code ?? 'unknown'} before a URL was ready`
      }
    }
    if (!suppressCloseBroadcast) emitStatus(record)
    tunnels.delete(id)
  })

  return { ok: true, tunnel: snapshot(record) }
}

function stopTunnel(id: string): boolean {
  const record = tunnels.get(id)
  if (!record) return true
  try {
    record.proc.kill()
  } catch {
    /* ignore */
  }
  return true
}

/**
 * Start a Cloudflare quick tunnel for the remote-control bridge server. Used by the
 * remote bridge (not the user-facing "Share a dev server" UI); the `'control'` kind
 * lets the renderer filter it out of the shares list.
 */
export function startControlTunnel(port: number): StartTunnelResult {
  return startTunnel(port, 'control')
}

/** Stop a tunnel by id (exported for the remote bridge to tear down its control tunnel). */
export function stopTunnelById(id: string): boolean {
  return stopTunnel(id)
}

/** Current snapshot for a tunnel id, or null if it is no longer tracked. */
export function getTunnelSnapshot(id: string): TunnelSnapshot | null {
  const record = tunnels.get(id)
  return record ? snapshot(record) : null
}

export function stopAllTunnels(): void {
  suppressCloseBroadcast = true
  for (const record of tunnels.values()) {
    try {
      record.proc.kill()
    } catch {
      /* ignore */
    }
  }
  tunnels.clear()
}

export function registerTunnelIpc() {
  bridge.handle('tunnel:isInstalled', () => isCloudflaredInstalled())
  bridge.handle('tunnel:getInstallCommand', () => cloudflaredInstallInfo())

  bridge.handle('tunnel:start', ([args]) => {
    const opts = (args ?? {}) as { port?: unknown; kind?: unknown }
    if (!isValidPort(opts.port)) {
      return { ok: false as const, error: 'Enter a valid port (1–65535).' }
    }
    const kind: TunnelKind = opts.kind === 'expo' ? 'expo' : 'web'
    return startTunnel(opts.port, kind)
  })

  bridge.handle('tunnel:stop', ([id]) => {
    if (typeof id !== 'string') return false
    return stopTunnel(id)
  })

  bridge.handle('tunnel:list', () => [...tunnels.values()].map(snapshot))
}

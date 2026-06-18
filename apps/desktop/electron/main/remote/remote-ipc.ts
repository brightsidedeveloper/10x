/**
 * Desktop-side controls for the remote-control feature. These are IPC-only (never
 * registered on the shared RPC registry) so a paired phone can never enable/disable
 * the bridge, revoke peers, or read the device list — only the desktop user can.
 */

import { ipcMain } from 'electron'

import type {
  PairedDeviceView,
  PairingPayload,
  RemoteControlStatus,
} from '@10x/protocol'

import {
  readRemoteControlConfig,
  removePairedDevice,
  setRemoteControlEnabled,
} from '../persisted-store'
import {
  getTunnelSnapshot,
  isCloudflaredInstalled,
  startControlTunnel,
  stopTunnelById,
} from '../tunnel-manager'
import { issuePairingCode, clearPairingCode } from './auth'
import { connectedDeviceIds } from './remote-broadcast'
import { isBridgeRunning, startBridgeServer, stopBridgeServer } from './bridge-server'

const TUNNEL_READY_TIMEOUT_MS = 30_000
const PROTOCOL_QR_VERSION = 1

let controlTunnelId: string | null = null
let controlTunnelUrl: string | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function deviceViews(): PairedDeviceView[] {
  const connected = connectedDeviceIds()
  return readRemoteControlConfig().devices.map((d) => ({
    id: d.id,
    name: d.name,
    createdAt: d.createdAt,
    lastSeenAt: d.lastSeenAt,
    connected: connected.has(d.id),
  }))
}

function status(): RemoteControlStatus {
  return {
    enabled: readRemoteControlConfig().enabled,
    serverRunning: isBridgeRunning(),
    url: controlTunnelUrl,
    cloudflaredInstalled: isCloudflaredInstalled(),
    devices: deviceViews(),
  }
}

type StartTunnelReady =
  | { ok: true; url: string; id: string }
  | { ok: false; error: string }

async function startControlTunnelReady(port: number): Promise<StartTunnelReady> {
  const res = startControlTunnel(port)
  if (!res.ok) return { ok: false, error: res.error }
  const id = res.tunnel.id
  if (res.tunnel.url) return { ok: true, url: res.tunnel.url, id }

  const start = Date.now()
  while (Date.now() - start < TUNNEL_READY_TIMEOUT_MS) {
    await delay(250)
    const snap = getTunnelSnapshot(id)
    if (!snap) return { ok: false, error: 'Tunnel closed before it was ready' }
    if (snap.state === 'error') return { ok: false, error: snap.error ?? 'Tunnel error' }
    if (snap.url) return { ok: true, url: snap.url, id }
  }
  return { ok: false, error: 'Timed out waiting for the tunnel URL' }
}

type EnableResult =
  | { ok: true; pairing: PairingPayload; status: RemoteControlStatus }
  | { ok: false; error: string }

async function enable(): Promise<EnableResult> {
  if (!isCloudflaredInstalled()) {
    return { ok: false, error: 'cloudflared is not installed. Install it, then enable remote control.' }
  }
  const port = await startBridgeServer()
  if (!controlTunnelId) {
    const tunnel = await startControlTunnelReady(port)
    if (!tunnel.ok) {
      await stopBridgeServer()
      return { ok: false, error: tunnel.error }
    }
    controlTunnelId = tunnel.id
    controlTunnelUrl = tunnel.url
  }
  setRemoteControlEnabled(true)
  const code = issuePairingCode(Date.now())
  const pairing: PairingPayload = { v: PROTOCOL_QR_VERSION, url: controlTunnelUrl as string, code }
  return { ok: true, pairing, status: status() }
}

async function disable(): Promise<RemoteControlStatus> {
  clearPairingCode()
  if (controlTunnelId) {
    stopTunnelById(controlTunnelId)
    controlTunnelId = null
    controlTunnelUrl = null
  }
  await stopBridgeServer()
  setRemoteControlEnabled(false)
  return status()
}

/** Re-issue a pairing code (for adding another device) without restarting anything. */
function rotatePairingCode(): { ok: true; pairing: PairingPayload } | { ok: false; error: string } {
  if (!isBridgeRunning() || !controlTunnelUrl) {
    return { ok: false, error: 'Remote control is not enabled' }
  }
  const code = issuePairingCode(Date.now())
  return { ok: true, pairing: { v: PROTOCOL_QR_VERSION, url: controlTunnelUrl, code } }
}

export function registerRemoteIpc(): void {
  ipcMain.handle('remote:enable', () => enable())
  ipcMain.handle('remote:disable', () => disable())
  ipcMain.handle('remote:status', () => status())
  ipcMain.handle('remote:rotatePairingCode', () => rotatePairingCode())
  ipcMain.handle('remote:revokeDevice', (_event, deviceId: unknown) => {
    if (typeof deviceId !== 'string') return status()
    removePairedDevice(deviceId)
    return status()
  })
}

/** Tear down the bridge + tunnel on app quit. */
export async function shutdownRemoteBridge(): Promise<void> {
  if (controlTunnelId) {
    stopTunnelById(controlTunnelId)
    controlTunnelId = null
    controlTunnelUrl = null
  }
  await stopBridgeServer()
}

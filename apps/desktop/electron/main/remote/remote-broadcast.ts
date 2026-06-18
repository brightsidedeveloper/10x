/**
 * Registry of connected remote (phone) WS clients + the broadcast "tee".
 *
 * Existing managers broadcast to desktop windows via `webContents.send`. To also
 * reach phones, each broadcast site calls {@link emitToRemotes} (events) or
 * {@link emitPtyToRemotes} (per-session terminal frames). Clients only receive
 * channels/sessions they explicitly subscribed to, so we never blast every PTY's
 * bytes down a tunnel to a phone viewing a single agent.
 */

import type { EventChannel, ServerFrame } from '@10x/protocol'

export type RemoteClient = {
  id: string
  deviceId: string
  send: (frame: ServerFrame) => void
  /** Subscribed to the global event stream (tunnel/expo/agent status). */
  events: boolean
  /** PTY sessionIds this client is mirroring. */
  ptySessions: Set<string>
}

const clients = new Set<RemoteClient>()

export function addRemoteClient(client: RemoteClient): void {
  clients.add(client)
}

export function removeRemoteClient(client: RemoteClient): void {
  clients.delete(client)
}

export function remoteClientCount(): number {
  return clients.size
}

export function connectedDeviceIds(): Set<string> {
  const ids = new Set<string>()
  for (const c of clients) ids.add(c.deviceId)
  return ids
}

/** Broadcast an event-stream channel to every subscribed client. */
export function emitToRemotes(channel: EventChannel, payload: unknown): void {
  if (clients.size === 0) return
  for (const client of clients) {
    if (!client.events) continue
    client.send({ t: 'event', channel, payload })
  }
}

/** Stream a PTY frame to clients subscribed to that session. */
export function emitPtyToRemotes(
  sessionId: string,
  frame: Extract<ServerFrame, { t: 'pty' }>,
): void {
  if (clients.size === 0) return
  for (const client of clients) {
    if (!client.ptySessions.has(sessionId)) continue
    client.send(frame)
  }
}

/** Whether any connected client is mirroring this PTY session. */
export function hasPtySubscribers(sessionId: string): boolean {
  for (const client of clients) {
    if (client.ptySessions.has(sessionId)) return true
  }
  return false
}

/**
 * Provider of a current-screen snapshot for a PTY session, set by the headless
 * terminal mirror (Phase 2). Until then there is no replayable screen, so a phone
 * attaching mid-session simply streams from the next byte (see pty-manager note).
 */
let snapshotProvider: ((sessionId: string) => string | null) | null = null

export function setPtySnapshotProvider(fn: (sessionId: string) => string | null): void {
  snapshotProvider = fn
}

/** On subscribe, push the current screen so a reconnecting phone is not blank. */
export function sendPtySnapshotTo(client: RemoteClient, sessionId: string): void {
  const data = snapshotProvider?.(sessionId)
  if (data != null && data.length > 0) {
    client.send({ t: 'pty', op: 'snapshot', sessionId, data })
  }
}

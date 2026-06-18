/**
 * WebSocket frame protocol multiplexed over a single `/ws` connection:
 *   • RPC request/response (same envelope as HTTP `/rpc`)
 *   • event broadcasts (main→client, the IPC `webContents.send` channels)
 *   • PTY streaming (per-session subscribe + bidirectional terminal bytes)
 *   • auth handshake
 */

import type { RpcRequest, RpcResponse } from './rpc'

/** Broadcast channels a client can subscribe to (mirrors `webContents.send` channels). */
export type EventChannel =
  | 'tunnel:status'
  | 'expo:status'
  | 'agent:state-change'
  | 'agent:navigate-to-session'
  | 'agent:notify'
  | 'pty:exit'

/** Topics for WS subscriptions. `pty` is per-session; the rest are global event streams. */
export type SubTopic = 'events' | 'pty'

// ── Client → server ────────────────────────────────────────────────────────

export type ClientAuthFrame = { t: 'auth'; token: string }

export type ClientRpcFrame = { t: 'rpc'; req: RpcRequest }

export type ClientSubFrame =
  | { t: 'sub'; topic: 'events' }
  | { t: 'sub'; topic: 'pty'; sessionId: string }

export type ClientUnsubFrame =
  | { t: 'unsub'; topic: 'events' }
  | { t: 'unsub'; topic: 'pty'; sessionId: string }

export type ClientPtyFrame =
  | { t: 'pty'; op: 'write'; sessionId: string; data: string }
  | { t: 'pty'; op: 'resize'; sessionId: string; cols: number; rows: number }

export type ClientFrame =
  | ClientAuthFrame
  | ClientRpcFrame
  | ClientSubFrame
  | ClientUnsubFrame
  | ClientPtyFrame

// ── Server → client ──────────────────────────────────────────────────────

export type ServerAuthResultFrame =
  | { t: 'auth-ok'; deviceId: string }
  | { t: 'auth-err'; error: string }

export type ServerRpcFrame = { t: 'rpc'; res: RpcResponse }

export type ServerEventFrame = { t: 'event'; channel: EventChannel; payload: unknown }

/**
 * PTY stream frames. `snapshot` carries the current serialized screen (so a phone
 * attaching mid-session sees state immediately, working around the no-scrollback
 * limitation); `data` streams live output; `exit` signals the PTY ended.
 */
export type ServerPtyFrame =
  | { t: 'pty'; op: 'snapshot'; sessionId: string; data: string }
  | { t: 'pty'; op: 'data'; sessionId: string; data: string }
  | { t: 'pty'; op: 'exit'; sessionId: string; exitCode: number; signal?: number }

export type ServerFrame =
  | ServerAuthResultFrame
  | ServerRpcFrame
  | ServerEventFrame
  | ServerPtyFrame

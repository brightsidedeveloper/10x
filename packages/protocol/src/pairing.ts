/**
 * Pairing + auth handshake between the desktop bridge and the mobile client.
 *
 * Flow: desktop shows a QR encoding {@link PairingPayload} (tunnel URL + a
 * single-use, short-lived pairing code). The phone POSTs {@link PairRequest} to
 * `/pair`; the bridge issues a long-lived bearer token (returned once) whose hash
 * is persisted. All subsequent `/rpc` + `/ws` traffic carries that token.
 */

/** Bumped when the wire format changes incompatibly. */
export const PROTOCOL_VERSION = 1

/** JSON encoded into the pairing QR code shown on the desktop. */
export type PairingPayload = {
  v: number
  /** Public tunnel URL, e.g. https://<slug>.trycloudflare.com */
  url: string
  /** Single-use pairing code (5-min TTL), exchanged at /pair for a bearer token. */
  code: string
}

export type PairRequest = {
  code: string
  /** Human-readable device name shown in the desktop's paired-device list. */
  deviceName: string
  /** Optional Expo push token for background agent notifications (Phase 5). */
  pushToken?: string
}

export type PairResponse =
  | { ok: true; deviceId: string; token: string; protocolVersion: number }
  | { ok: false; error: string }

export type HealthResponse = {
  ok: true
  app: '10x'
  protocolVersion: number
  version: string
}

/** Renderer-facing view of a paired device (no secrets). */
export type PairedDeviceView = {
  id: string
  name: string
  createdAt: number
  lastSeenAt: number | null
  connected: boolean
}

/** Desktop-side snapshot of the remote-control feature for the settings panel. */
export type RemoteControlStatus = {
  enabled: boolean
  serverRunning: boolean
  url: string | null
  cloudflaredInstalled: boolean
  devices: PairedDeviceView[]
}

/**
 * The remote-control bridge: a local HTTP + WebSocket server that re-exposes the
 * shared RPC registry (rpc-registry.ts) to a paired phone over a Cloudflare tunnel.
 *
 * Endpoints:
 *   GET  /health  — unauthenticated reachability + protocol/version probe
 *   POST /pair    — unauthenticated; exchanges a single-use pairing code for a token
 *   POST /rpc     — authenticated request/response (mirrors a window.mux invoke)
 *   GET  /ws      — authenticated; multiplexes rpc + event + pty frames
 *
 * Security: every endpoint except /health and /pair requires a Bearer token whose
 * SHA-256 hash matches a persisted PairedDevice. Bound to 127.0.0.1; the tunnel is
 * the only public ingress and is started/stopped with the server.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { app } from 'electron'
import { WebSocketServer, type WebSocket } from 'ws'

import {
  PROTOCOL_VERSION,
  type ClientFrame,
  type PairRequest,
  type PairResponse,
  type RpcRequest,
  type ServerFrame,
} from '@10x/protocol'

import { dispatchRpc } from '../rpc-registry'
import { writePtySession, resizePtySession } from '../pty-manager'
import {
  addPairedDevice,
  readRemoteControlConfig,
  touchPairedDevice,
} from '../persisted-store'
import {
  consumePairingCode,
  generateBearerToken,
  generateDeviceId,
  hashToken,
  hashesEqual,
} from './auth'
import {
  addRemoteClient,
  removeRemoteClient,
  sendPtySnapshotTo,
  type RemoteClient,
} from './remote-broadcast'

const AUTH_FRAME_TIMEOUT_MS = 5_000
const MAX_BODY_BYTES = 1_000_000

type RunningBridge = {
  server: Server
  wss: WebSocketServer
  port: number
}

let running: RunningBridge | null = null
let clientSeq = 0

export function isBridgeRunning(): boolean {
  return running !== null
}

export function bridgePort(): number | null {
  return running?.port ?? null
}

// ── auth ────────────────────────────────────────────────────────────────────

function bearerFromHeader(req: IncomingMessage): string | null {
  const header = req.headers['authorization']
  if (typeof header !== 'string') return null
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1] : null
}

/** Returns the matching device id for a token, or null. Touches "last seen" on match. */
function authenticateToken(token: string | null): string | null {
  if (!token) return null
  const hash = hashToken(token)
  const { devices } = readRemoteControlConfig()
  for (const device of devices) {
    if (hashesEqual(device.tokenHash, hash)) {
      touchPairedDevice(device.id, Date.now())
      return device.id
    }
  }
  return null
}

// ── HTTP ──────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  res.end(text)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function handlePair(body: unknown): PairResponse {
  const req = (body ?? {}) as Partial<PairRequest>
  if (typeof req.code !== 'string' || typeof req.deviceName !== 'string') {
    return { ok: false, error: 'Malformed pairing request' }
  }
  if (!consumePairingCode(req.code, Date.now())) {
    return { ok: false, error: 'Pairing code is invalid or expired' }
  }
  const token = generateBearerToken()
  const deviceId = generateDeviceId()
  addPairedDevice({
    id: deviceId,
    name: req.deviceName.slice(0, 80) || 'Phone',
    tokenHash: hashToken(token),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    ...(typeof req.pushToken === 'string' ? { pushToken: req.pushToken } : {}),
  })
  return { ok: true, deviceId, token, protocolVersion: PROTOCOL_VERSION }
}

async function handleRpcHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const deviceId = authenticateToken(bearerFromHeader(req))
  if (!deviceId) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
  let body: unknown
  try {
    body = await readBody(req)
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: (err as Error).message })
  }
  const rpc = (body ?? {}) as Partial<RpcRequest>
  if (typeof rpc.id !== 'string' || typeof rpc.channel !== 'string') {
    return sendJson(res, 400, { ok: false, error: 'Malformed RPC request' })
  }
  try {
    const result = await dispatchRpc(rpc.channel, Array.isArray(rpc.args) ? rpc.args : [], {
      source: 'remote',
      clientId: deviceId,
    })
    sendJson(res, 200, { id: rpc.id, ok: true, result })
  } catch (err) {
    sendJson(res, 200, { id: rpc.id, ok: false, error: (err as Error).message })
  }
}

function handleHttp(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/'
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    })
    res.end()
    return
  }
  if (req.method === 'GET' && url.startsWith('/health')) {
    sendJson(res, 200, {
      ok: true,
      app: '10x',
      protocolVersion: PROTOCOL_VERSION,
      version: app.getVersion(),
    })
    return
  }
  if (req.method === 'POST' && url.startsWith('/pair')) {
    void readBody(req)
      .then((body) => sendJson(res, 200, handlePair(body)))
      .catch((err) => sendJson(res, 400, { ok: false, error: (err as Error).message }))
    return
  }
  if (req.method === 'POST' && url.startsWith('/rpc')) {
    void handleRpcHttp(req, res)
    return
  }
  sendJson(res, 404, { ok: false, error: 'Not found' })
}

// ── WebSocket ───────────────────────────────────────────────────────────────

function send(ws: WebSocket, frame: ServerFrame): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame))
}

function handleConnection(ws: WebSocket, req: IncomingMessage): void {
  // Allow the token either in the Authorization header (RN can set it) or a first
  // `auth` frame. Either way the socket must authenticate within the timeout.
  let deviceId = authenticateToken(bearerFromHeader(req))
  let client: RemoteClient | null = null

  const register = (id: string) => {
    deviceId = id
    client = {
      id: `c${++clientSeq}`,
      deviceId: id,
      send: (frame) => send(ws, frame),
      events: false,
      ptySessions: new Set<string>(),
    }
    addRemoteClient(client)
    send(ws, { t: 'auth-ok', deviceId: id })
  }

  if (deviceId) register(deviceId)

  const authTimer = setTimeout(() => {
    if (!client) {
      send(ws, { t: 'auth-err', error: 'Authentication timeout' })
      ws.close()
    }
  }, AUTH_FRAME_TIMEOUT_MS)

  ws.on('message', (raw) => {
    let frame: ClientFrame
    try {
      frame = JSON.parse(raw.toString()) as ClientFrame
    } catch {
      return
    }

    if (frame.t === 'auth') {
      if (client) return
      const id = authenticateToken(frame.token)
      if (!id) {
        send(ws, { t: 'auth-err', error: 'Invalid token' })
        ws.close()
        return
      }
      register(id)
      return
    }

    if (!client) return // not authenticated yet — ignore everything else

    switch (frame.t) {
      case 'rpc': {
        const { id, channel, args } = frame.req
        void dispatchRpc(channel, Array.isArray(args) ? args : [], {
          source: 'remote',
          clientId: client.deviceId,
        })
          .then((result) => send(ws, { t: 'rpc', res: { id, ok: true, result } }))
          .catch((err) =>
            send(ws, { t: 'rpc', res: { id, ok: false, error: (err as Error).message } }),
          )
        return
      }
      case 'sub': {
        if (frame.topic === 'events') client.events = true
        else {
          client.ptySessions.add(frame.sessionId)
          sendPtySnapshotTo(client, frame.sessionId)
        }
        return
      }
      case 'unsub': {
        if (frame.topic === 'events') client.events = false
        else client.ptySessions.delete(frame.sessionId)
        return
      }
      case 'pty': {
        if (frame.op === 'write') writePtySession(frame.sessionId, frame.data)
        else resizePtySession(frame.sessionId, frame.cols, frame.rows)
        return
      }
    }
  })

  ws.on('close', () => {
    clearTimeout(authTimer)
    if (client) removeRemoteClient(client)
  })
  ws.on('error', () => {
    if (client) removeRemoteClient(client)
  })
}

// ── lifecycle ─────────────────────────────────────────────────────────────

/** Start the bridge on an ephemeral 127.0.0.1 port. Idempotent. */
export async function startBridgeServer(): Promise<number> {
  if (running) return running.port

  const server = createServer(handleHttp)
  const wss = new WebSocketServer({ server, path: '/ws' })
  wss.on('connection', handleConnection)

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve(addr.port)
      else reject(new Error('Failed to determine bridge port'))
    })
  })

  running = { server, wss, port }
  return port
}

export async function stopBridgeServer(): Promise<void> {
  const current = running
  running = null
  if (!current) return
  for (const ws of current.wss.clients) {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
  await new Promise<void>((resolve) => current.wss.close(() => resolve()))
  await new Promise<void>((resolve) => current.server.close(() => resolve()))
}

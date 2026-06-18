/**
 * A single channel→handler table shared by BOTH transports:
 *   • Electron IPC (the desktop renderer, via ipc-bridge.ts)
 *   • the remote network bridge (the phone, via remote/bridge-server.ts)
 *
 * Handlers are registered once (through `bridge.handle` in ipc-bridge.ts) and can
 * then be invoked by either transport with an identical positional-args array,
 * so the desktop and mobile clients can never drift from a single source of truth.
 */

/** Where a dispatch originated. Handlers that need a window branch on `source`. */
export type RpcContext = {
  source: 'ipc' | 'remote'
  /** Bridge client id when `source === 'remote'`. */
  clientId?: string
}

export type RpcHandler = (args: unknown[], ctx: RpcContext) => unknown | Promise<unknown>

const registry = new Map<string, RpcHandler>()

/** Channels that must never be reachable from a remote client (desktop-only). */
const remoteDenyList = new Set<string>(['dialog:pickWorkspace'])

export function registerRpc(channel: string, handler: RpcHandler): void {
  registry.set(channel, handler)
}

export function hasRpc(channel: string): boolean {
  return registry.has(channel)
}

export function isRemoteAllowed(channel: string): boolean {
  return !remoteDenyList.has(channel)
}

export async function dispatchRpc(
  channel: string,
  args: unknown[],
  ctx: RpcContext,
): Promise<unknown> {
  if (ctx.source === 'remote' && !isRemoteAllowed(channel)) {
    throw new Error(`Channel "${channel}" is not available remotely`)
  }
  const handler = registry.get(channel)
  if (!handler) throw new Error(`Unknown channel: ${channel}`)
  return await handler(Array.isArray(args) ? args : [], ctx)
}

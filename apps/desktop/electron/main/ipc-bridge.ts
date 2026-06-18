/**
 * Drop-in replacements for `ipcMain.handle` / `ipcMain.on` that ALSO populate the
 * shared RPC registry (rpc-registry.ts), so each handler is reachable from both the
 * desktop renderer (Electron IPC) and the remote bridge (phone) with one definition.
 *
 * Migration is mechanical: a manager that had
 *     ipcMain.handle('git:commit', (_event, args) => …)
 * becomes
 *     bridge.handle('git:commit', (args) => …)
 * The handler body and any module-private state are untouched.
 *
 * `handle` is for request/response ("invoke") channels. Fire-and-forget channels
 * (`pty:write`, `pty:resize`, `agent:*` sends) stay on `ipcMain.on` for the desktop
 * and are exposed to the bridge as dedicated WS frames, not through this table.
 */

import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'

import { registerRpc, type RpcContext } from './rpc-registry'

/**
 * Register a request/response handler on both transports.
 *
 * The handler receives the call's positional args (already spread) plus the
 * {@link RpcContext}. Most handlers ignore `ctx`; ones that need a BrowserWindow
 * or must behave differently for remote callers branch on `ctx.source`.
 */
export function handle(
  channel: string,
  fn: (args: unknown[], ctx: RpcContext) => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) =>
    fn(args, { source: 'ipc', clientId: String(event.sender.id) }),
  )
  registerRpc(channel, (args, ctx) => fn(args, ctx))
}

/**
 * Convenience wrapper for the common single-or-multi positional-arg shape. The
 * callback signature reads like the original IPC handler minus the `event` param.
 */
export function handleArgs<A extends unknown[], R>(
  channel: string,
  fn: (...args: A) => R | Promise<R>,
): void {
  handle(channel, (args) => fn(...(args as A)))
}

export const bridge = { handle, handleArgs }

/**
 * Remote-only RPC channels that don't map 1:1 to an existing IPC handler.
 *
 * The desktop renderer reads/writes the store through the generic `store:get` /
 * `store:set` channels (index.ts). Exposing those generically to a phone would leak
 * every key (including future secrets), so the bridge instead offers explicit,
 * narrowly-scoped channels registered directly on the RPC registry (no ipcMain).
 */

import { app } from 'electron'

import type { AgentTabsByWorkspace, WorkspaceEntry } from '@10x/protocol'

import { registerRpc } from '../rpc-registry'
import { tenxStore } from '../persisted-store'

export function registerRemoteReadHandlers(): void {
  // app:getHomeDir is already on the registry via bridge.handle (app-ipc.ts).
  registerRpc('app:getVersion', () => app.getVersion())

  registerRpc('store:getWorkspaces', () => tenxStore.get('workspaces'))
  registerRpc('store:setWorkspaces', (args) => {
    tenxStore.set('workspaces', (args[0] ?? []) as WorkspaceEntry[])
    return true
  })
  registerRpc('store:getAgentTabs', () => tenxStore.get('agentTabsByWorkspace'))
  registerRpc('store:setAgentTabs', (args) => {
    tenxStore.set('agentTabsByWorkspace', (args[0] ?? {}) as AgentTabsByWorkspace)
    return true
  })
}

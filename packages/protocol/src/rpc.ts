/**
 * RPC envelope + the canonical channel→(args,result) map.
 *
 * Every request/response ("invoke"-style) IPC channel that is safe to expose
 * remotely appears in {@link RpcChannelMap}. The desktop registers a handler per
 * channel (see ipc-bridge.ts) and the mobile client derives a fully-typed surface
 * from this same map, so the two cannot drift.
 *
 * Fire-and-forget channels (pty:write, pty:resize, agent:*) and main→client
 * broadcasts are modelled as WS frames in ./ws.ts, not here.
 */

import type {
  AgentNotificationPrefs,
  AgentTabsByWorkspace,
  ClaudeInstallCommand,
  ClaudePermissionMode,
  CreateWorktreeResult,
  ExpoStartResult,
  ExpoSnapshot,
  GitClassifyResult,
  GitCloneResult,
  GitCommitInspectResult,
  GitDiffMode,
  GitDiffResult,
  GitLogGraphResult,
  GitOpenOriginResult,
  GitRemoteOriginStatus,
  GitSimpleResult,
  GitStatusFilesResult,
  GitWorkingTreeSummaryResult,
  GithubCreatePr,
  GithubCreatePrContext,
  GithubCreatePrDraft,
  GithubCreateRepo,
  GithubCreateRepoAndLink,
  GithubCreateRepoWorkspace,
  GithubDeviceStart,
  GithubPoll,
  GithubStatus,
  PtyCreateOpts,
  PtyCreateResult,
  RecoverableWorktree,
  RemoveMuxWorktreeResult,
  ShellResult,
  TerminalShellOptionsResult,
  TerminalShellPreference,
  TerminalShellPreferenceResult,
  TunnelInstallInfo,
  TunnelSnapshot,
  TunnelStartResult,
  UpdaterCheckResult,
  WorkspaceEntry,
} from './domain'

/** A single RPC call over HTTP `/rpc` or a WS `rpc` frame. */
export type RpcRequest = {
  id: string
  channel: string
  args: unknown[]
}

export type RpcResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string }

/** Each entry: the positional args tuple and the resolved result for a channel. */
export type RpcChannelMap = {
  // ── app / store / shell ──────────────────────────────────────────────
  'app:getHomeDir': { args: []; result: string }
  'app:getVersion': { args: []; result: string }
  'store:getWorkspaces': { args: []; result: WorkspaceEntry[] }
  'store:setWorkspaces': { args: [WorkspaceEntry[]]; result: boolean }
  'store:getAgentTabs': { args: []; result: AgentTabsByWorkspace }
  'store:setAgentTabs': { args: [AgentTabsByWorkspace]; result: boolean }
  'shell:openExternal': { args: [string]; result: ShellResult }
  'shell:get-terminal-preference': { args: []; result: TerminalShellPreference }
  'shell:set-terminal-preference': {
    args: [TerminalShellPreference]
    result: TerminalShellPreferenceResult
  }
  'shell:list-terminal-shell-options': { args: []; result: TerminalShellOptionsResult }

  // ── git ──────────────────────────────────────────────────────────────
  'git:classify': { args: [string]; result: GitClassifyResult }
  'git:clone': {
    args: [{ url: string; parentDir: string; folderName?: string }]
    result: GitCloneResult
  }
  'git:remoteOriginStatus': { args: [string]; result: GitRemoteOriginStatus }
  'git:createWorktree': {
    args: [{ repoCwd: string; worktreeName: string }]
    result: CreateWorktreeResult
  }
  'git:listRecoverableMuxWorktrees': { args: [string]; result: RecoverableWorktree[] }
  'git:removeMuxWorktree': { args: [string]; result: RemoveMuxWorktreeResult }
  'git:cleanupMergedMuxWorktree': { args: [string]; result: RemoveMuxWorktreeResult }
  'git:init': { args: [string]; result: GitSimpleResult }
  'git:addAll': { args: [string]; result: GitSimpleResult }
  'git:statusFiles': { args: [string]; result: GitStatusFilesResult }
  'git:addPaths': { args: [{ cwd: string; paths: string[] }]; result: GitSimpleResult }
  'git:resetPathsHead': { args: [{ cwd: string; paths: string[] }]; result: GitSimpleResult }
  'git:unstageAll': { args: [string]; result: GitSimpleResult }
  'git:discardWorktreePath': { args: [{ cwd: string; path: string }]; result: GitSimpleResult }
  'git:commit': { args: [{ cwd: string; message: string }]; result: GitSimpleResult }
  'git:push': { args: [string]; result: GitSimpleResult }
  'git:pull': { args: [string]; result: GitSimpleResult }
  'git:fetch': { args: [string]; result: GitSimpleResult }
  'git:addRemote': {
    args: [{ cwd: string; remoteName: string; url: string }]
    result: GitSimpleResult
  }
  'git:diff': { args: [{ cwd: string; mode: GitDiffMode }]; result: GitDiffResult }
  'git:workingTreeSummary': { args: [string]; result: GitWorkingTreeSummaryResult }
  'git:logGraph': { args: [string]; result: GitLogGraphResult }
  'git:commitInspect': { args: [{ cwd: string; hash: string }]; result: GitCommitInspectResult }
  'git:commitDiff': { args: [{ cwd: string; hash: string }]; result: GitDiffResult }
  'git:openOriginInBrowser': { args: [string]; result: GitOpenOriginResult }
  'git:openCommitOnGithub': { args: [{ cwd: string; hash: string }]; result: GitOpenOriginResult }

  // ── github ───────────────────────────────────────────────────────────
  'github:deviceStart': { args: []; result: GithubDeviceStart }
  'github:devicePoll': { args: [string]; result: GithubPoll }
  'github:getStatus': { args: []; result: GithubStatus }
  'github:disconnect': { args: []; result: { ok: true } }
  'github:createRepo': {
    args: [{ name: string; description?: string; private?: boolean }]
    result: GithubCreateRepo
  }
  'github:createRepoAndLink': {
    args: [{ cwd: string; name: string; description?: string; private?: boolean }]
    result: GithubCreateRepoAndLink
  }
  'github:createRepoWorkspace': {
    args: [{ parentDir: string; name: string; description?: string; private?: boolean }]
    result: GithubCreateRepoWorkspace
  }
  'github:getCreatePrContext': { args: [string]; result: GithubCreatePrContext }
  'github:getCreatePrDraft': { args: [string]; result: GithubCreatePrDraft }
  'github:createPr': { args: [{ cwd: string; title: string; body: string }]; result: GithubCreatePr }
  'github:mergePr': { args: [string]; result: { ok: true } | { ok: false; error: string } }

  // ── claude code / agent prefs ─────────────────────────────────────────
  'claudeCode:isCliInstalled': { args: []; result: boolean }
  'claudeCode:getInstallCommand': { args: []; result: ClaudeInstallCommand }
  'agent:get-notification-prefs': { args: []; result: AgentNotificationPrefs }
  'agent:set-notification-prefs': {
    args: [AgentNotificationPrefs]
    result: { ok: boolean; prefs: AgentNotificationPrefs }
  }
  'agent:get-permission-mode': { args: []; result: ClaudePermissionMode }
  'agent:set-permission-mode': {
    args: [ClaudePermissionMode]
    result: { ok: boolean; mode: ClaudePermissionMode }
  }

  // ── pty (create/kill are request/response; write/resize are WS frames) ─
  'pty:create': { args: [PtyCreateOpts]; result: PtyCreateResult }
  'pty:kill': { args: [string]; result: boolean }

  // ── tunnel / expo ─────────────────────────────────────────────────────
  'tunnel:isInstalled': { args: []; result: boolean }
  'tunnel:getInstallCommand': { args: []; result: TunnelInstallInfo }
  'tunnel:start': { args: [{ port: number; kind?: 'web' | 'expo' }]; result: TunnelStartResult }
  'tunnel:stop': { args: [string]; result: boolean }
  'tunnel:list': { args: []; result: TunnelSnapshot[] }
  'expo:isProject': { args: [string]; result: boolean }
  'expo:isDevClient': { args: [string]; result: boolean }
  'expo:start': { args: [string]; result: ExpoStartResult }
  'expo:stop': { args: [string]; result: boolean }
  'expo:list': { args: []; result: ExpoSnapshot[] }

  // ── updater ───────────────────────────────────────────────────────────
  'updater:checkForUpdates': { args: []; result: UpdaterCheckResult }
}

export type RpcChannel = keyof RpcChannelMap

export type RpcArgs<C extends RpcChannel> = RpcChannelMap[C]['args']

export type RpcResult<C extends RpcChannel> = RpcChannelMap[C]['result']

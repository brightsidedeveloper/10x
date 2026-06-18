/**
 * Shared domain types for the 10x desktop ⇄ mobile contract.
 *
 * These mirror the data shapes the Electron main process exposes through
 * `window.mux` (see apps/desktop/electron/preload/index.ts). They are imported by
 * the desktop preload, the remote bridge, and the mobile client so all three stay
 * in lockstep.
 */

export type WorkspaceEntry = { id: string; path: string; label: string }

export type ClaudePermissionMode = 'auto' | 'acceptEdits' | 'plan' | 'default'

export type TerminalShellPreference =
  | 'default'
  | 'git-bash'
  | 'powershell'
  | 'pwsh'
  | 'cmd'
  | 'zsh'
  | 'bash'
  | 'fish'

export type UiColorMode = 'light' | 'dark' | 'system'

export type PersistedAgentTab = { id: string; label: string; agentPath?: string }

export type AgentTabsByWorkspace = Record<
  string,
  { tabs: PersistedAgentTab[]; activeTabId: string | null }
>

export type PtyKind = 'claude' | 'shell'

export type PtyCreateOpts = {
  sessionId: string
  cwd: string
  cols: number
  rows: number
  kind?: PtyKind
  label?: string
  notificationWorkspace?: string
  notificationAgent?: string
  claudeSessionId?: string
}

export type PtyCreateResult = { ok: true } | { ok: false; error: string }

export type GitClassifyResult =
  | { isRepo: false }
  | { isRepo: true; toplevel: string; commonDir: string }

export type GitRemoteOriginStatus = { isRepo: false } | { isRepo: true; hasOrigin: boolean }

export type GitWorkingTreeSummary = {
  branchLabel: string
  detached: boolean
  upstreamShort: string | null
  ahead: number
  behind: number
  upstreamGone: boolean
  hasOrigin: boolean
  isMuxWorktree: boolean
  isOriginDefaultBranch: boolean
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  conflictCount: number
}

export type GitWorkingTreeSummaryResult =
  | { isRepo: false }
  | { isRepo: true; summary: GitWorkingTreeSummary }

export type CreateWorktreeResult =
  | { ok: true; worktreePath: string; branch: string }
  | { ok: false; error: string }

export type RecoverableWorktree = { path: string; label: string }

export type RemoveMuxWorktreeResult = { ok: true } | { ok: false; error: string }

export type GitOpenOriginResult = { ok: true } | { ok: false; error: string }

export type GitSimpleResult = { ok: true } | { ok: false; error: string }

export type GitStatusEntry = {
  path: string
  index: string
  worktree: string
  oldPath?: string
}

export type GitStatusFilesResult =
  | { ok: true; entries: GitStatusEntry[] }
  | { ok: false; error: string }

export type GitDiffMode = 'unstaged' | 'staged' | 'all'

export type GitDiffResult = { ok: true; text: string } | { ok: false; error: string }

export type GitCloneResult = { ok: true; path: string } | { ok: false; error: string }

export type GitLogCommitRow = {
  hash: string
  parents: string[]
  subject: string
  authorName: string
  dateIso: string
  refs: string
}

export type GitLogGraphResult =
  | { ok: true; commits: GitLogCommitRow[] }
  | { ok: false; error: string }

export type GitCommitFileEntry = {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  oldPath?: string
  additions: number
  deletions: number
}

export type GitCommitInspectResult =
  | {
      ok: true
      hash: string
      shortHash: string
      subject: string
      authorName: string
      dateIso: string
      files: GitCommitFileEntry[]
    }
  | { ok: false; error: string }

export type GithubDeviceStart =
  | {
      ok: true
      userCode: string
      verificationUri: string
      verificationUriComplete: string
      deviceCode: string
      interval: number
      expiresIn: number
    }
  | { ok: false; error: string }

export type GithubPoll =
  | { status: 'authorized'; login: string }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'error'; error: string }

export type GithubStatus = { connected: false } | { connected: true; login: string }

export type GithubCreateRepo =
  | { ok: true; clone_url: string; ssh_url: string; html_url: string }
  | { ok: false; error: string }

export type GithubCreateRepoAndLink =
  | { ok: true; html_url: string; clone_url: string; ssh_url: string }
  | { ok: false; error: string }

export type GithubCreateRepoWorkspace =
  | { ok: true; path: string; html_url: string }
  | { ok: false; error: string }

export type GithubCreatePrContext =
  | { applicable: false }
  | {
      applicable: true
      hasOpenPr: boolean
      hasMergedPr: boolean
      compareUrl: string
      openPrNumber: number | null
      canMerge: boolean
    }

export type GithubCreatePrDraft =
  | { ok: false }
  | {
      ok: true
      title: string
      body: string
      baseBranch: string
      headBranch: string
      compareUrl: string
    }

export type GithubCreatePr =
  | { ok: true; html_url: string; number: number }
  | { ok: false; error: string }

export type ShellResult = { ok: true } | { ok: false; error: string }

export type TerminalShellPreferenceResult = {
  ok: boolean
  preference: TerminalShellPreference
}

export type TerminalShellOption = {
  id: TerminalShellPreference
  label: string
  description: string
  available: boolean
  resolvedPath: string | null
}

export type TerminalShellOptionsResult = {
  preference: TerminalShellPreference
  resolvedPath: string | null
  resolvedLabel: string | null
  options: TerminalShellOption[]
}

export type TunnelKind = 'web' | 'expo' | 'control'

export type TunnelState = 'starting' | 'ready' | 'error' | 'closed'

export type TunnelSnapshot = {
  id: string
  port: number
  kind: TunnelKind
  state: TunnelState
  url: string | null
  error: string | null
}

export type TunnelStartResult =
  | { ok: true; tunnel: TunnelSnapshot }
  | { ok: false; error: string }

export type TunnelInstallInfo = { command: string; label: string; isWindows: boolean }

export type ExpoState = 'installing' | 'starting' | 'ready' | 'error' | 'closed'

export type ExpoSnapshot = {
  id: string
  cwd: string
  label: string
  state: ExpoState
  url: string | null
  error: string | null
}

export type ExpoStartResult =
  | { ok: true; session: ExpoSnapshot }
  | { ok: false; error: string }

export type ClaudeInstallCommand = {
  command: string
  kind: 'posix' | 'windows-powershell' | 'windows-cmd'
  shellLabel: string
  isWindows: boolean
}

export type AgentNotificationPrefs = { pushEnabled: boolean; soundEnabled: boolean }

export type AgentState = 'running' | 'idle' | 'needs-input'

export type AgentStateChangePayload = {
  sessionId: string
  state: AgentState
  needsAttention?: boolean
  active?: boolean
  hasReceivedInput?: boolean
  hasCompletedTurn?: boolean
}

export type UpdaterCheckResult =
  | { ok: true; isPackaged: false; currentVersion: string }
  | {
      ok: true
      isPackaged: true
      currentVersion: string
      updateAvailable: boolean
      latestVersion?: string
    }
  | { ok: false; currentVersion: string; error: string }

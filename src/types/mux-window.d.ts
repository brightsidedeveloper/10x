import type { ClaudePermissionMode } from '@/lib/claude-permission-mode'
import type { ClaudeCodeInstallInfo } from '@/lib/claude-code-install'
import type { ColorMode } from '@/lib/persisted-theme'
import type {
  TerminalShellOptionsSnapshot,
  TerminalShellPreference,
} from '@/lib/terminal-shell-preference'

declare global {
  type TunnelSnapshot = {
    id: string
    port: number
    kind: 'web' | 'expo'
    state: 'starting' | 'ready' | 'error' | 'closed'
    url: string | null
    error: string | null
  }

  type ExpoSnapshot = {
    id: string
    cwd: string
    label: string
    state: 'installing' | 'starting' | 'ready' | 'error' | 'closed'
    url: string | null
    error: string | null
  }

  interface Window {
    mux: {
      app: {
        getHomeDir: () => Promise<string>
        onWillQuit: (handler: () => void) => () => void
      }
      theme: {
        syncNativeChrome: (
          colorMode: ColorMode,
        ) => Promise<{ ok: boolean; colorMode: ColorMode }>
      }
      store: {
        getWorkspaces: () => Promise<{ id: string; path: string; label: string }[]>
        setWorkspaces: (workspaces: { id: string; path: string; label: string }[]) => Promise<boolean>
        getAgentTabs: () => Promise<
          Record<string, { tabs: { id: string; label: string; agentPath?: string }[]; activeTabId: string | null }>
        >
        setAgentTabs: (
          byWorkspace: Record<
            string,
            { tabs: { id: string; label: string; agentPath?: string }[]; activeTabId: string | null }
          >,
        ) => Promise<boolean>
      }
      dialog: {
        pickWorkspace: () => Promise<string | null>
      }
      shell: {
        openExternal: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>
        openPathInOsFinder: (fullPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
        openInCursor: (folderPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
        getTerminalPreference: () => Promise<TerminalShellPreference>
        setTerminalPreference: (
          preference: TerminalShellPreference,
        ) => Promise<{ ok: boolean; preference: TerminalShellPreference }>
        listTerminalShellOptions: () => Promise<TerminalShellOptionsSnapshot>
      }
      git: {
        openOriginInBrowser: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        openCommitOnGithub: (args: {
          cwd: string
          hash: string
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        classify: (cwd: string) => Promise<{ isRepo: false } | { isRepo: true; toplevel: string; commonDir: string }>
        clone: (args: {
          url: string
          parentDir: string
          folderName?: string
        }) => Promise<{ ok: true; path: string } | { ok: false; error: string }>
        remoteOriginStatus: (cwd: string) => Promise<{ isRepo: false } | { isRepo: true; hasOrigin: boolean }>
        createWorktree: (args: {
          repoCwd: string
          worktreeName: string
        }) => Promise<{ ok: true; worktreePath: string; branch: string } | { ok: false; error: string }>
        listRecoverableMuxWorktrees: (repoCwd: string) => Promise<{ path: string; label: string }[]>
        removeMuxWorktree: (worktreePath: string) => Promise<{ ok: true } | { ok: false; error: string }>
        cleanupMergedMuxWorktree: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        init: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        addAll: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        statusFiles: (cwd: string) => Promise<
          | { ok: true; entries: { path: string; index: string; worktree: string; oldPath?: string }[] }
          | { ok: false; error: string }
        >
        addPaths: (args: {
          cwd: string
          paths: string[]
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        resetPathsHead: (args: {
          cwd: string
          paths: string[]
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        unstageAll: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        discardWorktreePath: (args: {
          cwd: string
          path: string
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        commit: (args: { cwd: string; message: string }) => Promise<{ ok: true } | { ok: false; error: string }>
        push: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        pull: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        fetch: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        workingTreeSummary: (cwd: string) => Promise<
          | { isRepo: false }
          | {
              isRepo: true
              summary: {
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
            }
        >
        addRemote: (args: { cwd: string; remoteName: string; url: string }) => Promise<{ ok: true } | { ok: false; error: string }>
        diff: (args: {
          cwd: string
          mode: 'unstaged' | 'staged' | 'all'
        }) => Promise<{ ok: true; text: string } | { ok: false; error: string }>
        logGraph: (cwd: string) => Promise<
          | {
              ok: true
              commits: {
                hash: string
                parents: string[]
                subject: string
                authorName: string
                dateIso: string
                refs: string
              }[]
            }
          | { ok: false; error: string }
        >
        commitInspect: (args: { cwd: string; hash: string }) => Promise<
          | {
              ok: true
              hash: string
              shortHash: string
              subject: string
              authorName: string
              dateIso: string
              files: {
                path: string
                status: 'added' | 'modified' | 'deleted' | 'renamed'
                oldPath?: string
                additions: number
                deletions: number
              }[]
            }
          | { ok: false; error: string }
        >
        commitDiff: (args: {
          cwd: string
          hash: string
        }) => Promise<{ ok: true; text: string } | { ok: false; error: string }>
      }
      github: {
        deviceStart: () => Promise<
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
        >
        devicePoll: (
          deviceCode: string,
        ) => Promise<
          { status: 'authorized'; login: string } | { status: 'pending' } | { status: 'slow_down' } | { status: 'error'; error: string }
        >
        getStatus: () => Promise<{ connected: false } | { connected: true; login: string }>
        disconnect: () => Promise<{ ok: true }>
        createRepo: (args: {
          name: string
          description?: string
          private?: boolean
        }) => Promise<{ ok: true; clone_url: string; ssh_url: string; html_url: string } | { ok: false; error: string }>
        createRepoAndLink: (args: {
          cwd: string
          name: string
          description?: string
          private?: boolean
        }) => Promise<{ ok: true; html_url: string; clone_url: string; ssh_url: string } | { ok: false; error: string }>
        createRepoWorkspace: (args: {
          parentDir: string
          name: string
          description?: string
          private?: boolean
        }) => Promise<{ ok: true; path: string; html_url: string } | { ok: false; error: string }>
        openNewRepoPage: () => Promise<{ ok: true }>
        openOAuthAppSettings: () => Promise<{ ok: true }>
        openDeviceHelp: () => Promise<{ ok: true }>
        getCreatePrContext: (
          cwd: string,
        ) => Promise<
          | { applicable: false }
          | {
              applicable: true
              hasOpenPr: boolean
              hasMergedPr: boolean
              compareUrl: string
              openPrNumber: number | null
              canMerge: boolean
            }
        >
        getCreatePrDraft: (
          cwd: string,
        ) => Promise<
          | { ok: false }
          | {
              ok: true
              title: string
              body: string
              baseBranch: string
              headBranch: string
              compareUrl: string
            }
        >
        createPr: (args: {
          cwd: string
          title: string
          body: string
        }) => Promise<{ ok: true; html_url: string; number: number } | { ok: false; error: string }>
        mergePr: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
      }
      claudeCode: {
        /** Resolves after probing PATH (and common install locations) from the main process. */
        isCliInstalled: () => Promise<boolean>
        /** Official installer command for the user’s configured terminal shell. */
        getInstallCommand: () => Promise<ClaudeCodeInstallInfo>
      }
      agent: {
        onStateChange: (
          handler: (
            payload: {
              sessionId: string
              state: string
              needsAttention?: boolean
              active?: boolean
              hasReceivedInput?: boolean
              hasCompletedTurn?: boolean
            },
          ) => void,
        ) => () => void
        /** Tell the main process the user focused this agent tab (keeps dock badge in sync with tab attention). */
        dismissAttention: (sessionId: string) => void
        /** Active agent tab in the visible workspace (`workspaceId:tabId`); suppresses dock badge counts for that session (not OS notifications). */
        setFocusedSession: (sessionId: string | null) => void
        /** macOS: user clicked a system notification — navigate to that agent session. */
        onNavigateToSession: (handler: (payload: { sessionId: string }) => void) => () => void
        /** Keep notification / metadata in sync when the tab or workspace label changes (no PTY restart). */
        updateSessionLabels: (
          sessionId: string,
          meta: { label: string; notificationWorkspace: string; notificationAgent: string },
        ) => void
        getNotificationPrefs: () => Promise<{ pushEnabled: boolean; soundEnabled: boolean }>
        setNotificationPrefs: (prefs: {
          pushEnabled: boolean
          soundEnabled: boolean
        }) => Promise<
          | { ok: true; prefs: { pushEnabled: boolean; soundEnabled: boolean } }
          | { ok: false; prefs: { pushEnabled: boolean; soundEnabled: boolean } }
        >
        /** Autonomy level new Claude sessions launch with (`--permission-mode`). */
        getPermissionMode: () => Promise<ClaudePermissionMode>
        setPermissionMode: (
          mode: ClaudePermissionMode,
        ) => Promise<{ ok: boolean; mode: ClaudePermissionMode }>
      }
      pty: {
        create: (opts: {
          sessionId: string
          cwd: string
          cols: number
          rows: number
          kind?: 'claude' | 'shell'
          label?: string
          notificationWorkspace?: string
          notificationAgent?: string
          claudeSessionId?: string
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        write: (sessionId: string, data: string) => void
        resize: (sessionId: string, cols: number, rows: number) => void
        kill: (sessionId: string) => Promise<boolean>
        onData: (handler: (payload: { sessionId: string; data: string }) => void) => () => void
        onExit: (handler: (payload: { sessionId: string; exitCode: number; signal?: number }) => void) => () => void
      }
      tunnel: {
        /** Whether `cloudflared` is resolvable from the main process. */
        isInstalled: () => Promise<boolean>
        getInstallCommand: () => Promise<{ command: string; label: string; isWindows: boolean }>
        /** Start a quick tunnel to `http://localhost:<port>`; the public URL arrives via `onStatus`. */
        start: (args: {
          port: number
          kind?: 'web' | 'expo'
        }) => Promise<{ ok: true; tunnel: TunnelSnapshot } | { ok: false; error: string }>
        stop: (tunnelId: string) => Promise<boolean>
        list: () => Promise<TunnelSnapshot[]>
        onStatus: (handler: (payload: TunnelSnapshot) => void) => () => void
      }
      ios: {
        /** Open the generated .xcworkspace in Xcode (for first-time signing / a one-time device build). */
        openProject: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
      }
      expo: {
        /** Whether `cwd` looks like an Expo project (expo dep or app config). */
        isProject: (cwd: string) => Promise<boolean>
        /** Whether `cwd` has `expo-dev-client` (so `expo start` serves a dev build, not Expo Go). */
        isDevClient: (cwd: string) => Promise<boolean>
        /** Start `npx expo start --tunnel`; the `exp://` URL arrives via `onStatus`. */
        start: (
          cwd: string,
        ) => Promise<{ ok: true; session: ExpoSnapshot } | { ok: false; error: string }>
        stop: (id: string) => Promise<boolean>
        list: () => Promise<ExpoSnapshot[]>
        onStatus: (handler: (payload: ExpoSnapshot) => void) => () => void
      }
      updater: {
        getAppVersion: () => Promise<string>
        checkForUpdates: () => Promise<
          | { ok: true; isPackaged: false; currentVersion: string }
          | {
              ok: true
              isPackaged: true
              currentVersion: string
              updateAvailable: boolean
              latestVersion?: string
            }
          | { ok: false; currentVersion: string; error: string }
        >
        downloadUpdate: () => Promise<{ ok: true } | { ok: false; error: string }>
        quitAndInstall: () => Promise<{ ok: true } | { ok: false; error: string }>
        onDownloadProgress: (
          handler: (payload: { percent: number; transferred: number; total: number }) => void,
        ) => () => void
        onUpdateDownloaded: (handler: () => void) => () => void
        onError: (handler: (payload: { message: string }) => void) => () => void
      }
    }
  }
}

export {}

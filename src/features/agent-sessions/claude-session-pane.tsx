import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CLAUDE_CODE_INSTALL_URL } from '@/lib/claude-code-install'
import {
  clearUserEndedAgentSession,
  markUserEndedAgentSession,
  readUserEndedAgentSession,
} from '@/lib/agent-session-user-ended'
import { isAppQuitting } from '@/lib/app-quitting'
import { classifyAgentWorktreeClose } from '@/features/git/classify-agent-worktree-close'
import { useWorkspaceById } from '@/features/workspaces/hooks/use-workspace-by-id'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useAgentTabCloseIntentStore } from '@/stores/agent-tab-close-intent-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { refreshFocusedCheckoutGit } from '@/stores/git-focused-checkout-store'

import '@xterm/xterm/css/xterm.css'

import { useAgentTabId } from './tab-id-context'
import { useWorkspaceSessionScope } from './workspace-id-context'

function sessionKey(workspaceId: string, tabId: string) {
  return `${workspaceId}:${tabId}`
}

function shouldIgnoreExitMessage(exitCode: number, signal?: number, tearingDown = false): boolean {
  if (tearingDown) return true
  if (exitCode === 0 && signal === 1) return true
  return false
}

function AgentSessionExitedState({ onResume, onCloseTab }: { onResume: () => void; onCloseTab: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Session ended</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Resume Claude in this tab, or close the tab if you are done.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={onResume}>
          Resume
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCloseTab}>
          Close tab
        </Button>
      </div>
    </div>
  )
}

/** PTY + xterm live here only so `sessionId` never appears in the parent render path (React Compiler–safe). */
function ClaudeAgentTerminalHost({
  workspaceId,
  tabId,
  cwd,
  label,
  notificationWorkspace,
  notificationAgent,
  onSessionExit,
}: {
  workspaceId: string
  tabId: string
  cwd: string
  label: string
  notificationWorkspace: string
  notificationAgent: string
  onSessionExit: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tearingDownRef = useRef(false)
  const sessionLiveRef = useRef(false)
  const [bootError, setBootError] = useState<string | null>(null)

  const sessionId = useMemo(() => sessionKey(workspaceId, tabId), [workspaceId, tabId])

  const labelsRef = useRef({ label, notificationWorkspace, notificationAgent })
  labelsRef.current = { label, notificationWorkspace, notificationAgent }

  useEffect(() => {
    window.mux.agent.updateSessionLabels(sessionId, {
      label,
      notificationWorkspace,
      notificationAgent,
    })
  }, [sessionId, label, notificationWorkspace, notificationAgent])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    tearingDownRef.current = false
    sessionLiveRef.current = false
    setBootError(null)

    let cancelled = false

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#141414',
        foreground: '#e4e4e7',
        cursor: '#fafafa',
        cursorAccent: '#141414',
        selectionBackground: '#3f3f46',
      },
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()

    const ro = new ResizeObserver(() => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      if (width < 2 || height < 2) return
      fit.fit()
      window.mux.pty.resize(sessionId, Math.max(term.cols, 2), Math.max(term.rows, 1))
    })
    ro.observe(container)

    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined

    void (async () => {
      const cols = Math.max(term.cols, 2)
      const rows = Math.max(term.rows, 1)

      const created = await window.mux.pty.create({
        sessionId,
        cwd,
        cols,
        rows,
        kind: 'claude',
        label,
        notificationWorkspace,
        notificationAgent,
        claudeSessionId: tabId,
      })

      if (cancelled || tearingDownRef.current) {
        if (created.ok) void window.mux.pty.kill(sessionId)
        return
      }

      if (!created.ok) {
        setBootError(created.error)
        term.writeln(`\r\n\x1b[31mCould not start Claude Code: ${created.error}\x1b[0m`)
        term.writeln(`\r\nInstall the CLI (${CLAUDE_CODE_INSTALL_URL}) and ensure \`claude\` is on your PATH.`)
        return
      }

      sessionLiveRef.current = true

      const latest = labelsRef.current
      window.mux.agent.updateSessionLabels(sessionId, {
        label: latest.label,
        notificationWorkspace: latest.notificationWorkspace,
        notificationAgent: latest.notificationAgent,
      })

      unsubData = window.mux.pty.onData((payload) => {
        if (payload.sessionId !== sessionId) return
        term.write(payload.data)
      })

      unsubExit = window.mux.pty.onExit((payload) => {
        if (payload.sessionId !== sessionId) return
        if (shouldIgnoreExitMessage(payload.exitCode, payload.signal, tearingDownRef.current)) return
        if (!sessionLiveRef.current || isAppQuitting()) return
        sessionLiveRef.current = false
        onSessionExit()
      })

      term.onData((data) => {
        window.mux.pty.write(sessionId, data)
      })

      fit.fit()
      window.mux.pty.resize(sessionId, Math.max(term.cols, 2), Math.max(term.rows, 1))
    })()

    return () => {
      tearingDownRef.current = true
      sessionLiveRef.current = false
      cancelled = true
      ro.disconnect()
      unsubData?.()
      unsubExit?.()
      void window.mux.pty.kill(sessionId)
      term.dispose()
      container.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `label` / notification fields are pushed
    // via `updateSessionLabels`; including them here would kill the PTY on every rename.
  }, [workspaceId, tabId, cwd, onSessionExit])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={containerRef} className="mux-terminal-host relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden px-1" />
      {bootError ? <p className="shrink-0 border-t border-border px-2 py-1 text-[11px] text-destructive">{bootError}</p> : null}
    </div>
  )
}

function ClaudeAgentTerminal({
  workspaceId,
  tabId,
  cwd,
  label,
  notificationWorkspace,
  notificationAgent,
}: {
  workspaceId: string
  tabId: string
  cwd: string
  label: string
  notificationWorkspace: string
  notificationAgent: string
}) {
  const [terminalEpoch, setTerminalEpoch] = useState(0)
  const [exited, setExited] = useState(() => readUserEndedAgentSession(workspaceId, tabId))

  const tab = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.tabs.find((t) => t.id === tabId) ?? null)
  const setActiveTab = useAgentTabsStore((s) => s.setActiveTab)
  const closeTab = useAgentTabsStore((s) => s.closeTab)
  const requestCloseActiveAgentTab = useAgentTabCloseIntentStore((s) => s.requestCloseActiveAgentTab)

  const handleSessionExit = useCallback(() => {
    markUserEndedAgentSession(workspaceId, tabId)
    setExited(true)
  }, [workspaceId, tabId])

  const handleResume = useCallback(() => {
    clearUserEndedAgentSession(workspaceId, tabId)
    setExited(false)
    setTerminalEpoch((n) => n + 1)
  }, [workspaceId, tabId])

  const handleCloseTab = useCallback(async () => {
    if (!tab) return
    clearUserEndedAgentSession(workspaceId, tabId)
    const kind = await classifyAgentWorktreeClose(tab)
    if (kind === 'plain') {
      closeTab(workspaceId, tabId)
      return
    }
    if (kind === 'stale') {
      void runWithStatusActivity({ domain: 'git', label: 'Removing worktree', detail: tab.agentPath! }, async () => {
        const r = await window.mux.git.removeMuxWorktree(tab.agentPath!)
        if (r.ok) {
          closeTab(workspaceId, tabId)
          void refreshFocusedCheckoutGit()
        }
        return r
      })
      return
    }
    setActiveTab(workspaceId, tabId)
    requestCloseActiveAgentTab(workspaceId, tabId)
  }, [tab, closeTab, workspaceId, tabId, setActiveTab, requestCloseActiveAgentTab])

  if (exited) {
    return <AgentSessionExitedState onResume={handleResume} onCloseTab={() => void handleCloseTab()} />
  }

  return (
    <ClaudeAgentTerminalHost
      key={terminalEpoch}
      workspaceId={workspaceId}
      tabId={tabId}
      cwd={cwd}
      label={label}
      notificationWorkspace={notificationWorkspace}
      notificationAgent={notificationAgent}
      onSessionExit={handleSessionExit}
    />
  )
}

export function ClaudeSessionPane() {
  const tabId = useAgentTabId()
  const workspaceId = useWorkspaceSessionScope()
  const workspace = useWorkspaceById(workspaceId)
  const tab = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.tabs.find((t) => t.id === tabId) ?? null)
  const notificationAgent = tab?.label ?? 'Agent'
  const notificationWorkspace = workspace?.label ?? 'Workspace'

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {tab?.label ?? 'Agent'}
        {workspace ? (
          <span className="ml-2 font-mono text-[11px] text-foreground/80">— {workspace.label}</span>
        ) : (
          <span className="ml-2 text-amber-200/80">— add a workspace to run Claude</span>
        )}
      </div>
      {!workspace?.path ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Select or add a workspace folder — Claude Code runs with that directory as{' '}
          <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">cwd</code>.
        </div>
      ) : (
        <ClaudeAgentTerminal
          workspaceId={workspaceId}
          tabId={tabId}
          cwd={tab?.agentPath ?? workspace.path}
          label={`${notificationAgent} · ${workspace.label}`}
          notificationWorkspace={notificationWorkspace}
          notificationAgent={notificationAgent}
        />
      )}
    </div>
  )
}

import { appWideShellSessionId } from '@/features/terminal-panel/workspace-shell-terminal'
import { scheduleFocusMuxXtermForTyping } from '@/lib/focus-mux-xterm'
import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { useTerminalScopeStore } from '@/stores/terminal-scope-store'

/** Switches to Global terminal, adds a shared shell, and runs the official installer. */
export async function runClaudeCodeInstallInGlobalTerminal(workspaceId?: string | null): Promise<void> {
  if (workspaceId) {
    useTerminalScopeStore.getState().setScope(workspaceId, 'global')
  }
  const { command } = await window.mux.claudeCode.getInstallCommand()
  const shellId = useAppWideTerminalsStore.getState().addShell('Claude install')
  const sessionId = appWideShellSessionId(shellId)
  useAppWideTerminalsStore.getState().queueBootstrapForSession(sessionId, `${command}\n`)
  scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
}

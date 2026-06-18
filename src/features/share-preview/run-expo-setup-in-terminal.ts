import { appWideShellSessionId } from '@/features/terminal-panel/workspace-shell-terminal'
import { scheduleFocusMuxXtermForTyping } from '@/lib/focus-mux-xterm'
import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { useTerminalScopeStore } from '@/stores/terminal-scope-store'

/** Single-quote a path for POSIX shells (dev builds only run on macOS). */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * First-time dev-build setup: installs `expo-dev-client` and runs `expo prebuild` in a real,
 * visible terminal so the native iOS project (`ios/<app>.xcworkspace`) is generated. After it
 * finishes, "Open in Xcode" has a workspace to open for the one-time signing + device build.
 */
export function runExpoDevBuildSetupInTerminal(cwd: string, workspaceId?: string | null): void {
  if (workspaceId) {
    useTerminalScopeStore.getState().setScope(workspaceId, 'global')
  }
  const command = [
    `cd ${shellQuote(cwd)}`,
    'npx expo install expo-dev-client',
    'npx expo prebuild -p ios',
  ].join(' && ')

  const shellId = useAppWideTerminalsStore.getState().addShell('Expo dev build setup')
  const sessionId = appWideShellSessionId(shellId)
  useAppWideTerminalsStore.getState().queueBootstrapForSession(sessionId, `${command}\n`)
  scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
}

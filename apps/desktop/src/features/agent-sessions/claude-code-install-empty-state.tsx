import { useEffect, useState } from 'react'

import { runClaudeCodeInstallInGlobalTerminal } from '@/features/terminal-panel/run-claude-install-in-global-terminal'
import { Button } from '@/components/ui/button'
import type { ClaudeCodeInstallInfo } from '@/lib/claude-code-install'
import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'

type ClaudeCodeInstallEmptyStateProps = {
  workspaceId?: string | null
}

export function ClaudeCodeInstallEmptyState({ workspaceId }: ClaudeCodeInstallEmptyStateProps) {
  const [installInfo, setInstallInfo] = useState<ClaudeCodeInstallInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.mux.claudeCode.getInstallCommand().then((info) => {
      if (!cancelled) setInstallInfo(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex max-w-md flex-col items-center gap-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Install Claude Code</p>
        <p className="text-sm text-muted-foreground">
          Agent tabs need the <span className="font-medium text-foreground">claude</span> CLI. We’ll
          open a <span className="font-medium text-foreground">global</span> terminal and run the
          official native installer
          {installInfo?.isWindows ? (
            <>
              {' '}
              via <span className="font-medium text-foreground">PowerShell</span>
            </>
          ) : null}
          . When it finishes, use <span className="font-medium">Check again</span>.
        </p>
        {installInfo?.isWindows ? (
          <p className="text-left text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Git for Windows</span> is optional but
            recommended so Claude Code can use the Bash tool. Without it, Claude Code uses PowerShell
            for shell tools instead.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void runClaudeCodeInstallInGlobalTerminal(workspaceId)
          }}
        >
          Install Claude Code
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void useClaudeCodeCliStore.getState().refresh()}
        >
          Check again
        </Button>
      </div>
    </div>
  )
}

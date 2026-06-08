import { FolderPlus } from 'lucide-react'

import { workspaceLabelFromPath } from '@/features/workspaces/lib/label-from-path'
import { usePersistWorkspacesMutation } from '@/features/workspaces/hooks/use-workspaces'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { Button } from '@/components/ui/button'
import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

import { AgentSessionsPanel } from './agent-sessions-panel'
import { ClaudeCodeInstallEmptyState } from './claude-code-install-empty-state'
import { WorkspaceIdProvider } from './workspace-id-context'

function NoWorkspaceAgentDeskEmpty() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()
  const claudeInstalled = useClaudeCodeCliStore((s) => s.installed)

  async function addWorkspace() {
    const dir = await window.mux.dialog.pickWorkspace()
    if (!dir) return
    const next = [
      ...workspaces,
      {
        id: crypto.randomUUID(),
        path: dir,
        label: workspaceLabelFromPath(dir),
      },
    ]
    await persist.mutateAsync(next)
    setActiveWorkspaceId(next[next.length - 1]!.id)
  }

  return (
    <div id="mux-agent-desk" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      {claudeInstalled === null ? (
        <p className="text-sm text-muted-foreground">Checking for Claude Code…</p>
      ) : claudeInstalled === false ? (
        <ClaudeCodeInstallEmptyState />
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">No workspace yet</p>
            <p className="text-sm text-muted-foreground">
              Add a folder as a workspace to open agent tabs and run Claude Code in that directory.
            </p>
          </div>
          <Button type="button" size="sm" className="gap-2" disabled={persist.isPending} onClick={() => void addWorkspace()}>
            <FolderPlus className="size-3.5" />
            Add workspace folder
          </Button>
        </div>
      )}
    </div>
  )
}

export function WorkspaceAgentDesk() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const visibleWorkspaceId = useVisibleWorkspaceId()

  if (workspaces.length === 0) {
    return <NoWorkspaceAgentDeskEmpty />
  }

  const visibleId = visibleWorkspaceId ?? workspaces[0]!.id

  return (
    <div id="mux-agent-desk" className="relative flex min-h-0 flex-1 flex-col">
      {workspaces.map((ws) => (
        <div key={ws.id} className={cn('flex min-h-0 min-w-0 flex-1 flex-col', ws.id !== visibleId && 'hidden')}>
          <WorkspaceIdProvider workspaceId={ws.id}>
            <AgentSessionsPanel />
          </WorkspaceIdProvider>
        </div>
      ))}
    </div>
  )
}

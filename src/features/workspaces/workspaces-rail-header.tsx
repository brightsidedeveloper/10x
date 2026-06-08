import { useState } from 'react'

import { Plus, FolderOpen, GitBranch } from 'lucide-react'

import { CloneRepositoryDialog } from '@/features/workspaces/clone-repository-dialog'
import { useAppendWorkspace } from '@/features/workspaces/hooks/use-append-workspace'
import { usePersistWorkspacesMutation } from '@/features/workspaces/hooks/use-workspaces'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function WorkspacesRailHeader() {
  const persist = usePersistWorkspacesMutation()
  const appendWorkspace = useAppendWorkspace()
  const [cloneOpen, setCloneOpen] = useState(false)

  async function selectExistingFolder() {
    const dir = await window.mux.dialog.pickWorkspace()
    if (!dir) return
    await appendWorkspace(dir)
  }

  return (
    <>
      <CloneRepositoryDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onCloned={appendWorkspace}
      />
      <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-2">
        <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Workspaces
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Add workspace"
              disabled={persist.isPending}
            >
              <Plus className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onSelect={() => void selectExistingFolder()}>
              <FolderOpen className="size-3.5" />
              Choose folder…
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => setCloneOpen(true)}>
              <GitBranch className="size-3.5" />
              Clone repository…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

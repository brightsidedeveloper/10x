import { useState } from 'react'

import { Plus, FolderOpen, GitBranch, Github } from 'lucide-react'

import { CloneRepositoryDialog } from '@/features/workspaces/clone-repository-dialog'
import { CreateGithubRepositoryDialog } from '@/features/workspaces/create-github-repository-dialog'
import { useAppendWorkspace } from '@/features/workspaces/hooks/use-append-workspace'
import { useGithubDeviceAuth } from '@/features/github/use-github-device-auth'
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
  const auth = useGithubDeviceAuth()
  const [cloneOpen, setCloneOpen] = useState(false)
  const [createGithubOpen, setCreateGithubOpen] = useState(false)

  const showGithubCreate = !auth.loadingStatus && auth.githubLogin != null

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
      {auth.githubLogin ? (
        <CreateGithubRepositoryDialog
          open={createGithubOpen}
          onOpenChange={setCreateGithubOpen}
          githubLogin={auth.githubLogin}
          onCreated={appendWorkspace}
        />
      ) : null}
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
            {showGithubCreate ? (
              <DropdownMenuItem className="gap-2" onSelect={() => setCreateGithubOpen(true)}>
                <Github className="size-3.5" />
                Create repository…
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

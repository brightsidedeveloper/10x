import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { readCloneParentDir, writeCloneParentDir } from '@/lib/persisted-clone-parent-dir'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { FolderOpen } from 'lucide-react'

export type CreateGithubRepositoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  githubLogin: string
  onCreated: (repoPath: string) => void | Promise<void>
}

export function CreateGithubRepositoryDialog({
  open,
  onOpenChange,
  githubLogin,
  onCreated,
}: CreateGithubRepositoryDialogProps) {
  const [repoName, setRepoName] = useState('')
  const [repoDesc, setRepoDesc] = useState('')
  const [repoPrivate, setRepoPrivate] = useState(false)
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRepoName('')
    setRepoDesc('')
    setRepoPrivate(false)
    setParentDir(readCloneParentDir())
    setBusy(false)
    setError(null)
    void window.mux.app.getHomeDir().then((home) => {
      setParentDir((prev) => prev ?? home)
    })
  }, [open])

  const projectPath =
    parentDir && repoName.trim()
      ? `${parentDir.replace(/[/\\]+$/, '')}/${repoName.trim().replace(/\s+/g, '-')}`
      : null

  async function pickParentDir() {
    const dir = await window.mux.dialog.pickWorkspace()
    if (!dir) return
    writeCloneParentDir(dir)
    setParentDir(dir)
    setError(null)
  }

  async function submit() {
    const trimmedName = repoName.trim()
    if (!trimmedName) {
      setError('Enter a repository name.')
      return
    }
    if (!parentDir?.trim()) {
      setError('Choose where to create the project folder.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await runWithStatusActivity(
        { domain: 'github', label: 'Creating repository', detail: trimmedName },
        () =>
          window.mux.github.createRepoWorkspace({
            parentDir: parentDir.trim(),
            name: trimmedName,
            description: repoDesc.trim() || undefined,
            private: repoPrivate,
          }),
      )
      setBusy(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      writeCloneParentDir(parentDir.trim())
      onOpenChange(false)
      await onCreated(result.path)
    } catch {
      setBusy(false)
      setError('Something went wrong while creating the repository.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogTitle>Create GitHub repository</DialogTitle>
        <DialogDescription>
          Create a new repo on{' '}
          <span className="font-medium text-foreground">@{githubLogin}</span>, initialize Git locally, push an initial
          commit, and open it as a workspace.
        </DialogDescription>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="mux-create-repo-name" className="text-xs font-medium text-foreground">
              Repository name
            </label>
            <input
              id="mux-create-repo-name"
              autoFocus
              value={repoName}
              disabled={busy}
              placeholder="my-app"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
              onChange={(e) => setRepoName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="mux-create-repo-desc" className="text-xs font-medium text-foreground">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="mux-create-repo-desc"
              value={repoDesc}
              disabled={busy}
              placeholder="A short summary"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
              onChange={(e) => setRepoDesc(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={repoPrivate}
              disabled={busy}
              onChange={(e) => setRepoPrivate(e.target.checked)}
            />
            Private repository
          </label>

          <div className="grid gap-2">
            <span className="text-xs font-medium text-foreground">Project location</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={busy}
                onClick={() => void pickParentDir()}
              >
                <FolderOpen className="size-3.5" />
                Choose folder…
              </Button>
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={parentDir ?? undefined}>
                {parentDir ?? 'Not selected'}
              </span>
            </div>
            {projectPath ? (
              <p className="text-xs text-muted-foreground">
                Will create{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/90">
                  {projectPath}
                </code>
              </p>
            ) : null}
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create & open'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

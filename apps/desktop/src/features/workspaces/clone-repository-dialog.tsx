import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { repoNameFromCloneUrl } from '@/features/workspaces/lib/repo-name-from-clone-url'
import { readCloneParentDir, writeCloneParentDir } from '@/lib/persisted-clone-parent-dir'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { FolderOpen } from 'lucide-react'

export type CloneRepositoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloned: (repoPath: string) => void | Promise<void>
}

export function CloneRepositoryDialog({ open, onOpenChange, onCloned }: CloneRepositoryDialogProps) {
  const [url, setUrl] = useState('')
  const [folderName, setFolderName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const folderNameEditedRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setUrl('')
    setFolderName('')
    setParentDir(readCloneParentDir())
    setBusy(false)
    setError(null)
    folderNameEditedRef.current = false
    void window.mux.app.getHomeDir().then((home) => {
      setParentDir((prev) => prev ?? home)
    })
  }, [open])

  useEffect(() => {
    if (!open || folderNameEditedRef.current) return
    const derived = repoNameFromCloneUrl(url)
    if (derived) setFolderName(derived)
  }, [open, url])

  const clonePath =
    parentDir && folderName.trim()
      ? `${parentDir.replace(/[/\\]+$/, '')}/${folderName.trim()}`
      : null

  async function pickParentDir() {
    const dir = await window.mux.dialog.pickWorkspace()
    if (!dir) return
    writeCloneParentDir(dir)
    setParentDir(dir)
    setError(null)
  }

  async function submit() {
    const trimmedUrl = url.trim()
    const trimmedFolder = folderName.trim()
    if (!trimmedUrl) {
      setError('Enter a repository URL.')
      return
    }
    if (!trimmedFolder) {
      setError('Enter a folder name.')
      return
    }
    if (!parentDir?.trim()) {
      setError('Choose where to clone the repository.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await runWithStatusActivity(
        { domain: 'git', label: 'Cloning repository', detail: trimmedFolder },
        () =>
          window.mux.git.clone({
            url: trimmedUrl,
            parentDir: parentDir.trim(),
            folderName: trimmedFolder,
          }),
      )
      setBusy(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      writeCloneParentDir(parentDir.trim())
      onOpenChange(false)
      await onCloned(result.path)
    } catch {
      setBusy(false)
      setError('Something went wrong while cloning.')
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
        <DialogTitle>Clone repository</DialogTitle>
        <DialogDescription>
          Clone a Git remote into a folder on your machine, then open it as a workspace.
        </DialogDescription>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="mux-clone-url" className="text-xs font-medium text-foreground">
              Repository URL
            </label>
            <input
              id="mux-clone-url"
              autoFocus
              value={url}
              disabled={busy}
              placeholder="https://github.com/org/repo.git"
              className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="mux-clone-folder" className="text-xs font-medium text-foreground">
              Folder name
            </label>
            <input
              id="mux-clone-folder"
              value={folderName}
              disabled={busy}
              placeholder="repo"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
              onChange={(e) => {
                folderNameEditedRef.current = true
                setFolderName(e.target.value)
              }}
            />
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-medium text-foreground">Clone location</span>
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
            {clonePath ? (
              <p className="text-xs text-muted-foreground">
                Will clone to{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/90">
                  {clonePath}
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
            {busy ? 'Cloning…' : 'Clone & open'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

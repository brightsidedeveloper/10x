import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cwd: string | null
  /** Compare URL for the "Open on GitHub instead" fallback. */
  compareUrl: string | null
  /** Called after a PR is created so the caller can refresh git state. */
  onCreated: (result: { html_url: string; number: number }) => void
}

const fieldClass = cn(
  'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm',
  'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
)

export function CreatePrDialog({ open, onOpenChange, cwd, compareUrl, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [baseHead, setBaseHead] = useState<{ base: string; head: string } | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setTitle('')
      setBody('')
      setBaseHead(null)
      setBusy(false)
      return
    }
    if (!cwd) return
    let cancelled = false
    setLoadingDraft(true)
    void window.mux.github.getCreatePrDraft(cwd).then((draft) => {
      if (cancelled) return
      setLoadingDraft(false)
      if (draft.ok) {
        setTitle((prev) => (prev ? prev : draft.title))
        setBody((prev) => (prev ? prev : draft.body))
        setBaseHead({ base: draft.baseBranch, head: draft.headBranch })
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, cwd])

  async function submit() {
    const t = title.trim()
    if (!t || !cwd || busy) return
    setBusy(true)
    const r = await window.mux.github.createPr({ cwd, title: t, body })
    setBusy(false)
    if (!r.ok) {
      window.alert(r.error)
      return
    }
    onOpenChange(false)
    onCreated({ html_url: r.html_url, number: r.number })
  }

  function openCompare() {
    if (!compareUrl) return
    onOpenChange(false)
    void window.mux.shell.openExternal(compareUrl)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogTitle>Create pull request</DialogTitle>
        <DialogDescription className="text-xs">
          {baseHead ? (
            <>
              Merge <span className="font-medium text-foreground">{baseHead.head}</span> into{' '}
              <span className="font-medium text-foreground">{baseHead.base}</span> on GitHub.
            </>
          ) : loadingDraft ? (
            'Preparing pull request…'
          ) : (
            'Open a pull request for this branch on GitHub.'
          )}
        </DialogDescription>

        <input
          className={fieldClass}
          placeholder="Pull request title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className={cn(fieldClass, 'min-h-[120px] resize-y')}
          placeholder="Describe your changes (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={openCompare}
            disabled={!compareUrl || busy}
            className="text-muted-foreground"
          >
            Open on GitHub instead
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!title.trim() || !cwd || busy}>
              {busy ? 'Creating…' : 'Create pull request'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

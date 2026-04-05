import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { normalizeGitCwdKey } from '@/features/git/normalize-git-cwd'
import { PublishGithubDialog } from '@/features/github/publish-github-dialog'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { cn } from '@/lib/utils'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import {
  refreshFocusedCheckoutGit,
  useGitFocusedCheckoutStore,
} from '@/stores/git-focused-checkout-store'
import { useSidePanelStore } from '@/stores/side-panel-store'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  GitPullRequestCreateArrow,
  Github,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  PlusSquare,
  RefreshCw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'

type StatusEntry = {
  path: string
  index: string
  worktree: string
  oldPath?: string
}

function isStagedIndex(x: string): boolean {
  return x !== ' ' && x !== '?'
}

function isDirtyWorktree(y: string): boolean {
  return y !== ' ' && y !== '?'
}

function isUntracked(entry: StatusEntry): boolean {
  return entry.index === '?' && entry.worktree === '?'
}

function confirmDiscardFile(e: StatusEntry): boolean {
  if (isUntracked(e)) {
    return window.confirm(
      `Remove untracked path "${e.path}" from disk? This cannot be undone.`,
    )
  }
  return window.confirm(
    `Discard uncommitted changes in "${e.path}"? The file will match the staged version (index), or HEAD for unstaged-only changes.`,
  )
}

function statusPairLabel(index: string, worktree: string, stagedSide: boolean): string {
  const c = stagedSide ? index : worktree
  if (c === ' ' || c === '?') return ''
  if (c === 'M') return 'M'
  if (c === 'A') return 'A'
  if (c === 'D') return 'D'
  if (c === 'R') return 'R'
  if (c === 'C') return 'C'
  if (c === 'U') return 'U'
  return c
}

export function GitScmPanel() {
  const cwd = useGitCwdForVisibleWorkspace()
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const close = useSidePanelStore((s) => s.close)

  const wt = useGitFocusedCheckoutStore((s) => s.wt)
  const wtCwd = useGitFocusedCheckoutStore((s) => s.wtCwd)
  const loadState = useGitFocusedCheckoutStore((s) => s.loadState)
  const muxWorktreeFollowUp = useGitFocusedCheckoutStore((s) => s.muxWorktreeFollowUp)

  const wtAligned = useMemo(() => {
    if (!cwd) return null
    return normalizeGitCwdKey(cwd) === normalizeGitCwdKey(wtCwd) ? wt : null
  }, [cwd, wt, wtCwd])

  const summary = wtAligned?.isRepo === true ? wtAligned.summary : null

  const isRepo = useMemo((): boolean | null => {
    if (!cwd) return null
    if (loadState.kind === 'not-repo') return false
    if (loadState.kind === 'loading') return null
    if (wtAligned?.isRepo === true) return true
    if (wtAligned?.isRepo === false) return false
    if (loadState.kind === 'ok' && !wtAligned) return null
    return null
  }, [cwd, loadState.kind, wtAligned])

  const prFollowUpMenu = useMemo(() => {
    if (!muxWorktreeFollowUp) return null
    if (muxWorktreeFollowUp.kind === 'createPr') {
      return { kind: 'createPr' as const, compareUrl: muxWorktreeFollowUp.compareUrl }
    }
    return { kind: 'deleteMerged' as const }
  }, [muxWorktreeFollowUp])

  const [entries, setEntries] = useState<StatusEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const statusFetchSerial = useRef(0)

  /** File list only; branch/counts come from `GitFocusedCheckoutBridge` poll (same as status bar / quick action). */
  const refreshStatusFiles = useCallback(async () => {
    if (!cwd) {
      setEntries([])
      return
    }
    const sn = ++statusFetchSerial.current
    const st = await window.mux.git.statusFiles(cwd)
    if (sn !== statusFetchSerial.current) return
    if (st.ok) setEntries(st.entries)
    else setEntries([])
  }, [cwd])

  useEffect(() => {
    if (!cwd) {
      setEntries([])
      return
    }
    void refreshStatusFiles()
  }, [cwd, wt, wtCwd, refreshStatusFiles])

  const stagedRows = useMemo(
    () => entries.filter((e) => isStagedIndex(e.index)),
    [entries],
  )
  const changeRows = useMemo(
    () =>
      entries.filter(
        (e) => isUntracked(e) || isDirtyWorktree(e.worktree),
      ),
    [entries],
  )

  const clean =
    summary != null &&
    summary.conflictCount === 0 &&
    summary.stagedCount === 0 &&
    summary.unstagedCount === 0 &&
    summary.untrackedCount === 0

  const canCommit = summary != null && summary.stagedCount > 0 && summary.conflictCount === 0

  const showStageAllCta =
    summary != null &&
    !clean &&
    !canCommit &&
    (summary.unstagedCount > 0 || summary.untrackedCount > 0)

  /** Same cases as the status-bar quick action: origin + (commits to push or branch without upstream). */
  const showPushCta =
    clean &&
    summary != null &&
    summary.hasOrigin &&
    (summary.ahead > 0 || (!summary.detached && summary.upstreamShort == null))

  async function runOp(
    label: string,
    op: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ): Promise<boolean> {
    if (!cwd) return false
    setBusy(true)
    let success = false
    try {
      await runWithStatusActivity({ domain: 'git', label, detail: cwd }, async () => {
        const r = await op()
        if (!r.ok) window.alert(r.error)
        else {
          success = true
          await refreshFocusedCheckoutGit()
          await refreshStatusFiles()
        }
        return r
      })
    } finally {
      setBusy(false)
    }
    return success
  }

  async function runMergedBranchCleanup() {
    if (!cwd || !visibleWorkspaceId) return
    if (
      !window.confirm(
        'Remove this agent worktree and delete the branch on origin (if it still exists)?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await runWithStatusActivity(
        { domain: 'git', label: 'Cleaning up merged branch', detail: cwd },
        async () => {
          const r = await window.mux.git.cleanupMergedMuxWorktree(cwd)
          if (!r.ok) window.alert(r.error)
          else {
            useAgentTabsStore.getState().closeTabByAgentPath(visibleWorkspaceId, cwd)
            await refreshFocusedCheckoutGit()
            await refreshStatusFiles()
          }
          return r
        },
      )
    } finally {
      setBusy(false)
    }
  }

  async function submitCommit() {
    if (!cwd) return
    const msg = commitMessage.trim()
    if (!msg) return
    const ok = await runOp('Committing', () => window.mux.git.commit({ cwd, message: msg }))
    if (ok) setCommitMessage('')
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Source control
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title="More Git actions"
                disabled={!cwd || busy}
                aria-label="More Git actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="min-w-52">
              {cwd ? (
                <p
                  className="mb-1 truncate px-2 py-1 font-mono text-[10px] text-muted-foreground"
                  title={cwd}
                >
                  {cwd}
                </p>
              ) : null}
              {!cwd ? null : isRepo === false ? (
                <DropdownMenuItem
                  disabled={busy}
                  className="gap-2"
                  onSelect={(e) => {
                    e.preventDefault()
                    void runOp('Initializing repository', () => window.mux.git.init(cwd))
                  }}
                >
                  <GitBranchPlus className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  Initialize repository
                </DropdownMenuItem>
              ) : isRepo && summary ? (
                <>
                  <DropdownMenuItem
                    disabled={busy}
                    className="gap-2"
                    onSelect={(e) => {
                      e.preventDefault()
                      void runOp('Staging all changes', () => window.mux.git.addAll(cwd))
                    }}
                  >
                    <PlusSquare className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    Stage all changes
                  </DropdownMenuItem>
                  {summary.hasOrigin ? (
                    <>
                      <DropdownMenuItem
                        disabled={busy}
                        className="gap-2"
                        onSelect={(e) => {
                          e.preventDefault()
                          void runOp('Fetching from origin', () => window.mux.git.fetch(cwd))
                        }}
                      >
                        <RefreshCw className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        Fetch
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busy}
                        className="gap-2"
                        onSelect={(e) => {
                          e.preventDefault()
                          void runOp('Pulling from upstream', () => window.mux.git.pull(cwd))
                        }}
                      >
                        <ArrowDownToLine className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        Pull
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busy}
                        className="gap-2"
                        onSelect={(e) => {
                          e.preventDefault()
                          void runOp('Pushing to origin', () => window.mux.git.push(cwd))
                        }}
                      >
                        <ArrowUpFromLine className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        Push
                      </DropdownMenuItem>
                      {prFollowUpMenu?.kind === 'createPr' ? (
                        <DropdownMenuItem
                          disabled={busy}
                          className="gap-2"
                          onSelect={(e) => {
                            e.preventDefault()
                            void window.mux.shell.openExternal(prFollowUpMenu.compareUrl).then((r) => {
                              if (!r.ok) window.alert(r.error)
                            })
                          }}
                        >
                          <GitPullRequestCreateArrow className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          Create pull request…
                        </DropdownMenuItem>
                      ) : prFollowUpMenu?.kind === 'deleteMerged' ? (
                        <DropdownMenuItem
                          disabled={busy}
                          className="gap-2"
                          onSelect={(e) => {
                            e.preventDefault()
                            void runMergedBranchCleanup()
                          }}
                        >
                          <Trash2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          Delete branch & remove worktree…
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  ) : (
                    <DropdownMenuItem
                      disabled={busy}
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault()
                        setPublishOpen(true)
                      }}
                    >
                      <Github className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      Publish to GitHub…
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="ghost" size="icon-xs" title="Close panel" onClick={close}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {!cwd ? (
        <p className="p-3 text-sm text-muted-foreground">Select a workspace to use source control.</p>
      ) : cwd && isRepo === null ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin shrink-0" aria-hidden />
          Checking Git…
        </div>
      ) : isRepo === false ? (
        <div className="space-y-3 p-3">
          <p className="text-sm text-muted-foreground">This folder is not a Git repository.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void runOp('Initializing repository', () => window.mux.git.init(cwd))}
          >
            <GitBranchPlus className="size-3.5" />
            Initialize repository
          </Button>
        </div>
      ) : (
        <>
          {summary ? (
            <div className="shrink-0 space-y-1 border-b border-border/60 px-2 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-xs font-medium text-foreground">
                  {summary.branchLabel}
                </span>
                {summary.detached ? (
                  <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
                    detached
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                {summary.conflictCount > 0 ? (
                  <span className="text-destructive">
                    {summary.conflictCount} conflict{summary.conflictCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                {summary.behind > 0 ? (
                  <span>
                    {summary.behind} behind{summary.upstreamShort ? '' : ' (no upstream)'}
                  </span>
                ) : null}
                {summary.ahead > 0 ? <span>{summary.ahead} ahead</span> : null}
                {clean ? <span className="text-emerald-600 dark:text-emerald-400">Clean</span> : null}
              </div>
            </div>
          ) : null}

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-2 pb-3">
              {stagedRows.length > 0 ? (
                <div>
                  <div className="mb-1 flex min-w-0 items-center justify-between gap-1 px-0.5">
                    <span className="min-w-0 truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Staged ({stagedRows.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Unstage all"
                      disabled={busy}
                      aria-label="Unstage all"
                      onClick={() =>
                        void runOp('Unstaging all', () => window.mux.git.unstageAll(cwd!))
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                  </div>
                  <ul className="space-y-0.5">
                    {stagedRows.map((e) => (
                      <li
                        key={`s:${e.path}`}
                        className="flex min-w-0 items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-1.5 py-1"
                      >
                        <span className="shrink-0 rounded bg-background px-1 font-mono text-[10px] text-muted-foreground">
                          {statusPairLabel(e.index, e.worktree, true) || '·'}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={e.path}>
                          {e.oldPath ? `${e.oldPath} → ` : ''}
                          {e.path}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 shrink-0"
                          title="Unstage"
                          disabled={busy}
                          onClick={() =>
                            void runOp('Unstaging', () =>
                              window.mux.git.resetPathsHead({ cwd: cwd!, paths: [e.path] }),
                            )
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {changeRows.length > 0 ? (
                <div>
                  <div className="mb-1 flex min-w-0 items-center justify-between gap-1 px-0.5">
                    <span className="min-w-0 truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Changes ({changeRows.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Stage all changes"
                      disabled={busy}
                      aria-label="Stage all changes"
                      onClick={() =>
                        void runOp('Staging all changes', () => window.mux.git.addAll(cwd!))
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <ul className="space-y-0.5">
                    {changeRows.map((e) => (
                      <li
                        key={`c:${e.path}`}
                        className="flex min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 py-1 hover:border-border/60 hover:bg-muted/30"
                      >
                        <span className="shrink-0 rounded bg-muted/50 px-1 font-mono text-[10px] text-muted-foreground">
                          {isUntracked(e) ? 'U' : statusPairLabel(e.index, e.worktree, false) || '·'}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={e.path}>
                          {e.path}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                          title={
                            isUntracked(e)
                              ? 'Remove untracked file or folder from disk'
                              : 'Discard unstaged changes (revert file to index)'
                          }
                          disabled={busy}
                          onClick={() => {
                            if (!confirmDiscardFile(e)) return
                            void runOp('Reverting file', () =>
                              window.mux.git.discardWorktreePath({ cwd: cwd!, path: e.path }),
                            )
                          }}
                        >
                          <Undo2 className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 shrink-0"
                          title="Stage"
                          disabled={busy}
                          onClick={() =>
                            void runOp('Staging', () =>
                              window.mux.git.addPaths({ cwd: cwd!, paths: [e.path] }),
                            )
                          }
                        >
                          <Plus className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stagedRows.length === 0 && changeRows.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">No changes.</p>
              ) : null}
            </div>
          </ScrollArea>

          <div className="shrink-0 space-y-2 border-t border-border p-2">
            {canCommit ? (
              <>
                <textarea
                  className={cn(
                    'min-h-[72px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs',
                    'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                  )}
                  placeholder="Message (⌘/Ctrl+Enter to commit)"
                  value={commitMessage}
                  disabled={busy}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      if (commitMessage.trim()) void submitCommit()
                    }
                  }}
                />
                <Button
                  type="button"
                  className="w-full"
                  size="sm"
                  disabled={busy || !commitMessage.trim()}
                  onClick={() => void submitCommit()}
                >
                  <GitCommitHorizontal className="size-3.5" />
                  Commit
                </Button>
              </>
            ) : null}
            {showStageAllCta ? (
              <Button
                type="button"
                className="w-full"
                size="sm"
                disabled={busy}
                onClick={() => void runOp('Staging all changes', () => window.mux.git.addAll(cwd!))}
              >
                <PlusSquare className="size-3.5" />
                Stage all
              </Button>
            ) : null}
            {showPushCta && summary ? (
              <Button
                type="button"
                className="w-full"
                size="sm"
                disabled={busy}
                title={
                  summary.ahead > 0
                    ? `Push ${summary.ahead} local commit${summary.ahead === 1 ? '' : 's'} to origin`
                    : 'Push to origin and set upstream (first push for this branch)'
                }
                onClick={() => void runOp('Pushing to origin', () => window.mux.git.push(cwd!))}
              >
                <ArrowUpFromLine className="size-3.5" />
                Push
              </Button>
            ) : null}
            {clean && summary && !summary.hasOrigin ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="sm"
                disabled={busy}
                title="Publish to GitHub — create a repo and add origin"
                onClick={() => setPublishOpen(true)}
              >
                <Github className="size-3.5" />
                Publish to GitHub
              </Button>
            ) : null}
          </div>
        </>
      )}

      <PublishGithubDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        gitCwd={cwd}
        onPublished={() => {
          void refreshFocusedCheckoutGit()
          void refreshStatusFiles()
        }}
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CommitInspector, formatRelativeShort, type CommitInspectData } from '@/features/git-graph/commit-inspector'
import { DiffFileBlock } from '@/features/diff-panel/diff-file-block'
import { parseUnifiedDiff } from '@/features/diff-panel/parse-unified-diff'
import { friendlyMessageForGitLogFailure } from '@/features/git/git-friendly-panel-errors'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { SplitSash } from '@/features/shell/split-sash'
import {
  LAYOUT_KEYS,
  LAYOUT_RESET_EVENT,
  readPersistedGitGraphPanelLayout,
  type GitGraphPanelPersisted,
} from '@/lib/persisted-layout'
import { cn } from '@/lib/utils'
import { useSidePanelStore } from '@/stores/side-panel-store'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { useDiffViewModeStore } from '@/stores/diff-view-mode-store'
import { ChevronDown, ChevronRight, GitBranch, Loader2, RefreshCw, X } from 'lucide-react'

type LogCommit = {
  hash: string
  parents: string[]
  subject: string
  authorName: string
  dateIso: string
  refs: string
}

const MIN_SECTION_FRAC = 0.07

export function GitGraphPanel() {
  const cwd = useGitCwdForVisibleWorkspace()
  const close = useSidePanelStore((s) => s.close)
  const loadState = useGitFocusedCheckoutStore((s) => s.loadState)
  const diffViewMode = useDiffViewModeStore((s) => s.mode)
  const setDiffViewMode = useDiffViewModeStore((s) => s.setMode)

  const [commits, setCommits] = useState<LogCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logInfoMessage, setLogInfoMessage] = useState<string | null>(null)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const [inspect, setInspect] = useState<CommitInspectData | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)

  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  const loadLog = useCallback(async () => {
    if (!cwd) {
      setCommits([])
      setError(null)
      setLogInfoMessage(null)
      return
    }
    setLoading(true)
    setError(null)
    setLogInfoMessage(null)
    try {
      const r = await window.mux.git.logGraph(cwd)
      if (!r.ok) {
        setCommits([])
        const friendly = friendlyMessageForGitLogFailure(r.error)
        if (friendly) {
          setLogInfoMessage(friendly)
          setError(null)
        } else {
          setError(r.error)
          setLogInfoMessage(null)
        }
        return
      }
      setCommits(r.commits)
      setLogInfoMessage(null)
      setSelectedIndex(null)
      setInspect(null)
      setInspectError(null)
      setDiffText(null)
      setDiffError(null)
    } finally {
      setLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    void loadLog()
  }, [loadLog])

  const selectedCommit =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < commits.length
      ? commits[selectedIndex]!
      : null
  const selectedHash = selectedCommit?.hash ?? null

  useEffect(() => {
    if (!cwd || !selectedHash) {
      setInspect(null)
      setInspectError(null)
      setDiffText(null)
      setDiffError(null)
      setInspectLoading(false)
      setDiffLoading(false)
      return
    }

    let cancelled = false
    setInspectLoading(true)
    setDiffLoading(true)
    setInspectError(null)
    setDiffError(null)

    void (async () => {
      const [ins, diff] = await Promise.all([
        window.mux.git.commitInspect({ cwd, hash: selectedHash }),
        window.mux.git.commitDiff({ cwd, hash: selectedHash }),
      ])
      if (cancelled) return

      if (!ins.ok) {
        setInspect(null)
        setInspectError(ins.error)
      } else {
        setInspect({
          hash: ins.hash,
          shortHash: ins.shortHash,
          subject: ins.subject,
          authorName: ins.authorName,
          dateIso: ins.dateIso,
          files: ins.files,
        })
        setInspectError(null)
      }
      setInspectLoading(false)

      if (!diff.ok) {
        setDiffText(null)
        setDiffError(diff.error)
      } else {
        setDiffText(diff.text)
        setDiffError(null)
      }
      setDiffLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [cwd, selectedHash])

  const diffFiles = useMemo(() => {
    if (diffText == null || diffText === '') return []
    return parseUnifiedDiff(diffText)
  }, [diffText])

  const onPickCommit = useCallback(
    (index: number) => {
      if (index < 0 || index >= commits.length) return
      setSelectedIndex((prev) => (prev === index ? null : index))
    },
    [commits.length],
  )

  const [gitSplit, setGitSplit] = useState<GitGraphPanelPersisted>(() => readPersistedGitGraphPanelLayout())
  const { fracs: sectionFracs, collapsedCommit, collapsedDiff } = gitSplit
  const splitBodyRef = useRef<HTMLDivElement>(null)
  const sashDragRef = useRef<{
    pointerId: number
    which: 'commits-commit' | 'commit-diff'
    startY: number
    startFracs: [number, number, number]
  } | null>(null)

  const onSplitSashPointerDown = useCallback(
    (which: 'commits-commit' | 'commit-diff', e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      sashDragRef.current = {
        pointerId: e.pointerId,
        which,
        startY: e.clientY,
        startFracs: [...gitSplit.fracs],
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [gitSplit.fracs],
  )

  const onSplitSashPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = sashDragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const el = splitBodyRef.current
    if (!el) return
    const h = el.getBoundingClientRect().height
    if (h < 32) return
    const delta = (e.clientY - d.startY) / h
    if (d.which === 'commits-commit') {
      const [a0, b0, c0] = d.startFracs
      const na = Math.min(Math.max(a0 + delta, MIN_SECTION_FRAC), a0 + b0 - MIN_SECTION_FRAC)
      const nb = a0 + b0 - na
      setGitSplit((s) => ({ ...s, fracs: [na, nb, c0] }))
    } else {
      const [a0, b0, c0] = d.startFracs
      const nb = Math.min(Math.max(b0 + delta, MIN_SECTION_FRAC), b0 + c0 - MIN_SECTION_FRAC)
      const nc = b0 + c0 - nb
      setGitSplit((s) => ({ ...s, fracs: [a0, nb, nc] }))
    }
  }, [])

  const onSplitSashPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = sashDragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    sashDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEYS.gitGraphPanelLayout, JSON.stringify(gitSplit))
    } catch {
      /* ignore */
    }
  }, [gitSplit])

  useEffect(() => {
    const onReset = () => setGitSplit(readPersistedGitGraphPanelLayout())
    window.addEventListener(LAYOUT_RESET_EVENT, onReset)
    return () => window.removeEventListener(LAYOUT_RESET_EVENT, onReset)
  }, [])

  const [a, b, c] = sectionFracs
  const openCommit = !collapsedCommit
  const openDiff = !collapsedDiff

  /** While a pane is collapsed, its saved flex share is folded into siblings; reopening restores the same fracs. */
  const g0 =
    openCommit && openDiff ? a : !openCommit && openDiff ? a + b : openCommit && !openDiff ? a : a + b + c
  const g1 = openCommit && openDiff ? b : !openCommit && openDiff ? 0 : openCommit && !openDiff ? b : 0
  const g2 =
    openCommit && openDiff ? c : !openCommit && openDiff ? c : openCommit && !openDiff ? 0 : 0

  /** Collapsed panes must not use flex-basis:0 + minHeight:0 or they shrink to zero and cover the next header. */
  const sectionFlexStyle = (i: 0 | 1 | 2): CSSProperties => {
    const grow = i === 0 ? g0 : i === 1 ? g1 : g2
    if (i === 1 && !openCommit) {
      return { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0 }
    }
    if (i === 2 && !openDiff) {
      return { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0 }
    }
    return { flexGrow: grow, flexShrink: 1, flexBasis: 0, minHeight: 0 }
  }

  const sectionHeaderBarClass =
    'flex shrink-0 items-center gap-0.5 border-b border-border/60 bg-muted/15 px-1 py-0.5'
  const sectionHeaderToggleClass =
    'flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 py-1 text-left hover:bg-muted/50'

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            History
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Refresh"
            disabled={!cwd || loading}
            onClick={() => void loadLog()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" title="Close panel" onClick={close}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div ref={splitBodyRef} className="flex min-h-0 flex-1 flex-col">
        {/*
          When Commit is open but Diff is collapsed, group Commits + Commit in a flex-1 column so the
          collapsed Diff header is the last row and sits on the bottom edge of the panel.
        */}
        <div
          className={cn(
            openCommit && !openDiff
              ? 'flex min-h-0 min-w-0 flex-1 flex-col'
              : 'contents',
          )}
        >
          <div className="flex min-h-0 flex-col" style={sectionFlexStyle(0)}>
            <div className="shrink-0 border-b border-border/60 px-2 py-1">
              <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Commits
              </p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-0.5 p-2 pb-3">
                {!cwd && (
                  <p className="text-sm text-muted-foreground">Select a workspace.</p>
                )}
                {cwd && loadState.kind === 'not-repo' && (
                  <p className="text-sm text-muted-foreground">Not a git repository.</p>
                )}
                {cwd && loadState.kind !== 'not-repo' && logInfoMessage && (
                  <p className="text-sm text-muted-foreground">{logInfoMessage}</p>
                )}
                {cwd && loadState.kind !== 'not-repo' && error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                {cwd &&
                  loadState.kind !== 'not-repo' &&
                  !error &&
                  !logInfoMessage &&
                  commits.length === 0 &&
                  !loading && (
                  <p className="text-sm text-muted-foreground">No commits.</p>
                )}
                {commits.map((c, i) => {
                  const active = selectedIndex === i
                  return (
                    <button
                      key={c.hash}
                      type="button"
                      className={cn(
                        'flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors',
                        'hover:border-border hover:bg-muted/50',
                        active && 'border-border bg-accent/80',
                      )}
                      onClick={() => onPickCommit(i)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {c.hash.slice(0, 7)}
                        </span>
                        {c.refs.trim() ? (
                          <span className="min-w-0 truncate text-[10px] text-sky-600 dark:text-sky-400">
                            {c.refs}
                          </span>
                        ) : null}
                      </div>
                      <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                        {c.subject}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {c.authorName} · {formatRelativeShort(c.dateIso)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {openCommit ? (
            <SplitSash
              orientation="horizontal"
              aria-label="Resize commits and commit sections"
              onPointerDown={(e) => onSplitSashPointerDown('commits-commit', e)}
              onPointerMove={onSplitSashPointerMove}
              onPointerUp={onSplitSashPointerUp}
              onPointerCancel={onSplitSashPointerUp}
            />
          ) : null}

          <div className="flex min-h-0 flex-col overflow-hidden" style={sectionFlexStyle(1)}>
          <div className={sectionHeaderBarClass}>
            <button
              type="button"
              className={sectionHeaderToggleClass}
              aria-expanded={openCommit}
              aria-controls="mux-git-history-commit-pane"
              onClick={() => setGitSplit((s) => ({ ...s, collapsedCommit: !s.collapsedCommit }))}
            >
              {openCommit ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Commit
              </span>
            </button>
          </div>
          {openCommit ? (
            <div
              id="mux-git-history-commit-pane"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <ScrollArea className="min-h-0 flex-1">
                <div className="px-2 pb-3">
                  {selectedHash == null && (
                    <p className="py-3 text-sm text-muted-foreground">Select a commit to inspect.</p>
                  )}
                  {selectedHash != null && (
                    <CommitInspector
                      loading={inspectLoading}
                      error={inspectError}
                      data={inspect}
                      repoCwd={cwd}
                    />
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}
          </div>
        </div>

        {openCommit && openDiff ? (
          <SplitSash
            orientation="horizontal"
            aria-label="Resize commit and diff sections"
            onPointerDown={(e) => onSplitSashPointerDown('commit-diff', e)}
            onPointerMove={onSplitSashPointerMove}
            onPointerUp={onSplitSashPointerUp}
            onPointerCancel={onSplitSashPointerUp}
          />
        ) : null}

        <div className="flex min-h-0 flex-col overflow-hidden" style={sectionFlexStyle(2)}>
          <div className={cn(sectionHeaderBarClass, 'justify-between gap-2 pr-1.5')}>
            <button
              type="button"
              className={cn(sectionHeaderToggleClass, 'flex-1')}
              aria-expanded={openDiff}
              aria-controls="mux-git-history-diff-pane"
              onClick={() => setGitSplit((s) => ({ ...s, collapsedDiff: !s.collapsedDiff }))}
            >
              {openDiff ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Diff
              </span>
            </button>
            {openDiff ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant={diffViewMode === 'unified' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  title="Unified diff"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDiffViewMode('unified')
                  }}
                >
                  Unified
                </Button>
                <Button
                  type="button"
                  variant={diffViewMode === 'split' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  title="Side by side"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDiffViewMode('split')
                  }}
                >
                  Split
                </Button>
              </div>
            ) : null}
          </div>
          {openDiff ? (
            <div
              id="mux-git-history-diff-pane"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-3 p-2 pb-4">
                  {selectedHash == null && (
                    <p className="text-sm text-muted-foreground">Select a commit to view the diff.</p>
                  )}
                  {selectedHash != null && diffLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading diff…
                    </div>
                  )}
                  {selectedHash != null && !diffLoading && diffError && (
                    <p className="text-sm text-destructive">{diffError}</p>
                  )}
                  {selectedHash != null && !diffLoading && !diffError && diffFiles.length === 0 && (
                    <p className="text-sm text-muted-foreground">No file changes in this commit.</p>
                  )}
                  {diffFiles.map((f, i) => (
                    <DiffFileBlock
                      key={`${f.path}-${i}`}
                      file={f}
                      fileIndex={i}
                      viewMode={diffViewMode}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

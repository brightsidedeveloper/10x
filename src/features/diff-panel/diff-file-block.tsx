import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { buildSplitDiffRows } from '@/features/diff-panel/build-split-diff-rows'
import { DiffLineRow, SplitDiffSideCell } from '@/features/diff-panel/diff-line-row'
import type { ParsedDiffFile } from '@/features/diff-panel/parse-unified-diff'
import { useDiffSyntaxHighlight } from '@/features/diff-panel/use-diff-syntax-highlight'
import type { DiffViewMode } from '@/stores/diff-view-mode-store'
import { cn } from '@/lib/utils'
import { Check, Copy, FileCode2 } from 'lucide-react'

type Props = {
  file: ParsedDiffFile
  /** Anchor for scroll-into-view from the file strip. */
  fileIndex: number
  className?: string
  viewMode: DiffViewMode
}

export function DiffFileBlock({ file, fileIndex, className, viewMode }: Props) {
  const [copied, setCopied] = useState(false)
  const highlights = useDiffSyntaxHighlight(file)
  const splitRows = useMemo(() => buildSplitDiffRows(file.lines), [file.lines])

  return (
    <section
      id={`mux-diff-file-${fileIndex}`}
      className={cn(
        'scroll-mt-2 overflow-hidden rounded-lg border border-border/80 bg-card/40 shadow-sm dark:bg-card/25',
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-2.5 py-1.5 dark:bg-muted/25">
        <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
          {file.path}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Copy path"
          onClick={() => {
            void navigator.clipboard.writeText(file.path).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
          }}
        >
          {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        </Button>
      </header>

      {viewMode === 'unified' ? (
        <div className="min-w-0">
          {file.lines.map((line, i) => (
            <DiffLineRow key={i} line={line} tokens={highlights?.[i]} />
          ))}
        </div>
      ) : (
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-px border-b border-border/70 bg-muted/45 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/30">
            <div className="px-2 py-1">Original</div>
            <div className="px-2 py-1">Modified</div>
          </div>
          <div className="min-w-0 overflow-x-auto">
            {splitRows.map((row, ri) =>
              row.kind === 'full' ? (
                <DiffLineRow
                  key={ri}
                  line={row.line}
                  tokens={highlights?.[row.index]}
                />
              ) : (
                <div
                  key={ri}
                  className="grid min-w-0 grid-cols-2 divide-x divide-border/50 border-b border-border/25"
                >
                  <SplitDiffSideCell
                    line={row.left?.line ?? null}
                    tokens={row.left != null ? highlights?.[row.left.index] : undefined}
                  />
                  <SplitDiffSideCell
                    line={row.right?.line ?? null}
                    tokens={row.right != null ? highlights?.[row.right.index] : undefined}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  )
}

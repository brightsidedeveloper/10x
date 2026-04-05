import type { DiffLine } from '@/features/diff-panel/parse-unified-diff'

export type SplitDiffFullRow = { kind: 'full'; index: number; line: DiffLine }

export type SplitDiffPairRow = {
  kind: 'pair'
  left: { line: DiffLine; index: number } | null
  right: { line: DiffLine; index: number } | null
}

export type SplitDiffRow = SplitDiffFullRow | SplitDiffPairRow

/**
 * Turn a unified diff into aligned rows: context on both sides; removes paired with adds
 * (padding with blank cells when counts differ).
 */
export function buildSplitDiffRows(lines: DiffLine[]): SplitDiffRow[] {
  const out: SplitDiffRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.kind === 'meta' || line.kind === 'hunk') {
      out.push({ kind: 'full', index: i, line })
      i++
      continue
    }
    if (line.kind === 'context') {
      out.push({
        kind: 'pair',
        left: { line, index: i },
        right: { line, index: i },
      })
      i++
      continue
    }

    const chunk: { line: DiffLine; index: number }[] = []
    while (i < lines.length) {
      const L = lines[i]!
      if (L.kind === 'meta' || L.kind === 'hunk' || L.kind === 'context') break
      if (L.kind === 'add' || L.kind === 'remove') {
        chunk.push({ line: L, index: i })
        i++
      } else {
        break
      }
    }

    if (chunk.length === 0) {
      i++
      continue
    }

    const removes = chunk.filter((c) => c.line.kind === 'remove')
    const adds = chunk.filter((c) => c.line.kind === 'add')
    const n = Math.max(removes.length, adds.length)
    for (let k = 0; k < n; k++) {
      const lc = removes[k]
      const rc = adds[k]
      out.push({
        kind: 'pair',
        left: lc ? { line: lc.line, index: lc.index } : null,
        right: rc ? { line: rc.line, index: rc.index } : null,
      })
    }
  }
  return out
}

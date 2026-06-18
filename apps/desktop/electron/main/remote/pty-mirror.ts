/**
 * Lightweight per-session screen mirror so a phone attaching mid-session is not
 * blank (PTYs have no scrollback replay — see pty-manager). We retain a rolling
 * tail of raw output and replay it into the phone's xterm on subscribe; because
 * Claude Code's TUI redraws frequently, replaying the recent tail reconstructs a
 * usable screen.
 *
 * Future upgrade: swap the raw tail for an `@xterm/headless` instance + serialize
 * addon to emit an exact screen snapshot.
 */

import { setPtySnapshotProvider } from './remote-broadcast'

/** ~64 KB is enough to capture a full Claude Code redraw plus recent context. */
const MAX_TAIL_BYTES = 64 * 1024

const tails = new Map<string, string>()

export function feedPtyMirror(sessionId: string, data: string): void {
  const next = (tails.get(sessionId) ?? '') + data
  tails.set(sessionId, next.length > MAX_TAIL_BYTES ? next.slice(-MAX_TAIL_BYTES) : next)
}

export function dropPtyMirror(sessionId: string): void {
  tails.delete(sessionId)
}

function snapshot(sessionId: string): string | null {
  return tails.get(sessionId) ?? null
}

setPtySnapshotProvider(snapshot)

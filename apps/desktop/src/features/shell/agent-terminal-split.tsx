import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'

import { WorkspaceAgentDesk } from '@/features/agent-sessions/workspace-agent-desk'
import { TerminalPanel } from '@/features/terminal-panel/terminal-panel'
import {
  LAYOUT_DEFAULTS,
  LAYOUT_KEYS,
  LAYOUT_RESET_EVENT,
  readPersistedAgentTerminalFraction,
} from '@/lib/persisted-layout'
import { cn } from '@/lib/utils'
import { useTerminalPanelCollapseStore } from '@/stores/terminal-panel-collapse-store'

import { SplitSash } from './split-sash'

const F_MIN = LAYOUT_DEFAULTS.agentTerminalFractionMin
const F_MAX = LAYOUT_DEFAULTS.agentTerminalFractionMax
const F_DEFAULT = LAYOUT_DEFAULTS.agentTerminalFraction

/**
 * Vertical split between agent desk and terminal: flex ratio (like VS Code) + draggable sash.
 * Terminal height = fraction of this column; window resize keeps the ratio.
 */
export function AgentTerminalSplit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [terminalFraction, setTerminalFraction] = useState(readPersistedAgentTerminalFraction)
  const draggingPointerId = useRef<number | null>(null)
  const skipNextPersistRef = useRef(false)
  const collapsed = useTerminalPanelCollapseStore((s) => s.collapsed)
  const expandTerminalPanel = useTerminalPanelCollapseStore((s) => s.expand)

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    try {
      localStorage.setItem(LAYOUT_KEYS.agentTerminalSplit, String(terminalFraction))
    } catch {
      /* ignore */
    }
  }, [terminalFraction])

  useEffect(() => {
    const onReset = () => {
      skipNextPersistRef.current = true
      setTerminalFraction(F_DEFAULT)
    }
    window.addEventListener(LAYOUT_RESET_EVENT, onReset)
    return () => window.removeEventListener(LAYOUT_RESET_EVENT, onReset)
  }, [])

  const applyFractionFromClientY = useCallback((clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const h = rect.height
    if (h < 1) return
    const terminalPx = rect.bottom - clientY
    const f = terminalPx / h
    setTerminalFraction(Math.min(F_MAX, Math.max(F_MIN, f)))
  }, [])

  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    draggingPointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onDividerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPointerId.current !== e.pointerId) return
      applyFractionFromClientY(e.clientY)
    },
    [applyFractionFromClientY],
  )

  const onDividerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPointerId.current !== e.pointerId) return
      draggingPointerId.current = null
      applyFractionFromClientY(e.clientY)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [applyFractionFromClientY],
  )

  const agentFlex = 1 - terminalFraction

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={
          collapsed
            ? { flex: '1 1 0px', minHeight: 0 }
            : { flex: `${agentFlex} 1 0px`, minHeight: 120 }
        }
      >
        <WorkspaceAgentDesk />
      </div>
      {!collapsed ? (
        <SplitSash
          orientation="horizontal"
          aria-label="Resize terminal panel"
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={onDividerPointerUp}
          onPointerCancel={onDividerPointerUp}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.05 : 0.02
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setTerminalFraction((f) => Math.min(F_MAX, f + step))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setTerminalFraction((f) => Math.max(F_MIN, f - step))
            }
          }}
        />
      ) : null}
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-hidden',
          collapsed && 'pointer-events-none invisible max-h-0 min-h-0 flex-[0_0_0px] shrink-0',
        )}
        style={
          collapsed
            ? undefined
            : { flex: `${terminalFraction} 1 0px`, minHeight: 120 }
        }
        aria-hidden={collapsed}
      >
        <TerminalPanel />
      </div>
      {collapsed ? (
        <button
          type="button"
          className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border-t border-border bg-card px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-expanded={false}
          aria-controls="mux-terminal-panel"
          onClick={() => expandTerminalPanel()}
        >
          <ChevronUp className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="font-medium">Terminal</span>
          <span className="truncate text-[10px] opacity-70">Click or ⌘J / Ctrl+J to expand</span>
        </button>
      ) : null}
    </div>
  )
}

import { useEffect } from 'react'

import { useTerminalPanelCollapseStore } from '@/stores/terminal-panel-collapse-store'

import { isInsideDialog, isNonTerminalTextField } from './keyboard-shortcut-guards'

/**
 * ⌘J / Ctrl+J — toggle bottom terminal panel (VS Code–style).
 */
export function TerminalToggleShortcutBridge() {
  const toggle = useTerminalPanelCollapseStore((s) => s.toggle)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.key.toLowerCase() !== 'j') return
      if (e.repeat) return
      if (e.altKey) return

      const activeEl = document.activeElement
      if (isInsideDialog(activeEl)) return
      if (isNonTerminalTextField(activeEl)) return

      e.preventDefault()
      toggle()
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [toggle])

  return null
}

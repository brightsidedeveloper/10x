import { Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import {
  CLAUDE_PERMISSION_MODE_OPTIONS,
  type ClaudePermissionMode,
} from '@/lib/claude-permission-mode'
import { cn } from '@/lib/utils'

export function ClaudeSettingsPanel(_props: SettingsPanelProps) {
  const [mode, setMode] = useState<ClaudePermissionMode | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.mux.agent.getPermissionMode().then(
      (m) => {
        if (cancelled) return
        setMode(m)
        setLoadError(null)
      },
      () => {
        if (cancelled) return
        setLoadError('Could not load Claude settings.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(
    async (next: ClaudePermissionMode) => {
      const prev = mode
      setMode(next)
      const r = await window.mux.agent.setPermissionMode(next)
      setMode(r.mode)
      if (!r.ok) {
        setLoadError('Could not save Claude settings.')
        if (prev != null) setMode(prev)
      } else {
        setLoadError(null)
      }
    },
    [mode],
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Claude</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How much autonomy new Claude sessions launch with. This sets the{' '}
          <code className="rounded bg-muted px-1 font-mono text-xs">--permission-mode</code> the
          CLI starts in. Applies to sessions you open after changing it.
        </p>
      </div>

      {loadError != null && (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      )}

      {mode == null && loadError == null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {mode != null && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Permission mode
          </h3>
          <div className="space-y-2" role="radiogroup" aria-label="Claude permission mode">
            {CLAUDE_PERMISSION_MODE_OPTIONS.map((option) => {
              const active = mode === option.mode
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={cn(
                    'flex w-full items-start justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card/40 hover:bg-muted/60',
                  )}
                  onClick={() => void persist(option.mode)}
                >
                  <div className="min-w-0 space-y-0.5 pr-2">
                    <p className="text-sm font-medium text-foreground">{option.title}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  {active && <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

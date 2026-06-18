import { useCallback, useEffect, useState } from 'react'

import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type AgentNotificationPrefs = { pushEnabled: boolean; soundEnabled: boolean }

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  switchId,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
  switchId: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3',
        disabled && 'opacity-60',
      )}
    >
      <div className="min-w-0 space-y-0.5 pr-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={switchId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
        aria-label={title}
      />
    </div>
  )
}

export function NotificationsSettingsPanel(_props: SettingsPanelProps) {
  const [prefs, setPrefs] = useState<AgentNotificationPrefs | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.mux.agent.getNotificationPrefs().then(
      (p) => {
        if (cancelled) return
        setPrefs(p)
        setLoadError(null)
      },
      () => {
        if (cancelled) return
        setLoadError('Could not load notification settings.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: AgentNotificationPrefs) => {
    setPrefs(next)
    const r = await window.mux.agent.setNotificationPrefs(next)
    setPrefs(r.prefs)
    if (!r.ok) setLoadError('Could not save notification settings.')
    else setLoadError(null)
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          OS alerts when an agent run finishes or needs you. Workspace rail badges, tab dots, and the
          dock badge always update — they are not controlled here.
        </p>
      </div>

      {loadError != null && (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      )}

      {prefs == null && loadError == null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {prefs != null && (
        <div className="space-y-3">
          <ToggleRow
            switchId="mux-notif-push"
            title="Push notifications"
            description="Show a system notification when an agent completes a turn or needs your attention (for example, a permission prompt)."
            checked={prefs.pushEnabled}
            onCheckedChange={(pushEnabled) => void persist({ ...prefs, pushEnabled })}
          />
          <ToggleRow
            switchId="mux-notif-sound"
            title="Sound"
            description="Play a sound when a notification is shown. On macOS this uses the alert sound configured for notifications."
            checked={prefs.soundEnabled}
            disabled={!prefs.pushEnabled}
            onCheckedChange={(soundEnabled) => void persist({ ...prefs, soundEnabled })}
          />
        </div>
      )}
    </div>
  )
}

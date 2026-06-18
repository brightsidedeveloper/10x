import { Monitor, Moon, Sun } from 'lucide-react'

import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import { THEME_ACCENTS, type ColorMode } from '@/lib/persisted-theme'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme-store'

const COLOR_MODES: ReadonlyArray<{ id: ColorMode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

export function AppearanceSettingsPanel(_props: SettingsPanelProps) {
  const colorMode = useThemeStore((s) => s.colorMode)
  const accent = useThemeStore((s) => s.accent)
  const resolvedScheme = useThemeStore((s) => s.resolvedScheme)
  const setColorMode = useThemeStore((s) => s.setColorMode)
  const setAccent = useThemeStore((s) => s.setAccent)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose light or dark mode and an accent color for buttons and highlights.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color mode</h3>
          {colorMode === 'system' ? (
            <span className="text-xs text-muted-foreground">Using {resolvedScheme} (system)</span>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_MODES.map(({ id, label, icon: Icon }) => {
            const active = colorMode === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                onClick={() => setColorMode(id)}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accent color</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {THEME_ACCENTS.map((preset) => {
            const active = accent === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                title={preset.label}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border px-2 py-2.5 text-[11px] transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                onClick={() => setAccent(preset.id)}
              >
                <span
                  className="size-6 rounded-full border border-border shadow-sm"
                  style={{ backgroundColor: preset.swatch }}
                  aria-hidden
                />
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

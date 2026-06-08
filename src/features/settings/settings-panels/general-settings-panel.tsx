import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Check, Loader2, RefreshCw } from 'lucide-react'

import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import { FRIENDLY_UPDATER_BUILD_IN_PROGRESS_MESSAGE } from '@/features/updater/updater-messages'
import { Button } from '@/components/ui/button'
import type {
  TerminalShellOptionsSnapshot,
  TerminalShellPreference,
} from '@/lib/terminal-shell-preference'
import { cn } from '@/lib/utils'

type UpdatePhase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'dev' }
  | { kind: 'error'; message: string }
  | { kind: 'upToDate' }
  | { kind: 'updateAvailable'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'readyToInstall' }

export function GeneralSettingsPanel(_props: SettingsPanelProps) {
  const [version, setVersion] = useState<string | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>({ kind: 'idle' })
  const [shellSnapshot, setShellSnapshot] = useState<TerminalShellOptionsSnapshot | null>(null)
  const [shellLoadError, setShellLoadError] = useState<string | null>(null)

  useEffect(() => {
    void window.mux.updater.getAppVersion().then(setVersion)
  }, [])

  const loadShellOptions = useCallback(async () => {
    try {
      const snapshot = await window.mux.shell.listTerminalShellOptions()
      setShellSnapshot(snapshot)
      setShellLoadError(null)
    } catch {
      setShellLoadError('Could not load terminal shell settings.')
    }
  }, [])

  useEffect(() => {
    void loadShellOptions()
  }, [loadShellOptions])

  const persistShellPreference = useCallback(
    async (next: TerminalShellPreference) => {
      const prev = shellSnapshot?.preference
      if (shellSnapshot) {
        setShellSnapshot({ ...shellSnapshot, preference: next })
      }
      const r = await window.mux.shell.setTerminalPreference(next)
      if (!r.ok) {
        setShellLoadError('Could not save terminal shell settings.')
        if (prev != null && shellSnapshot) {
          setShellSnapshot({ ...shellSnapshot, preference: prev })
        }
        return
      }
      setShellLoadError(null)
      await loadShellOptions()
    },
    [loadShellOptions, shellSnapshot],
  )

  useEffect(() => {
    const unProgress = window.mux.updater.onDownloadProgress((p) => {
      setPhase({ kind: 'downloading', percent: Math.round(p.percent) })
    })
    const unDownloaded = window.mux.updater.onUpdateDownloaded(() => {
      setPhase({ kind: 'readyToInstall' })
    })
    const unErr = window.mux.updater.onError((e) => {
      if (e.message === FRIENDLY_UPDATER_BUILD_IN_PROGRESS_MESSAGE) {
        setPhase({ kind: 'upToDate' })
        return
      }
      setPhase({ kind: 'error', message: e.message })
    })
    return () => {
      unProgress()
      unDownloaded()
      unErr()
    }
  }, [])

  const check = useCallback(async () => {
    setPhase({ kind: 'checking' })
    const r = await window.mux.updater.checkForUpdates()
    if (!r.ok) {
      setPhase({ kind: 'error', message: r.error })
      return
    }
    if (!r.isPackaged) {
      setPhase({ kind: 'dev' })
      return
    }
    if (r.updateAvailable && r.latestVersion) {
      setPhase({ kind: 'updateAvailable', version: r.latestVersion })
      return
    }
    setPhase({ kind: 'upToDate' })
  }, [])

  useLayoutEffect(() => {
    void check()
  }, [check])

  const download = useCallback(async () => {
    setPhase({ kind: 'downloading', percent: 0 })
    const r = await window.mux.updater.downloadUpdate()
    if (!r.ok) {
      if (r.error === FRIENDLY_UPDATER_BUILD_IN_PROGRESS_MESSAGE) {
        setPhase({ kind: 'upToDate' })
      } else {
        setPhase({ kind: 'error', message: r.error })
      }
    }
  }, [])

  const restart = useCallback(() => {
    void window.mux.updater.quitAndInstall()
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          App version, updates, and the shell used for new terminal tabs.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Version</p>
        <p className="mt-1 font-mono text-sm text-foreground">{version ?? '—'}</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={phase.kind === 'checking'}
            onClick={() => void check()}
          >
            {phase.kind === 'checking' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Check for updates
          </Button>
          {phase.kind === 'updateAvailable' && (
            <Button type="button" size="sm" onClick={() => void download()}>
              Download {phase.version}
            </Button>
          )}
          {phase.kind === 'readyToInstall' && (
            <Button type="button" size="sm" onClick={restart}>
              Restart and update
            </Button>
          )}
        </div>

        {phase.kind === 'downloading' && (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${phase.percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Downloading… {phase.percent}%</p>
          </div>
        )}

        <p
          className={cn(
            'text-sm',
            phase.kind === 'error' && 'text-destructive',
            phase.kind !== 'error' && 'text-muted-foreground',
          )}
        >
          {phase.kind === 'idle' && 'See if a newer build is available on GitHub.'}
          {phase.kind === 'checking' && 'Checking…'}
          {phase.kind === 'dev' && 'Updates are available in the packaged app (not in dev mode).'}
          {phase.kind === 'upToDate' && "You're on the latest release."}
          {phase.kind === 'updateAvailable' && `Version ${phase.version} is available.`}
          {phase.kind === 'error' && phase.message}
          {phase.kind === 'readyToInstall' && 'Update downloaded. Restart to finish installing.'}
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Terminal shell
        </h3>
        <p className="text-sm text-muted-foreground">
          Shell used when opening new terminal tabs. Existing tabs keep their current shell.
        </p>

        {shellLoadError != null && (
          <p className="text-sm text-destructive" role="alert">
            {shellLoadError}
          </p>
        )}

        {shellSnapshot == null && shellLoadError == null && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {shellSnapshot != null && (
          <>
            {shellSnapshot.resolvedPath != null && (
              <p className="font-mono text-xs text-muted-foreground">
                Active: {shellSnapshot.resolvedLabel ?? 'Shell'} — {shellSnapshot.resolvedPath}
              </p>
            )}
            <div className="space-y-2" role="radiogroup" aria-label="Terminal shell">
              {shellSnapshot.options.map((option) => {
                const active = shellSnapshot.preference === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={cn(
                      'flex w-full items-start justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card/40 hover:bg-muted/60',
                    )}
                    onClick={() => void persistShellPreference(option.id)}
                  >
                    <div className="min-w-0 space-y-0.5 pr-2">
                      <p className="text-sm font-medium text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                      {option.resolvedPath != null && (
                        <p className="truncate font-mono text-[11px] text-muted-foreground/80">
                          {option.resolvedPath}
                        </p>
                      )}
                    </div>
                    {active && (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

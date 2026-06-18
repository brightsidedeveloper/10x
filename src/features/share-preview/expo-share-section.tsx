import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Copy, Hammer, Loader2, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { runExpoDevBuildSetupInTerminal } from './run-expo-setup-in-terminal'
import { ShareStateBadge } from './share-state-badge'
import { TunnelQr } from './tunnel-qr'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { useExpoStore, type ExpoSession } from '@/stores/expo-store'

/** Expo dev builds need Xcode, so this section is macOS-only. */
const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Could not copy')
  }
}

type Props = {
  /** Close the dialog so the setup terminal is visible. */
  onClose: () => void
}

/** "React Native (Expo Go)" section: start a Metro tunnel for the active workspace and scan it. */
export function ExpoShareSection({ onClose }: Props) {
  const workspace = useActiveWorkspace()
  const cwd = workspace?.path ?? null

  const sessions = useExpoStore((s) => s.sessions)
  const remove = useExpoStore((s) => s.remove)

  const [isExpo, setIsExpo] = useState<boolean | null>(null)
  const [isDevClient, setIsDevClient] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!cwd) {
      setIsExpo(false)
      setIsDevClient(false)
      return
    }
    let cancelled = false
    void window.mux.expo.isProject(cwd).then((ok) => {
      if (!cancelled) setIsExpo(ok)
    })
    void window.mux.expo.isDevClient(cwd).then((ok) => {
      if (!cancelled) setIsDevClient(ok)
    })
    return () => {
      cancelled = true
    }
  }, [cwd])

  /** Which client this URL targets — `exp+…` is a dev build, plain `exp://` is Expo Go. */
  const clientLabel = (url: string | null) =>
    url?.startsWith('exp+') ? 'your dev build' : 'Expo Go'

  const rows = useMemo(() => Object.values(sessions), [sessions])
  const hasLiveForCwd = rows.some(
    (s) =>
      s.cwd === cwd &&
      (s.state === 'installing' || s.state === 'starting' || s.state === 'ready'),
  )

  // macOS-only, and only for Expo projects.
  if (!IS_MAC || isExpo !== true) return null

  async function startExpo() {
    if (!cwd) return
    setStarting(true)
    try {
      const result = await window.mux.expo.start(cwd)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      useExpoStore.getState().upsert(result.session)
    } finally {
      setStarting(false)
    }
  }

  async function stopExpo(session: ExpoSession) {
    await window.mux.expo.stop(session.id)
    remove(session.id)
  }

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">
          React Native ({isDevClient ? 'Dev Build' : 'Expo Go'})
        </h3>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          {`Start a Metro tunnel for ${workspace?.label ?? 'this project'} and scan it in ${
            isDevClient ? 'your dev build' : 'Expo Go'
          }.`}
        </p>
        <Button
          type="button"
          onClick={() => void startExpo()}
          disabled={!cwd || starting || hasLiveForCwd}
        >
          {starting ? <Loader2 className="animate-spin" /> : null}
          Start tunnel
        </Button>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((session) => (
            <li key={session.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{session.label}</span>
                  <ShareStateBadge state={session.state} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={session.state === 'ready' ? 'Stop tunnel' : 'Dismiss'}
                  onClick={() => void stopExpo(session)}
                >
                  <X />
                </Button>
              </div>

              {session.url && (
                <div className="mt-3 flex gap-3">
                  <TunnelQr value={session.url} size={132} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <code className="truncate rounded bg-muted px-2 py-1 text-xs">
                      {session.url}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => void copyText(session.url as string)}
                    >
                      <Copy />
                      Copy
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Open {clientLabel(session.url)} on your phone and scan this QR to load the app.
                    </p>
                  </div>
                </div>
              )}

              {session.state === 'error' && session.error && (
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-destructive">
                  {session.error}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="group rounded-md border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          Use a dev build instead of Expo Go
        </summary>
        <div className="space-y-3 border-t border-border px-3 py-3 text-sm text-muted-foreground">
          <p>
            Expo Go is locked to App Store SDK versions. For any SDK, build your own dev client once
            in Xcode — then this tunnel live-updates it just like Expo Go.
          </p>
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>
              Click <strong>Set up dev build</strong> below — installs{' '}
              <code className="rounded bg-muted px-1">expo-dev-client</code> and generates the native{' '}
              <code className="rounded bg-muted px-1">ios/</code> project in a terminal.
            </li>
            <li>
              Click <strong>Open in Xcode</strong> (opens the generated{' '}
              <code className="rounded bg-muted px-1">.xcworkspace</code>).
            </li>
            <li>
              <strong>Xcode → Settings → Accounts → “+”</strong> → sign in with your Apple Developer
              account (one time, requires 2FA).
            </li>
            <li>
              Select the app target → <strong>Signing &amp; Capabilities</strong> → tick{' '}
              <strong>“Automatically manage signing”</strong> and choose your <strong>Team</strong>.
            </li>
            <li>
              Pick your iPhone in the device dropdown and press <strong>▶</strong> once to build &amp;
              install. Xcode creates the certificate + profile and registers your device.
            </li>
            <li>
              Open the installed dev build on your phone and scan this tunnel’s QR to live-update.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!cwd}
              onClick={() => {
                if (!cwd) return
                runExpoDevBuildSetupInTerminal(cwd, workspace?.id)
                onClose()
              }}
            >
              <Hammer />
              Set up dev build
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!cwd}
              onClick={() => cwd && void window.mux.ios.openProject(cwd)}
            >
              Open in Xcode
            </Button>
          </div>
        </div>
      </details>
    </section>
  )
}

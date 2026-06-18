import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { TunnelQr } from './tunnel-qr'
import { cn } from '@/lib/utils'
import { useTunnelStore, type Tunnel } from '@/stores/tunnel-store'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATE_LABEL: Record<Tunnel['state'], string> = {
  starting: 'Starting…',
  ready: 'Live',
  error: 'Error',
  closed: 'Closed',
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Could not copy')
  }
}

export function SharePreviewDialog({ open, onOpenChange }: Props) {
  const tunnels = useTunnelStore((s) => s.tunnels)
  const remove = useTunnelStore((s) => s.remove)

  const [port, setPort] = useState('3000')
  const [starting, setStarting] = useState(false)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [installCommand, setInstallCommand] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.mux.tunnel.isInstalled().then(async (ok) => {
      if (cancelled) return
      setInstalled(ok)
      if (!ok) {
        const info = await window.mux.tunnel.getInstallCommand()
        if (!cancelled) setInstallCommand(info.command)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const rows = useMemo(
    () => Object.values(tunnels).sort((a, b) => a.port - b.port),
    [tunnels],
  )

  async function startShare() {
    const parsed = Number(port)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      toast.error('Enter a valid port (1–65535).')
      return
    }
    setStarting(true)
    try {
      const result = await window.mux.tunnel.start({ port: parsed, kind: 'web' })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // The store is hydrated by TunnelStatusBridge; nudge it so the row shows immediately.
      useTunnelStore.getState().upsert(result.tunnel)
    } finally {
      setStarting(false)
    }
  }

  async function stopShare(tunnel: Tunnel) {
    await window.mux.tunnel.stop(tunnel.id)
    remove(tunnel.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">Share a dev server</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Expose a local port through a Cloudflare quick tunnel and open it on your phone.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {installed === false && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">cloudflared is not installed</p>
              <p className="text-muted-foreground">
                Install it, then reopen this dialog to share a port.
              </p>
              {installCommand && (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                    {installCommand}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Copy install command"
                    onClick={() => void copyText(installCommand)}
                  >
                    <Copy />
                  </Button>
                </div>
              )}
            </div>
          )}

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void startShare()
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Local port</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="h-8 w-28 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="3000"
              />
            </label>
            <Button type="submit" disabled={starting || installed === false}>
              {starting ? <Loader2 className="animate-spin" /> : null}
              Share
            </Button>
          </form>

          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No active shares yet. Start your dev server, then share its port.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((tunnel) => (
                <li key={tunnel.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">localhost:{tunnel.port}</span>
                      <StateBadge state={tunnel.state} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={tunnel.state === 'ready' ? 'Stop sharing' : 'Dismiss'}
                      onClick={() => void stopShare(tunnel)}
                    >
                      <X />
                    </Button>
                  </div>

                  {tunnel.url && (
                    <div className="mt-3 flex gap-3">
                      <TunnelQr value={tunnel.url} size={132} />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <code className="truncate rounded bg-muted px-2 py-1 text-xs">
                          {tunnel.url}
                        </code>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void copyText(tunnel.url as string)}
                          >
                            <Copy />
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void window.mux.shell.openExternal(tunnel.url as string)}
                          >
                            <ExternalLink />
                            Open
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Scan the QR with your phone to open it remotely.
                        </p>
                      </div>
                    </div>
                  )}

                  {tunnel.state === 'error' && tunnel.error && (
                    <p className="mt-2 text-xs text-destructive">{tunnel.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StateBadge({ state }: { state: Tunnel['state'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        state === 'ready' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        state === 'starting' && 'bg-muted text-muted-foreground',
        state === 'error' && 'bg-destructive/15 text-destructive',
        state === 'closed' && 'bg-muted text-muted-foreground',
      )}
    >
      {state === 'ready' && <Check className="size-3" />}
      {state === 'starting' && <Loader2 className="size-3 animate-spin" />}
      {STATE_LABEL[state]}
    </span>
  )
}

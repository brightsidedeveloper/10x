import { useCallback, useEffect, useState } from 'react'
import { Loader2, Radio, RefreshCw, Smartphone, Trash2, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'

import type { PairingPayload, RemoteControlStatus } from '@10x/protocol'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { TunnelQr } from '@/features/share-preview/tunnel-qr'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatLastSeen(at: number | null): string {
  if (at == null) return 'never'
  const secs = Math.round((Date.now() - at) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function RemoteControlDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<RemoteControlStatus | null>(null)
  const [pairing, setPairing] = useState<PairingPayload | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setStatus(await window.mux.remote.status())
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.mux.remote.status().then((s) => {
      if (!cancelled) setStatus(s)
    })
    // Poll while open so the connected/last-seen indicators stay fresh.
    const timer = setInterval(() => void refresh(), 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open, refresh])

  async function enable() {
    setBusy(true)
    try {
      const res = await window.mux.remote.enable()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setPairing(res.pairing)
      setStatus(res.status)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      setPairing(null)
      setStatus(await window.mux.remote.disable())
    } finally {
      setBusy(false)
    }
  }

  async function pairAnother() {
    const res = await window.mux.remote.rotatePairingCode()
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setPairing(res.pairing)
    toast.success('New pairing code — scan within 5 minutes')
  }

  async function revoke(deviceId: string) {
    setStatus(await window.mux.remote.revokeDevice(deviceId))
  }

  const enabled = status?.enabled === true && status.serverRunning
  const qrValue = pairing ? JSON.stringify(pairing) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Radio className="size-4" />
            Remote control
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Pair your phone to drive 10x on the go — agents, git, and dev servers, all running here
            on your desktop.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {status && !status.cloudflaredInstalled && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">cloudflared is not installed</p>
              <p className="text-muted-foreground">
                Remote control reuses the Cloudflare tunnel. Install cloudflared, then enable.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-sm">
              {enabled ? (
                <Wifi className="size-4 text-emerald-500" />
              ) : (
                <WifiOff className="size-4 text-muted-foreground" />
              )}
              <span className="font-medium">{enabled ? 'Remote control is on' : 'Remote control is off'}</span>
            </div>
            <Button
              type="button"
              variant={enabled ? 'outline' : 'default'}
              size="sm"
              disabled={busy || (status != null && !status.cloudflaredInstalled)}
              onClick={() => void (enabled ? disable() : enable())}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              {enabled ? 'Turn off' : 'Turn on'}
            </Button>
          </div>

          {enabled && qrValue && (
            <div className="flex gap-3 rounded-md border border-border p-3">
              <TunnelQr value={qrValue} size={148} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-sm font-medium">Scan to pair</p>
                <p className="text-xs text-muted-foreground">
                  Open the 10x app on your phone and scan this code. It expires in 5 minutes and works
                  once.
                </p>
                {status?.url && (
                  <code className="truncate rounded bg-muted px-2 py-1 text-xs">{status.url}</code>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => void pairAnother()}>
                  <RefreshCw />
                  New code
                </Button>
              </div>
            </div>
          )}

          {enabled && !qrValue && (
            <Button type="button" variant="outline" size="sm" onClick={() => void pairAnother()}>
              <Smartphone />
              Pair a device
            </Button>
          )}

          {status && status.devices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paired devices
              </p>
              <ul className="space-y-2">
                {status.devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.connected ? (
                            <span className="text-emerald-500">Connected</span>
                          ) : (
                            `Last seen ${formatLastSeen(d.lastSeenAt)}`
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Revoke this device"
                      onClick={() => void revoke(d.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

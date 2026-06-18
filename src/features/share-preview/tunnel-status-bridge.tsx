import { useEffect } from 'react'

import { useTunnelStore } from '@/stores/tunnel-store'

/**
 * App-wide bridge: hydrates the tunnel list on mount and keeps it live as cloudflared
 * processes report status. Mounted once so shared previews survive closing the dialog.
 */
export function TunnelStatusBridge() {
  const setAll = useTunnelStore((s) => s.setAll)
  const upsert = useTunnelStore((s) => s.upsert)

  useEffect(() => {
    let cancelled = false
    void window.mux.tunnel.list().then((list) => {
      if (!cancelled) setAll(list)
    })
    const off = window.mux.tunnel.onStatus((tunnel) => upsert(tunnel))
    return () => {
      cancelled = true
      off()
    }
  }, [setAll, upsert])

  return null
}

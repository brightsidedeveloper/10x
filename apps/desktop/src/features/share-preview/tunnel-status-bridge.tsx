import { useEffect } from 'react'

import { useExpoStore } from '@/stores/expo-store'
import { useTunnelStore } from '@/stores/tunnel-store'

/**
 * App-wide bridge: hydrates the tunnel + Expo lists on mount and keeps them live as the
 * underlying processes report status. Mounted once so shared previews survive closing the dialog.
 */
export function TunnelStatusBridge() {
  const setAllTunnels = useTunnelStore((s) => s.setAll)
  const upsertTunnel = useTunnelStore((s) => s.upsert)
  const setAllExpo = useExpoStore((s) => s.setAll)
  const upsertExpo = useExpoStore((s) => s.upsert)

  useEffect(() => {
    let cancelled = false
    void window.mux.tunnel.list().then((list) => {
      if (!cancelled) setAllTunnels(list)
    })
    void window.mux.expo.list().then((list) => {
      if (!cancelled) setAllExpo(list)
    })
    const offTunnel = window.mux.tunnel.onStatus((tunnel) => upsertTunnel(tunnel))
    const offExpo = window.mux.expo.onStatus((session) => upsertExpo(session))
    return () => {
      cancelled = true
      offTunnel()
      offExpo()
    }
  }, [setAllTunnels, upsertTunnel, setAllExpo, upsertExpo])

  return null
}

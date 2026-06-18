import { create } from 'zustand'

/** Mirrors the main-process `TunnelSnapshot` (declared globally in mux-window.d.ts). */
export type Tunnel = TunnelSnapshot

type TunnelStoreState = {
  /** Active + recently-finished tunnels, keyed by id. */
  tunnels: Record<string, Tunnel>
  /** Replace the whole set (used on hydrate from `mux.tunnel.list()`). */
  setAll: (list: Tunnel[]) => void
  /** Insert or update one tunnel (driven by `mux.tunnel.onStatus`). */
  upsert: (tunnel: Tunnel) => void
  /** Drop a tunnel from the list (after stop, or dismissing a closed/error row). */
  remove: (id: string) => void
}

export const useTunnelStore = create<TunnelStoreState>((set) => ({
  tunnels: {},
  setAll: (list) =>
    set({ tunnels: Object.fromEntries(list.map((t) => [t.id, t])) }),
  upsert: (tunnel) =>
    set((state) => ({ tunnels: { ...state.tunnels, [tunnel.id]: tunnel } })),
  remove: (id) =>
    set((state) => {
      const next = { ...state.tunnels }
      delete next[id]
      return { tunnels: next }
    }),
}))

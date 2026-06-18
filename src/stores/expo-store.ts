import { create } from 'zustand'

/** Mirrors the main-process `ExpoSnapshot` (declared globally in mux-window.d.ts). */
export type ExpoSession = ExpoSnapshot

type ExpoStoreState = {
  /** Active + recently-finished Expo sessions, keyed by id. */
  sessions: Record<string, ExpoSession>
  setAll: (list: ExpoSession[]) => void
  upsert: (session: ExpoSession) => void
  remove: (id: string) => void
}

export const useExpoStore = create<ExpoStoreState>((set) => ({
  sessions: {},
  setAll: (list) => set({ sessions: Object.fromEntries(list.map((s) => [s.id, s])) }),
  upsert: (session) =>
    set((state) => ({ sessions: { ...state.sessions, [session.id]: session } })),
  remove: (id) =>
    set((state) => {
      const next = { ...state.sessions }
      delete next[id]
      return { sessions: next }
    }),
}))

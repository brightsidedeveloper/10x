import { create } from 'zustand'

const STORAGE_KEY = 'mux.diffViewMode'

export type DiffViewMode = 'unified' | 'split'

function readMode(): DiffViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'split') return 'split'
    return 'unified'
  } catch {
    return 'unified'
  }
}

type State = {
  mode: DiffViewMode
  setMode: (mode: DiffViewMode) => void
}

export const useDiffViewModeStore = create<State>((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    set({ mode })
  },
}))

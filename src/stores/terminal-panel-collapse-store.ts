import { create } from 'zustand'

const STORAGE_KEY = 'mux.terminalPanelCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

type State = {
  collapsed: boolean
  toggle: () => void
  expand: () => void
  collapse: () => void
}

export const useTerminalPanelCollapseStore = create<State>((set, get) => ({
  collapsed: readCollapsed(),
  toggle: () => {
    const next = !get().collapsed
    writeCollapsed(next)
    set({ collapsed: next })
  },
  expand: () => {
    writeCollapsed(false)
    set({ collapsed: false })
  },
  collapse: () => {
    writeCollapsed(true)
    set({ collapsed: true })
  },
}))

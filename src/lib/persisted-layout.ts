/**
 * Single source for layout-related localStorage keys and defaults (workspaces rail, agent/terminal
 * split, side panel: diff / git history / source control). Used by shell components and Settings → Layout.
 */

export const LAYOUT_KEYS = {
  workspacesRail: 'mux.workspacesRailWidthPx',
  agentTerminalSplit: 'mux.agentTerminalSplitFraction',
  sidePanel: 'mux.sidePanelWidthPx',
  sidePanelLegacy: 'mux.diffPanelWidthPx',
  gitGraphPanelLayout: 'mux.gitGraphPanelLayout',
} as const

export const LAYOUT_DEFAULTS = {
  workspacesRailWidthPx: 240,
  workspacesRailMinPx: 180,
  workspacesRailMaxPx: 560,
  /** Lower panel (terminal) share of the agent column height. */
  agentTerminalFraction: 0.38,
  agentTerminalFractionMin: 0.14,
  agentTerminalFractionMax: 0.78,
  sidePanelWidthPx: 360,
  sidePanelMinPx: 220,
  /** Upper cap for drag + persisted width (large monitors / split diff). */
  sidePanelMaxPx: 2400,
} as const

/** Dispatched on window after persisted layout keys are cleared; shell splits reset live state. */
export const LAYOUT_RESET_EVENT = 'mux-layout-reset'

export function readPersistedWorkspacesRailWidth(): number {
  try {
    const raw = localStorage.getItem(LAYOUT_KEYS.workspacesRail)
    if (raw == null) return LAYOUT_DEFAULTS.workspacesRailWidthPx
    const n = Number(raw)
    if (!Number.isFinite(n)) return LAYOUT_DEFAULTS.workspacesRailWidthPx
    return Math.min(
      LAYOUT_DEFAULTS.workspacesRailMaxPx,
      Math.max(LAYOUT_DEFAULTS.workspacesRailMinPx, Math.round(n)),
    )
  } catch {
    return LAYOUT_DEFAULTS.workspacesRailWidthPx
  }
}

export function readPersistedAgentTerminalFraction(): number {
  try {
    const raw = localStorage.getItem(LAYOUT_KEYS.agentTerminalSplit)
    if (raw == null) return LAYOUT_DEFAULTS.agentTerminalFraction
    const n = Number(raw)
    if (!Number.isFinite(n)) return LAYOUT_DEFAULTS.agentTerminalFraction
    return Math.min(
      LAYOUT_DEFAULTS.agentTerminalFractionMax,
      Math.max(LAYOUT_DEFAULTS.agentTerminalFractionMin, n),
    )
  } catch {
    return LAYOUT_DEFAULTS.agentTerminalFraction
  }
}

/** Git History panel: three-section flex ratios + which panes are collapsed (like the terminal strip). */
export type GitGraphPanelPersisted = {
  fracs: [number, number, number]
  collapsedCommit: boolean
  collapsedDiff: boolean
}

/** Default flex ratios (same as former flex-1 : flex-[1.15] : flex-[1.25]). */
export const GIT_GRAPH_PANEL_DEFAULT_FRACS: [number, number, number] = [
  1 / 3.4,
  1.15 / 3.4,
  1.25 / 3.4,
]

const GIT_GRAPH_DEFAULT: GitGraphPanelPersisted = {
  fracs: GIT_GRAPH_PANEL_DEFAULT_FRACS,
  collapsedCommit: false,
  collapsedDiff: false,
}

function isValidFracTriple(v: unknown): v is [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3) return false
  const [a, b, c] = v
  if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number') return false
  if (![a, b, c].every((n) => Number.isFinite(n) && n > 0)) return false
  const sum = a + b + c
  return sum > 0.99 && sum < 1.01
}

export function readPersistedGitGraphPanelLayout(): GitGraphPanelPersisted {
  try {
    const raw = localStorage.getItem(LAYOUT_KEYS.gitGraphPanelLayout)
    if (raw == null) return GIT_GRAPH_DEFAULT
    const p = JSON.parse(raw) as Record<string, unknown>
    const fracs = p.fracs
    if (!isValidFracTriple(fracs)) return GIT_GRAPH_DEFAULT
    return {
      fracs,
      collapsedCommit: p.collapsedCommit === true,
      collapsedDiff: p.collapsedDiff === true,
    }
  } catch {
    return GIT_GRAPH_DEFAULT
  }
}

export function readPersistedSidePanelWidth(): number {
  for (const key of [LAYOUT_KEYS.sidePanel, LAYOUT_KEYS.sidePanelLegacy] as const) {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      return Math.min(
        LAYOUT_DEFAULTS.sidePanelMaxPx,
        Math.max(LAYOUT_DEFAULTS.sidePanelMinPx, Math.round(n)),
      )
    } catch {
      /* continue */
    }
  }
  return LAYOUT_DEFAULTS.sidePanelWidthPx
}

function hasStoredValue(key: string): boolean {
  try {
    return localStorage.getItem(key) != null
  } catch {
    return false
  }
}

export type PersistedLayoutSnapshot = {
  workspacesRailWidthPx: number
  workspacesRailIsCustom: boolean
  agentTerminalFraction: number
  agentTerminalIsCustom: boolean
  sidePanelWidthPx: number
  sidePanelIsCustom: boolean
}

export function readPersistedLayoutSnapshot(): PersistedLayoutSnapshot {
  return {
    workspacesRailWidthPx: readPersistedWorkspacesRailWidth(),
    workspacesRailIsCustom: hasStoredValue(LAYOUT_KEYS.workspacesRail),
    agentTerminalFraction: readPersistedAgentTerminalFraction(),
    agentTerminalIsCustom: hasStoredValue(LAYOUT_KEYS.agentTerminalSplit),
    sidePanelWidthPx: readPersistedSidePanelWidth(),
    sidePanelIsCustom:
      hasStoredValue(LAYOUT_KEYS.sidePanel) || hasStoredValue(LAYOUT_KEYS.sidePanelLegacy),
  }
}

/** Remove all layout keys from localStorage (does not update React state — use reset event + store). */
export function clearPersistedLayoutStorage(): void {
  for (const key of Object.values(LAYOUT_KEYS)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

import Store from 'electron-store'

import {
  DEFAULT_CLAUDE_PERMISSION_MODE,
  isClaudePermissionMode,
  type ClaudePermissionMode,
} from './claude-session-path'

export type WorkspaceEntry = { id: string; path: string; label: string }

export type PersistedAgentTab = { id: string; label: string; agentPath?: string }

export type PersistedAgentBucket = {
  tabs: PersistedAgentTab[]
  activeTabId: string | null
}

/** OS toast + sound for agent complete / needs-input. Dock badge and in-app dots ignore these. */
export type AgentNotificationPrefs = {
  pushEnabled: boolean
  soundEnabled: boolean
}

export type TenxStoreSchema = {
  workspaces: WorkspaceEntry[]
  /** Agent tab rows per workspace id (renderer-owned shape, validated on read). */
  agentTabsByWorkspace: Record<string, PersistedAgentBucket>
  agentNotificationPrefs: AgentNotificationPrefs
  /** Autonomy level new Claude sessions launch with (`--permission-mode`). */
  claudePermissionMode: ClaudePermissionMode
}

export const DEFAULT_AGENT_NOTIFICATION_PREFS: AgentNotificationPrefs = {
  pushEnabled: true,
  soundEnabled: true,
}

export const tenxStore = new Store<TenxStoreSchema>({
  defaults: {
    workspaces: [],
    agentTabsByWorkspace: {},
    agentNotificationPrefs: { ...DEFAULT_AGENT_NOTIFICATION_PREFS },
    claudePermissionMode: DEFAULT_CLAUDE_PERMISSION_MODE,
  },
})

function coerceBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === false) return value
  return fallback
}

/** Normalized prefs for main + renderer; survives missing keys and non-boolean junk in the JSON file. */
export function readAgentNotificationPrefs(): AgentNotificationPrefs {
  const raw = tenxStore.get('agentNotificationPrefs') as unknown
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_AGENT_NOTIFICATION_PREFS }
  }
  const o = raw as Record<string, unknown>
  return {
    pushEnabled: coerceBool(o.pushEnabled, DEFAULT_AGENT_NOTIFICATION_PREFS.pushEnabled),
    soundEnabled: coerceBool(o.soundEnabled, DEFAULT_AGENT_NOTIFICATION_PREFS.soundEnabled),
  }
}

export function writeAgentNotificationPrefs(prefs: AgentNotificationPrefs): AgentNotificationPrefs {
  const normalized: AgentNotificationPrefs = {
    pushEnabled: Boolean(prefs.pushEnabled),
    soundEnabled: Boolean(prefs.soundEnabled),
  }
  tenxStore.set('agentNotificationPrefs', normalized)
  return normalized
}

/** Persisted autonomy level; falls back to the default for missing/garbage values. */
export function readClaudePermissionMode(): ClaudePermissionMode {
  const raw = tenxStore.get('claudePermissionMode') as unknown
  return isClaudePermissionMode(raw) ? raw : DEFAULT_CLAUDE_PERMISSION_MODE
}

export function writeClaudePermissionMode(mode: ClaudePermissionMode): ClaudePermissionMode {
  const normalized = isClaudePermissionMode(mode) ? mode : DEFAULT_CLAUDE_PERMISSION_MODE
  tenxStore.set('claudePermissionMode', normalized)
  return normalized
}

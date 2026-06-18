import Store from 'electron-store'

import {
  DEFAULT_CLAUDE_PERMISSION_MODE,
  isClaudePermissionMode,
  type ClaudePermissionMode,
} from './claude-session-path'
import {
  defaultUiColorMode,
  isUiColorMode,
  type UiColorMode,
} from './native-chrome-theme'
import {
  coerceTerminalShellPreference,
  defaultTerminalShellPreference,
  isTerminalShellPreference,
  type TerminalShellPreference,
} from './terminal-shell'

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

/**
 * A phone paired to the remote-control bridge. Only the SHA-256 hash of the
 * bearer token is stored — never the token itself — so a leaked config file
 * cannot be replayed against the bridge.
 */
export type PairedDevice = {
  id: string
  name: string
  tokenHash: string
  createdAt: number
  lastSeenAt: number | null
  /** Expo push token for background agent notifications (Phase 5). */
  pushToken?: string
}

export type RemoteControlConfig = {
  enabled: boolean
  devices: PairedDevice[]
}

export type TenxStoreSchema = {
  workspaces: WorkspaceEntry[]
  /** Agent tab rows per workspace id (renderer-owned shape, validated on read). */
  agentTabsByWorkspace: Record<string, PersistedAgentBucket>
  agentNotificationPrefs: AgentNotificationPrefs
  /** Autonomy level new Claude sessions launch with (`--permission-mode`). */
  claudePermissionMode: ClaudePermissionMode
  /** Preferred shell for new terminal tabs (and Claude on Windows when POSIX). */
  terminalShellPreference: TerminalShellPreference
  /** Light/dark/system for native window chrome (title bar, menu bar). */
  uiColorMode: UiColorMode
  /** Remote-control bridge state: enabled flag + paired phones (hashed tokens). */
  remoteControl: RemoteControlConfig
}

export const DEFAULT_REMOTE_CONTROL_CONFIG: RemoteControlConfig = {
  enabled: false,
  devices: [],
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
    terminalShellPreference: defaultTerminalShellPreference(),
    uiColorMode: defaultUiColorMode(),
    remoteControl: { ...DEFAULT_REMOTE_CONTROL_CONFIG, devices: [] },
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

export function readTerminalShellPreference(): TerminalShellPreference {
  const raw = tenxStore.get('terminalShellPreference') as unknown
  const preference = isTerminalShellPreference(raw) ? raw : defaultTerminalShellPreference()
  const coerced = coerceTerminalShellPreference(preference)
  if (coerced !== preference) {
    tenxStore.set('terminalShellPreference', coerced)
  }
  return coerced
}

export function writeTerminalShellPreference(
  preference: TerminalShellPreference,
): TerminalShellPreference {
  const normalized = isTerminalShellPreference(preference)
    ? preference
    : defaultTerminalShellPreference()
  tenxStore.set('terminalShellPreference', normalized)
  return normalized
}

export function readUiColorMode(): UiColorMode {
  const raw = tenxStore.get('uiColorMode') as unknown
  return isUiColorMode(raw) ? raw : defaultUiColorMode()
}

export function writeUiColorMode(mode: UiColorMode): UiColorMode {
  const normalized = isUiColorMode(mode) ? mode : defaultUiColorMode()
  tenxStore.set('uiColorMode', normalized)
  return normalized
}

function isPairedDevice(value: unknown): value is PairedDevice {
  if (value == null || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.tokenHash === 'string' &&
    typeof o.createdAt === 'number'
  )
}

/** Normalized remote-control config; survives missing keys / garbage in the JSON file. */
export function readRemoteControlConfig(): RemoteControlConfig {
  const raw = tenxStore.get('remoteControl') as unknown
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_REMOTE_CONTROL_CONFIG, devices: [] }
  }
  const o = raw as Record<string, unknown>
  const devices = Array.isArray(o.devices) ? o.devices.filter(isPairedDevice) : []
  return {
    enabled: coerceBool(o.enabled, false),
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      tokenHash: d.tokenHash,
      createdAt: d.createdAt,
      lastSeenAt: typeof d.lastSeenAt === 'number' ? d.lastSeenAt : null,
      ...(typeof d.pushToken === 'string' ? { pushToken: d.pushToken } : {}),
    })),
  }
}

export function writeRemoteControlConfig(config: RemoteControlConfig): RemoteControlConfig {
  const normalized: RemoteControlConfig = {
    enabled: Boolean(config.enabled),
    devices: config.devices.filter(isPairedDevice),
  }
  tenxStore.set('remoteControl', normalized)
  return normalized
}

/** Persist a newly paired device, replacing any existing entry with the same id. */
export function addPairedDevice(device: PairedDevice): RemoteControlConfig {
  const current = readRemoteControlConfig()
  const devices = [...current.devices.filter((d) => d.id !== device.id), device]
  return writeRemoteControlConfig({ ...current, devices })
}

export function removePairedDevice(deviceId: string): RemoteControlConfig {
  const current = readRemoteControlConfig()
  return writeRemoteControlConfig({
    ...current,
    devices: current.devices.filter((d) => d.id !== deviceId),
  })
}

/** Record that a device just authenticated (for the "last seen" column). */
export function touchPairedDevice(deviceId: string, at: number): void {
  const current = readRemoteControlConfig()
  let changed = false
  const devices = current.devices.map((d) => {
    if (d.id !== deviceId) return d
    changed = true
    return { ...d, lastSeenAt: at }
  })
  if (changed) writeRemoteControlConfig({ ...current, devices })
}

export function setRemoteControlEnabled(enabled: boolean): RemoteControlConfig {
  const current = readRemoteControlConfig()
  return writeRemoteControlConfig({ ...current, enabled })
}

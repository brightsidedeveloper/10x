import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bell, Bot, Github, Keyboard, PanelLeft, Palette, Settings } from 'lucide-react'

import { AppearanceSettingsPanel } from '@/features/settings/settings-panels/appearance-settings-panel'
import { ClaudeSettingsPanel } from '@/features/settings/settings-panels/claude-settings-panel'
import { GeneralSettingsPanel } from '@/features/settings/settings-panels/general-settings-panel'
import { GithubSettingsPanel } from '@/features/settings/settings-panels/github-settings-panel'
import { KeyboardShortcutsSettingsPanel } from '@/features/settings/settings-panels/keyboard-shortcuts-settings-panel'
import { LayoutSettingsPanel } from '@/features/settings/settings-panels/layout-settings-panel'
import { NotificationsSettingsPanel } from '@/features/settings/settings-panels/notifications-settings-panel'

export type SettingsSectionId =
  | 'general'
  | 'claude'
  | 'appearance'
  | 'notifications'
  | 'layout'
  | 'github'
  | 'keyboard'

export type SettingsPanelProps = {
  /** Visible workspace checkout (Git menu / publish target). */
  gitCwd: string | null
}

export type SettingsSectionDefinition = {
  id: SettingsSectionId
  label: string
  icon: LucideIcon
  Panel: (props: SettingsPanelProps) => ReactNode
}

/**
 * Single registry for Settings sidebar + panels. Add entries here when new sections ship.
 */
export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  { id: 'general', label: 'General', icon: Settings, Panel: GeneralSettingsPanel },
  { id: 'claude', label: 'Claude', icon: Bot, Panel: ClaudeSettingsPanel },
  { id: 'appearance', label: 'Appearance', icon: Palette, Panel: AppearanceSettingsPanel },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    Panel: NotificationsSettingsPanel,
  },
  { id: 'layout', label: 'Layout', icon: PanelLeft, Panel: LayoutSettingsPanel },
  { id: 'github', label: 'GitHub', icon: Github, Panel: GithubSettingsPanel },
  {
    id: 'keyboard',
    label: 'Keyboard',
    icon: Keyboard,
    Panel: KeyboardShortcutsSettingsPanel,
  },
]

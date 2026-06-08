/**
 * Renderer-side mirror of the main process `ClaudePermissionMode` (electron/main/claude-session-path.ts).
 * Each value maps 1:1 to the Claude Code CLI's `--permission-mode`; `'default'` adds no flag.
 */
export type ClaudePermissionMode = 'bypassPermissions' | 'acceptEdits' | 'plan' | 'default'

export const DEFAULT_CLAUDE_PERMISSION_MODE: ClaudePermissionMode = 'bypassPermissions'

export type ClaudePermissionModeOption = {
  mode: ClaudePermissionMode
  title: string
  description: string
}

/** Display order for the Settings picker — most autonomous first. */
export const CLAUDE_PERMISSION_MODE_OPTIONS: readonly ClaudePermissionModeOption[] = [
  {
    mode: 'bypassPermissions',
    title: 'Bypass all',
    description:
      'Claude never pauses for approval — it runs edits and shell commands on its own. Fully hands-off, with no safety gate.',
  },
  {
    mode: 'acceptEdits',
    title: 'Accept edits',
    description:
      'Auto-accepts file edits, but still asks before running shell commands. A safer middle ground.',
  },
  {
    mode: 'plan',
    title: 'Plan mode',
    description:
      'Claude researches and proposes a plan without making any changes until you approve it.',
  },
  {
    mode: 'default',
    title: 'Ask every time',
    description: "Claude's standard behavior — it prompts for permission before edits and commands.",
  },
]

/**
 * Renderer-side mirror of the main process `ClaudePermissionMode` (electron/main/claude-session-path.ts).
 * Each value maps 1:1 to the Claude Code CLI's `--permission-mode`; `'default'` adds no flag.
 */
export type ClaudePermissionMode = 'auto' | 'acceptEdits' | 'plan' | 'default'

export const DEFAULT_CLAUDE_PERMISSION_MODE: ClaudePermissionMode = 'auto'

export type ClaudePermissionModeOption = {
  mode: ClaudePermissionMode
  title: string
  description: string
}

/** Display order for the Settings picker. */
export const CLAUDE_PERMISSION_MODE_OPTIONS: readonly ClaudePermissionModeOption[] = [
  {
    mode: 'auto',
    title: 'Auto',
    description:
      'Claude works on its own, auto-approving routine actions and only pausing for ones that are genuinely risky. The recommended hands-off default.',
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

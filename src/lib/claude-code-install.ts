/** Anthropic’s Claude Code CLI install / docs (shared by empty states and terminal hints). */
export const CLAUDE_CODE_INSTALL_URL = 'https://docs.anthropic.com/claude-code'

/** macOS, Linux, WSL, and Git Bash on Windows. */
export const CLAUDE_CODE_INSTALL_POSIX_COMMAND =
  'curl -fsSL https://claude.ai/install.sh | bash'

/** Windows PowerShell / PowerShell 7+. */
export const CLAUDE_CODE_INSTALL_POWERSHELL_COMMAND =
  'irm https://claude.ai/install.ps1 | iex'

/** Windows Command Prompt. */
export const CLAUDE_CODE_INSTALL_CMD_COMMAND =
  'curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd'

/** @deprecated Use {@link window.mux.claudeCode.getInstallCommand} for the active shell. */
export const CLAUDE_CODE_INSTALL_SHELL_COMMAND = CLAUDE_CODE_INSTALL_POSIX_COMMAND

export type ClaudeCodeInstallKind = 'posix' | 'windows-powershell' | 'windows-cmd'

export type ClaudeCodeInstallInfo = {
  command: string
  kind: ClaudeCodeInstallKind
  shellLabel: string
  isWindows: boolean
}

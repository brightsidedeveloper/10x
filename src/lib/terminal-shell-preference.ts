export type TerminalShellPreference =
  | 'default'
  | 'git-bash'
  | 'powershell'
  | 'pwsh'
  | 'cmd'
  | 'zsh'
  | 'bash'
  | 'fish'

export type TerminalShellOption = {
  id: TerminalShellPreference
  label: string
  description: string
  available: boolean
  resolvedPath: string | null
}

export type TerminalShellOptionsSnapshot = {
  preference: TerminalShellPreference
  resolvedPath: string | null
  resolvedLabel: string | null
  options: TerminalShellOption[]
}

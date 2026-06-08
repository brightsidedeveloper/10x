import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import fixPath from 'fix-path'

export type TerminalShellPreference =
  | 'default'
  | 'git-bash'
  | 'powershell'
  | 'pwsh'
  | 'cmd'
  | 'zsh'
  | 'bash'
  | 'fish'

export type TerminalShellKind = 'posix' | 'powershell' | 'pwsh' | 'cmd'

export type PosixShellKind = 'fish' | 'zsh' | 'bash' | 'sh'

export type ResolvedTerminalShell = {
  path: string
  kind: TerminalShellKind
  posixKind?: PosixShellKind
  label: string
}

export type TerminalShellOption = {
  id: TerminalShellPreference
  label: string
  description: string
  available: boolean
  resolvedPath: string | null
}

const WINDOWS_PREFS = new Set<TerminalShellPreference>([
  'default',
  'git-bash',
  'powershell',
  'pwsh',
  'cmd',
])

const POSIX_PREFS = new Set<TerminalShellPreference>(['default', 'zsh', 'bash', 'fish'])

export function isTerminalShellPreference(value: unknown): value is TerminalShellPreference {
  return (
    value === 'default' ||
    value === 'git-bash' ||
    value === 'powershell' ||
    value === 'pwsh' ||
    value === 'cmd' ||
    value === 'zsh' ||
    value === 'bash' ||
    value === 'fish'
  )
}

export function defaultTerminalShellPreference(): TerminalShellPreference {
  return 'default'
}

function classifyPosixShell(shellPath: string): PosixShellKind | null {
  const shellName = path.basename(shellPath).toLowerCase()
  if (shellName === 'fish') return 'fish'
  if (shellName === 'zsh') return 'zsh'
  if (shellName === 'bash' || shellName === 'bash.exe') return 'bash'
  if (shellName === 'sh' || shellName === 'dash') return 'sh'
  return null
}

function firstWhereExecutable(command: string): string | null {
  try {
    fixPath()
    const out = execFileSync('where', [command], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8_000,
    }).trim()
    const first = out.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim()
    if (first && existsSync(first)) return first
  } catch {
    /* not on PATH */
  }
  return null
}

export function detectGitBashPath(): string | null {
  const candidates = [
    path.join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Git',
      'bin',
      'bash.exe',
    ),
    path.join(os.homedir(), 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return firstWhereExecutable('bash')
}

function detectPowerShellPath(): string | null {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const winPs = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  if (existsSync(winPs)) return winPs
  return firstWhereExecutable('powershell')
}

function detectPwshPath(): string | null {
  return firstWhereExecutable('pwsh')
}

function detectCmdPath(): string {
  const comspec = process.env.COMSPEC
  if (comspec && existsSync(comspec)) return comspec
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe')
}

function posixCandidates(kind: Exclude<TerminalShellPreference, 'default' | 'git-bash' | 'powershell' | 'pwsh' | 'cmd'>): string[] {
  if (kind === 'zsh') {
    return [process.env.SHELL, '/bin/zsh', '/usr/local/bin/zsh', '/opt/homebrew/bin/zsh'].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    )
  }
  if (kind === 'bash') {
    return [process.env.SHELL, '/bin/bash', '/usr/local/bin/bash', '/opt/homebrew/bin/bash'].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    )
  }
  return [process.env.SHELL, '/usr/local/bin/fish', '/opt/homebrew/bin/fish', '/bin/fish'].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  )
}

function resolvePosixByPreference(preference: TerminalShellPreference): ResolvedTerminalShell | null {
  if (
    preference === 'default' ||
    preference === 'git-bash' ||
    preference === 'powershell' ||
    preference === 'pwsh' ||
    preference === 'cmd'
  ) {
    return null
  }
  for (const candidate of posixCandidates(preference)) {
    if (!existsSync(candidate)) continue
    const posixKind = classifyPosixShell(candidate)
    if (!posixKind) continue
    if (preference === 'zsh' && posixKind !== 'zsh') continue
    if (preference === 'bash' && posixKind !== 'bash') continue
    if (preference === 'fish' && posixKind !== 'fish') continue
    return {
      path: candidate,
      kind: 'posix',
      posixKind,
      label: path.basename(candidate),
    }
  }
  return null
}

/** PowerShell-first fallback when Git Bash (or another explicit POSIX choice) is unavailable. */
function resolveWindowsNonPosixFallback(): ResolvedTerminalShell {
  const powershell = detectPowerShellPath()
  if (powershell) {
    return { path: powershell, kind: 'powershell', label: 'PowerShell' }
  }
  const pwsh = detectPwshPath()
  if (pwsh) {
    return { path: pwsh, kind: 'pwsh', label: 'PowerShell 7+' }
  }
  const cmd = detectCmdPath()
  return { path: cmd, kind: 'cmd', label: 'Command Prompt' }
}

export function resolveWindowsDefault(): ResolvedTerminalShell {
  const gitBash = detectGitBashPath()
  if (gitBash) {
    return { path: gitBash, kind: 'posix', posixKind: 'bash', label: 'Git Bash' }
  }
  return resolveWindowsNonPosixFallback()
}

function resolveWindowsByPreference(preference: TerminalShellPreference): ResolvedTerminalShell | null {
  if (preference === 'default') return resolveWindowsDefault()
  if (preference === 'git-bash') {
    const gitBash = detectGitBashPath()
    return gitBash
      ? { path: gitBash, kind: 'posix', posixKind: 'bash', label: 'Git Bash' }
      : null
  }
  if (preference === 'pwsh') {
    const pwsh = detectPwshPath()
    return pwsh ? { path: pwsh, kind: 'pwsh', label: 'PowerShell 7+' } : null
  }
  if (preference === 'powershell') {
    const powershell = detectPowerShellPath()
    return powershell ? { path: powershell, kind: 'powershell', label: 'PowerShell' } : null
  }
  if (preference === 'cmd') {
    const cmd = detectCmdPath()
    return { path: cmd, kind: 'cmd', label: 'Command Prompt' }
  }
  return null
}

export function resolveTerminalShell(preference: TerminalShellPreference): ResolvedTerminalShell | null {
  if (process.platform === 'win32') {
    const normalized = WINDOWS_PREFS.has(preference) ? preference : 'default'
    return resolveWindowsByPreference(normalized) ?? resolveWindowsNonPosixFallback()
  }
  if (!POSIX_PREFS.has(preference)) return null
  if (preference !== 'default') return resolvePosixByPreference(preference)
  return null
}

export function shellCommandArgs(shell: ResolvedTerminalShell, command: string): string[] {
  if (shell.kind === 'posix' && shell.posixKind) {
    if (shell.posixKind === 'fish') return ['-lic', command]
    if (shell.posixKind === 'zsh' || shell.posixKind === 'bash') return ['-ilc', command]
    return ['-c', command]
  }
  if (shell.kind === 'powershell' || shell.kind === 'pwsh') {
    return ['-NoLogo', '-Command', command]
  }
  return ['/c', command]
}

export function interactiveShellArgs(shell: ResolvedTerminalShell): string[] {
  if (shell.kind === 'posix' && shell.posixKind) {
    if (shell.posixKind === 'fish' || shell.posixKind === 'zsh' || shell.posixKind === 'bash') {
      return ['-l']
    }
    return []
  }
  if (shell.kind === 'powershell' || shell.kind === 'pwsh') {
    return ['-NoLogo']
  }
  return []
}

export function listTerminalShellOptions(
  preference: TerminalShellPreference,
): { preference: TerminalShellPreference; resolved: ResolvedTerminalShell | null; options: TerminalShellOption[] } {
  if (process.platform === 'win32') {
    const defs: Array<{ id: TerminalShellPreference; label: string; description: string }> = [
      {
        id: 'default',
        label: 'Automatic',
        description: 'Git Bash when installed, otherwise PowerShell.',
      },
      { id: 'git-bash', label: 'Git Bash', description: 'Recommended for Git and Unix-style tooling.' },
      { id: 'pwsh', label: 'PowerShell 7+', description: 'Modern PowerShell if installed.' },
      { id: 'powershell', label: 'PowerShell', description: 'Windows PowerShell 5.x.' },
      { id: 'cmd', label: 'Command Prompt', description: 'Classic cmd.exe.' },
    ]
    const options = defs.map((d) => {
      let available = true
      let resolvedPath: string | null = null
      if (d.id === 'default') {
        resolvedPath = resolveWindowsDefault().path
      } else if (d.id === 'git-bash') {
        resolvedPath = detectGitBashPath()
        available = resolvedPath != null
      } else if (d.id === 'pwsh') {
        resolvedPath = detectPwshPath()
        available = resolvedPath != null
      } else if (d.id === 'powershell') {
        resolvedPath = detectPowerShellPath()
        available = resolvedPath != null
      } else if (d.id === 'cmd') {
        resolvedPath = detectCmdPath()
      }
      return {
        id: d.id,
        label: d.label,
        description: d.description,
        available,
        resolvedPath,
      }
    })
    const resolved = resolveTerminalShell(preference)
    return { preference, resolved, options }
  }

  const defs: Array<{ id: TerminalShellPreference; label: string; description: string }> = [
    {
      id: 'default',
      label: 'System default',
      description: 'Uses $SHELL from your environment.',
    },
    { id: 'zsh', label: 'zsh', description: 'Force zsh for new terminal tabs.' },
    { id: 'bash', label: 'bash', description: 'Force bash for new terminal tabs.' },
    { id: 'fish', label: 'fish', description: 'Force fish for new terminal tabs.' },
  ]
  const options = defs.map((d) => {
    if (d.id === 'default') {
      const shellPath = process.env.SHELL
      return {
        id: d.id,
        label: d.label,
        description: d.description,
        available: true,
        resolvedPath: shellPath && existsSync(shellPath) ? shellPath : null,
      }
    }
    const resolved = resolvePosixByPreference(d.id)
    return {
      id: d.id,
      label: d.label,
      description: d.description,
      available: resolved != null,
      resolvedPath: resolved?.path ?? null,
    }
  })
  const resolved = resolveTerminalShell(preference)
  return { preference, resolved, options }
}

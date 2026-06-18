import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import fixPath from 'fix-path'

import { bridge } from './ipc-bridge'

import { readTerminalShellPreference } from './persisted-store'
import { resolveTerminalShell, resolveWindowsDefault } from './terminal-shell'

const PROBE_TIMEOUT_MS = 12_000

/**
 * Whether the Claude Code CLI (`claude`) is available with the same PATH rules GUI apps use
 * after `fix-path` (macOS), plus the standard native-installer location.
 */
export function isClaudeCodeCliInstalled(): boolean {
  try {
    fixPath()
  } catch {
    /* fix-path can throw in minimal environments */
  }

  const home = os.homedir()
  const localInstaller =
    process.platform === 'win32'
      ? path.join(home, '.local', 'bin', 'claude.exe')
      : path.join(home, '.local', 'bin', 'claude')
  if (existsSync(localInstaller)) {
    return true
  }

  try {
    if (process.platform === 'win32') {
      const comspec = process.env.ComSpec || 'cmd.exe'
      execFileSync(comspec, ['/d', '/s', '/c', 'where claude'], {
        stdio: 'ignore',
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
        env: process.env,
      })
    } else {
      execFileSync('/bin/sh', ['-c', 'command -v claude'], {
        stdio: 'ignore',
        timeout: PROBE_TIMEOUT_MS,
        env: process.env,
      })
    }
    return true
  } catch {
    return false
  }
}

export type ClaudeCodeInstallKind = 'posix' | 'windows-powershell' | 'windows-cmd'

/** Native Windows Git Bash still uses the PowerShell installer (`install.sh` is macOS/Linux/WSL only). */
const CLAUDE_CODE_INSTALL_POWERSHELL_COMMAND = 'irm https://claude.ai/install.ps1 | iex'

const CLAUDE_CODE_INSTALL_FROM_GIT_BASH_COMMAND =
  'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"'

export function claudeCodeInstallInfo(): {
  command: string
  kind: ClaudeCodeInstallKind
  shellLabel: string
  isWindows: boolean
} {
  if (process.platform !== 'win32') {
    return {
      command: 'curl -fsSL https://claude.ai/install.sh | bash',
      kind: 'posix',
      shellLabel: 'bash',
      isWindows: false,
    }
  }

  const shell = resolveTerminalShell(readTerminalShellPreference()) ?? resolveWindowsDefault()
  const runsInPowerShell = shell.kind === 'powershell' || shell.kind === 'pwsh'
  return {
    command: runsInPowerShell
      ? CLAUDE_CODE_INSTALL_POWERSHELL_COMMAND
      : CLAUDE_CODE_INSTALL_FROM_GIT_BASH_COMMAND,
    kind: 'windows-powershell',
    shellLabel: runsInPowerShell ? shell.label : 'PowerShell',
    isWindows: true,
  }
}

export function registerClaudeCodeCliIpc() {
  bridge.handle('claudeCode:isCliInstalled', () => isClaudeCodeCliInstalled())
  bridge.handle('claudeCode:getInstallCommand', () => claudeCodeInstallInfo())
}

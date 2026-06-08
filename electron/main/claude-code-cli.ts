import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ipcMain } from 'electron'

import fixPath from 'fix-path'

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
  if (shell.kind === 'posix') {
    return {
      command: 'curl -fsSL https://claude.ai/install.sh | bash',
      kind: 'posix',
      shellLabel: shell.label,
      isWindows: true,
    }
  }
  if (shell.kind === 'cmd') {
    return {
      command:
        'curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd',
      kind: 'windows-cmd',
      shellLabel: 'Command Prompt',
      isWindows: true,
    }
  }
  return {
    command: 'irm https://claude.ai/install.ps1 | iex',
    kind: 'windows-powershell',
    shellLabel: shell.label,
    isWindows: true,
  }
}

export function registerClaudeCodeCliIpc() {
  ipcMain.handle('claudeCode:isCliInstalled', () => isClaudeCodeCliInstalled())
  ipcMain.handle('claudeCode:getInstallCommand', () => claudeCodeInstallInfo())
}

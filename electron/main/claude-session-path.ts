import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Claude Code encodes project cwd as the absolute path with `/` replaced by `-`. */
export function encodeClaudeProjectDir(cwd: string): string {
  return path.resolve(cwd).replace(/\//g, '-')
}

export function claudeSessionJsonlPath(cwd: string, sessionId: string): string {
  const projectDir = encodeClaudeProjectDir(cwd)
  return path.join(os.homedir(), '.claude', 'projects', projectDir, `${sessionId}.jsonl`)
}

export function isValidClaudeSessionId(sessionId: string): boolean {
  return UUID_RE.test(sessionId.trim())
}

export function claudeSessionExistsOnDisk(cwd: string, sessionId: string): boolean {
  if (!isValidClaudeSessionId(sessionId)) return false
  return existsSync(claudeSessionJsonlPath(cwd, sessionId))
}

/** Safe single-quoted string for login-shell `-c` / `-lic` commands. */
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * How much autonomy a Claude session launches with. Maps 1:1 to the CLI's `--permission-mode`
 * values; `'default'` adds no flag (Claude prompts as usual). `'bypassPermissions'` is the
 * "automode" default — Claude never pauses for approval.
 */
export type ClaudePermissionMode = 'bypassPermissions' | 'acceptEdits' | 'plan' | 'default'

export const DEFAULT_CLAUDE_PERMISSION_MODE: ClaudePermissionMode = 'acceptEdits'

export function isClaudePermissionMode(value: unknown): value is ClaudePermissionMode {
  return (
    value === 'bypassPermissions' ||
    value === 'acceptEdits' ||
    value === 'plan' ||
    value === 'default'
  )
}

/** Trailing `--permission-mode <mode>` for shell exec, or `''` for the prompting default. */
function claudePermissionFlag(mode: ClaudePermissionMode | undefined): string {
  if (mode == null || mode === 'default') return ''
  return `--permission-mode ${mode}`
}

/** argv form of {@link claudePermissionFlag} for `pty.spawn('claude', args)`. */
function claudePermissionArgv(mode: ClaudePermissionMode | undefined): string[] {
  if (mode == null || mode === 'default') return []
  return ['--permission-mode', mode]
}

export function buildClaudeExecCommand(opts: {
  cwd: string
  sessionId?: string
  permissionMode?: ClaudePermissionMode
}): string {
  const plan = planClaudeSpawn(opts)
  const flag = claudePermissionFlag(opts.permissionMode)
  const suffix = flag ? ` ${flag}` : ''
  if (plan.mode === 'default') return `exec claude${suffix}`
  if (plan.mode === 'resume') return `exec claude --resume ${shellSingleQuote(plan.sessionId)}${suffix}`
  return `exec claude --session-id ${shellSingleQuote(plan.sessionId)}${suffix}`
}

export type ClaudeSpawnPlan =
  | { mode: 'default' }
  | { mode: 'new'; sessionId: string }
  | { mode: 'resume'; sessionId: string }

export function planClaudeSpawn(opts: {
  cwd: string
  sessionId?: string
}): ClaudeSpawnPlan {
  const sessionId = opts.sessionId?.trim()
  if (sessionId == null || !isValidClaudeSessionId(sessionId)) {
    return { mode: 'default' }
  }
  if (claudeSessionExistsOnDisk(opts.cwd, sessionId)) {
    return { mode: 'resume', sessionId }
  }
  return { mode: 'new', sessionId }
}

/** argv for `pty.spawn('claude', args)` on Windows. */
export function claudeCliArgv(plan: ClaudeSpawnPlan, permissionMode?: ClaudePermissionMode): string[] {
  const base =
    plan.mode === 'default'
      ? []
      : plan.mode === 'resume'
        ? ['--resume', plan.sessionId]
        : ['--session-id', plan.sessionId]
  return [...base, ...claudePermissionArgv(permissionMode)]
}

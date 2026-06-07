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

export function buildClaudeExecCommand(opts: {
  cwd: string
  sessionId: string
}): string {
  const plan = planClaudeSpawn(opts)
  if (plan.mode === 'default') return 'exec claude'
  if (plan.mode === 'resume') return `exec claude --resume ${shellSingleQuote(plan.sessionId)}`
  return `exec claude --session-id ${shellSingleQuote(plan.sessionId)}`
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
export function claudeCliArgv(plan: ClaudeSpawnPlan): string[] {
  if (plan.mode === 'default') return []
  if (plan.mode === 'resume') return ['--resume', plan.sessionId]
  return ['--session-id', plan.sessionId]
}

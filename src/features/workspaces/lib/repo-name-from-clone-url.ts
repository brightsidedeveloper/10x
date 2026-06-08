/** Derive a local folder name from a Git remote URL (https, ssh, or git@host:path). */
export function repoNameFromCloneUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  const withoutGit = trimmed.replace(/\.git$/i, '')
  const parts = withoutGit.split(/[/:]/)
  const last = parts[parts.length - 1]?.trim() ?? ''

  if (!last || /[\s/\\]/.test(last)) return 'repository'
  return last
}

const KEY = 'mux.cloneParentDir'

export function readCloneParentDir(): string | null {
  try {
    const v = localStorage.getItem(KEY)?.trim()
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

export function writeCloneParentDir(dir: string): void {
  try {
    localStorage.setItem(KEY, dir.trim())
  } catch {
    /* ignore */
  }
}

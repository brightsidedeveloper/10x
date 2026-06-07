let appQuitting = false

export function markAppQuitting(): void {
  appQuitting = true
}

export function isAppQuitting(): boolean {
  return appQuitting
}

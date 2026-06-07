const USER_ENDED_PREFIX = 'mux.agent-user-ended.'

function storageKey(workspaceId: string, tabId: string): string {
  return `${USER_ENDED_PREFIX}${workspaceId}:${tabId}`
}

/** True when the user Ctrl+C'd out during this app session (cleared when the app fully quits). */
export function readUserEndedAgentSession(workspaceId: string, tabId: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(workspaceId, tabId)) === '1'
  } catch {
    return false
  }
}

export function markUserEndedAgentSession(workspaceId: string, tabId: string): void {
  try {
    sessionStorage.setItem(storageKey(workspaceId, tabId), '1')
  } catch {
    /* private mode / quota */
  }
}

export function clearUserEndedAgentSession(workspaceId: string, tabId: string): void {
  try {
    sessionStorage.removeItem(storageKey(workspaceId, tabId))
  } catch {
    /* ignore */
  }
}

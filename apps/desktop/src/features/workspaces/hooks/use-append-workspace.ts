import { useCallback } from 'react'

import { workspaceLabelFromPath } from '@/features/workspaces/lib/label-from-path'
import { usePersistWorkspacesMutation } from '@/features/workspaces/hooks/use-workspaces'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function useAppendWorkspace() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()

  return useCallback(
    async (dir: string) => {
      const trimmed = dir.trim()
      if (!trimmed) return
      const next = [
        ...workspaces,
        {
          id: crypto.randomUUID(),
          path: trimmed,
          label: workspaceLabelFromPath(trimmed),
        },
      ]
      await persist.mutateAsync(next)
      setActiveWorkspaceId(next[next.length - 1]!.id)
    },
    [workspaces, persist, setActiveWorkspaceId],
  )
}

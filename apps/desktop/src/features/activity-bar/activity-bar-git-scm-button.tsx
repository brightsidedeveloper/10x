import { Button } from '@/components/ui/button'
import { activityBarIconButtonClass } from '@/features/activity-bar/activity-bar-icon-styles'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { useSidePanelStore } from '@/stores/side-panel-store'
import { GitBranch } from 'lucide-react'

/** Opens the Source control side panel (stage, commit, push); use ⋯ in the panel for more Git actions. */
export function ActivityBarGitScmButton() {
  const gitCwd = useGitCwdForVisibleWorkspace()
  const activePanel = useSidePanelStore((s) => s.active)
  const toggleSidePanel = useSidePanelStore((s) => s.toggle)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={activityBarIconButtonClass}
      title="Source control — changed files, stage, commit, push (⋯ for fetch, pull, publish, and more)"
      aria-label="Source control"
      aria-pressed={activePanel === 'git-scm'}
      disabled={!gitCwd}
      onClick={() => toggleSidePanel('git-scm')}
    >
      <GitBranch className="size-4" />
    </Button>
  )
}

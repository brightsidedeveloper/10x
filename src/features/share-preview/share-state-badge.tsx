import { Check, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ShareState = 'installing' | 'starting' | 'ready' | 'error' | 'closed'

const STATE_LABEL: Record<ShareState, string> = {
  installing: 'Installing…',
  starting: 'Starting…',
  ready: 'Live',
  error: 'Error',
  closed: 'Closed',
}

/** Small pill showing the lifecycle state of a shared tunnel or Expo session. */
export function ShareStateBadge({ state }: { state: ShareState }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        state === 'ready' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        (state === 'starting' || state === 'installing') && 'bg-muted text-muted-foreground',
        state === 'error' && 'bg-destructive/15 text-destructive',
        state === 'closed' && 'bg-muted text-muted-foreground',
      )}
    >
      {state === 'ready' && <Check className="size-3" />}
      {(state === 'starting' || state === 'installing') && (
        <Loader2 className="size-3 animate-spin" />
      )}
      {STATE_LABEL[state]}
    </span>
  )
}

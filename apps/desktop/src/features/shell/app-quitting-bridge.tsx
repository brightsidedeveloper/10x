import { useEffect } from 'react'

import { markAppQuitting } from '@/lib/app-quitting'

/** Ignore agent PTY exit events fired while the main process tears sessions down on quit. */
export function AppQuittingBridge() {
  useEffect(() => {
    return window.mux.app.onWillQuit(() => {
      markAppQuitting()
    })
  }, [])

  return null
}

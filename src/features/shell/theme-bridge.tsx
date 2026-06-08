import { useEffect } from 'react'

import { useThemeStore } from '@/stores/theme-store'

/** Hydrates theme from disk and listens for OS appearance changes (system mode). */
export function ThemeBridge() {
  const colorMode = useThemeStore((s) => s.colorMode)
  const hydrateFromDisk = useThemeStore((s) => s.hydrateFromDisk)

  useEffect(() => {
    hydrateFromDisk()
  }, [hydrateFromDisk])

  useEffect(() => {
    if (colorMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => hydrateFromDisk()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [colorMode, hydrateFromDisk])

  return null
}

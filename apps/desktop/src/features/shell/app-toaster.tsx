import { Toaster } from 'sonner'

import { useThemeStore } from '@/stores/theme-store'

export function AppToaster() {
  const resolvedScheme = useThemeStore((s) => s.resolvedScheme)

  return (
    <Toaster
      theme={resolvedScheme}
      position="bottom-right"
      closeButton={false}
      richColors={false}
      icons={{ info: null }}
      className="font-sans"
      toastOptions={{
        classNames: {
          toast: '!border-border !bg-card !text-card-foreground !shadow-lg',
          title: '!text-sm !font-semibold !text-foreground',
          description: '!text-[0.8125rem] !leading-snug !text-muted-foreground',
          content: '!flex !w-full !min-w-0 !flex-col !gap-0.5',
          actionButton:
            '!h-7 !rounded-[min(var(--radius-md),12px)] !px-2.5 !text-[0.8rem] !font-medium !shadow-none !border !border-border !bg-accent !text-accent-foreground hover:!bg-accent/85',
          cancelButton:
            '!h-7 !rounded-[min(var(--radius-md),12px)] !px-2.5 !text-[0.8rem] !font-medium !shadow-none !border !border-border !bg-input/30 !text-muted-foreground hover:!bg-input/50 hover:!text-foreground',
        },
      }}
    />
  )
}

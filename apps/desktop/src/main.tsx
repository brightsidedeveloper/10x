import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'

import { createQueryClient } from '@/lib/query-client'
import { applyTheme, readThemePrefs } from '@/lib/persisted-theme'
import { initAgentSessionNavigateBridge } from '@/features/shell/navigate-to-agent-session'
import { AppToaster } from '@/features/shell/app-toaster'
import { initAgentNotificationBridge } from '@/stores/agent-notification-store'
import { useThemeStore } from '@/stores/theme-store'

import App from '@/App'
import 'sonner/dist/styles.css'
import './index.css'

initAgentNotificationBridge()
initAgentSessionNavigateBridge()

const queryClient = createQueryClient()

const initialThemePrefs = readThemePrefs()
const initialScheme = applyTheme(initialThemePrefs)
useThemeStore.setState({
  colorMode: initialThemePrefs.colorMode,
  accent: initialThemePrefs.accent,
  resolvedScheme: initialScheme,
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <AppToaster />
  </QueryClientProvider>,
)

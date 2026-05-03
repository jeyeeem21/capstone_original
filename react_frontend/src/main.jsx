import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { OfflineProvider } from './pwa/OfflineContext.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA service worker (auto-update)
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <OfflineProvider>
        <App />
      </OfflineProvider>
    </ThemeProvider>
  </StrictMode>,
)

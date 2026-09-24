import { createRoot } from 'react-dom/client'
import './studio.css'
import { ThemeProvider } from '@/theme-provider'
import { PayloadProvider } from './payload-context'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <PayloadProvider>
      <App />
    </PayloadProvider>
  </ThemeProvider>,
)

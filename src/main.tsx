import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The ErrorBoundary now lives inside AppShell (on by default), so the root just
// mounts the app.
const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found in DOM')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

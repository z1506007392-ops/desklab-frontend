import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx'

// index.html already explained itself when the browser is too old.
if (!window.__DESKLAB_UNSUPPORTED__) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
}

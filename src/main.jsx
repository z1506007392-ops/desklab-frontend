import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx'
import { bootAppStorage } from './desktop/boot-storage.js'

// index.html already explained itself when the browser is too old.
// The desktop shell loads its files before the first paint. The web build
// leaves storage on localStorage.
async function start() {
  if (window.__DESKLAB_UNSUPPORTED__) return
  await bootAppStorage()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
}

start()

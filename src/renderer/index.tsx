import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { mockElectronAPI } from './dev-mock'

window.addEventListener('error', (e) => {
  console.error('GLOBAL ERROR:', e.message, e.filename, e.lineno)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED REJECTION:', e.reason)
})

if (!window.electronAPI) {
  ;(window as any).electronAPI = mockElectronAPI
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

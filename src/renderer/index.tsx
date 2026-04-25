import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { mockElectronAPI } from './dev-mock'

if (!window.electronAPI) {
  ;(window as any).electronAPI = mockElectronAPI
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

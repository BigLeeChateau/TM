import { app, BrowserWindow, ipcMain, nativeImage, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabase, closeDatabase } from './database'
import { registerIpcHandlers } from './ipc'

// Register app:// as a privileged scheme so localStorage and other web APIs work
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

let mainWindow: BrowserWindow | null = null

function getIcon() {
  const iconPath = path.join(__dirname, '../../build/icon.png')
  return nativeImage.createFromPath(iconPath)
}

function createWindow() {
  const icon = getIcon()
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (app.dock) {
    app.dock.setIcon(icon)
  }

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL('app://./index.html')
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Register custom protocol to serve renderer files over app://
// This avoids file:// protocol issues with ES module scripts
function registerAppProtocol() {
  const rendererDir = path.join(__dirname, '../renderer')

  protocol.handle('app', async (request) => {
    let pathname = new URL(request.url).pathname
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html'
    }
    // Security: prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.(\/|$))+/, '')
    const filePath = path.join(rendererDir, safePath)

    // Ensure the requested file is inside the renderer directory
    if (!filePath.startsWith(rendererDir)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const data = await fs.promises.readFile(filePath)
      const ext = path.extname(filePath)
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      return new Response(data, {
        headers: { 'Content-Type': contentType },
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })
}

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  registerAppProtocol()
  createWindow()

  app.on('activate', () => {
    if (mainWindow === null) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

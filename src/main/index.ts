import { app, BrowserWindow, ipcMain, nativeImage } from 'electron'
import path from 'path'
import { initDatabase, closeDatabase } from './database'
import { registerIpcHandlers } from './ipc'

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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (mainWindow === null) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

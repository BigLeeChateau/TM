"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const ipc_1 = require("./ipc");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            sandbox: false,
        },
    });
    const isDev = !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    (0, database_1.initDatabase)();
    (0, ipc_1.registerIpcHandlers)();
    createWindow();
    electron_1.app.on('activate', () => {
        if (mainWindow === null)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    (0, database_1.closeDatabase)();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});

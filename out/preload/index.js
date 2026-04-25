"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // Projects
    createProject: (data) => electron_1.ipcRenderer.invoke('createProject', data),
    updateProject: (id, data) => electron_1.ipcRenderer.invoke('updateProject', id, data),
    deleteProject: (id) => electron_1.ipcRenderer.invoke('deleteProject', id),
    listProjects: () => electron_1.ipcRenderer.invoke('listProjects'),
    // Tasks
    createTask: (data) => electron_1.ipcRenderer.invoke('createTask', data),
    updateTask: (id, data) => electron_1.ipcRenderer.invoke('updateTask', id, data),
    deleteTask: (id) => electron_1.ipcRenderer.invoke('deleteTask', id),
    listTasks: (projectId, status) => electron_1.ipcRenderer.invoke('listTasks', projectId, status),
    // Undo / Redo
    undo: () => electron_1.ipcRenderer.invoke('undo'),
    redo: () => electron_1.ipcRenderer.invoke('redo'),
    // Export
    exportData: () => electron_1.ipcRenderer.invoke('exportData'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);

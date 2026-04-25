import { contextBridge, ipcRenderer } from 'electron'
import type {
  Project,
  Task,
  TimeEntry,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '../shared/types'

const api = {
  // Projects
  createProject: (data: CreateProjectInput): Promise<Project> =>
    ipcRenderer.invoke('createProject', data),
  updateProject: (id: number, data: UpdateProjectInput): Promise<Project> =>
    ipcRenderer.invoke('updateProject', id, data),
  deleteProject: (id: number): Promise<void> =>
    ipcRenderer.invoke('deleteProject', id),
  listProjects: (): Promise<Project[]> =>
    ipcRenderer.invoke('listProjects'),

  // Tasks
  createTask: (data: CreateTaskInput): Promise<Task> =>
    ipcRenderer.invoke('createTask', data),
  updateTask: (id: number, data: UpdateTaskInput): Promise<Task> =>
    ipcRenderer.invoke('updateTask', id, data),
  deleteTask: (id: number): Promise<void> =>
    ipcRenderer.invoke('deleteTask', id),
  listTasks: (projectId?: number | null, status?: string): Promise<Task[]> =>
    ipcRenderer.invoke('listTasks', projectId, status),

  // Time tracking
  toggleTaskTimer: (taskId: number): Promise<Task> =>
    ipcRenderer.invoke('toggleTaskTimer', taskId),
  listTimeEntries: (taskId: number): Promise<TimeEntry[]> =>
    ipcRenderer.invoke('listTimeEntries', taskId),
  getProjectTimeSummary: (projectId: number): Promise<{ total_seconds: number }> =>
    ipcRenderer.invoke('getProjectTimeSummary', projectId),

  // Undo / Redo
  undo: (): Promise<{ success: boolean; task?: Task }> =>
    ipcRenderer.invoke('undo'),
  redo: (): Promise<{ success: boolean; task?: Task }> =>
    ipcRenderer.invoke('redo'),

  // Export
  exportData: (): Promise<{ projects: Project[]; tasks: Task[] }> =>
    ipcRenderer.invoke('exportData'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api

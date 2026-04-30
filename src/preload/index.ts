import { contextBridge, ipcRenderer } from 'electron'
import type {
  Tag,
  Task,
  TimeEntry,
  CreateTagInput,
  UpdateTagInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '../shared/types'

const api = {
  // Tags
  createTag: (data: CreateTagInput): Promise<Tag> =>
    ipcRenderer.invoke('createTag', data),
  updateTag: (id: number, data: UpdateTagInput): Promise<Tag> =>
    ipcRenderer.invoke('updateTag', id, data),
  deleteTag: (id: number): Promise<void> =>
    ipcRenderer.invoke('deleteTag', id),
  listTags: (): Promise<Tag[]> =>
    ipcRenderer.invoke('listTags'),

  // Task tag associations
  listTaskTags: (taskId: number): Promise<Tag[]> =>
    ipcRenderer.invoke('listTaskTags', taskId),
  setTaskTags: (taskId: number, tagIds: number[]): Promise<void> =>
    ipcRenderer.invoke('setTaskTags', taskId, tagIds),

  // Tasks
  createTask: (data: CreateTaskInput): Promise<Task> =>
    ipcRenderer.invoke('createTask', data),
  updateTask: (id: number, data: UpdateTaskInput): Promise<Task> =>
    ipcRenderer.invoke('updateTask', id, data),
  deleteTask: (id: number): Promise<void> =>
    ipcRenderer.invoke('deleteTask', id),
  listTasks: (majorTagId?: number | null, status?: string): Promise<Task[]> =>
    ipcRenderer.invoke('listTasks', majorTagId, status),

  // Time tracking
  toggleTaskTimer: (taskId: number): Promise<Task> =>
    ipcRenderer.invoke('toggleTaskTimer', taskId),
  listTimeEntries: (taskId: number): Promise<TimeEntry[]> =>
    ipcRenderer.invoke('listTimeEntries', taskId),
  getTagTimeSummary: (tagId: number): Promise<{ total_seconds: number }> =>
    ipcRenderer.invoke('getTagTimeSummary', tagId),

  // Undo / Redo
  undo: (): Promise<{ success: boolean; task?: Task }> =>
    ipcRenderer.invoke('undo'),
  redo: (): Promise<{ success: boolean; task?: Task }> =>
    ipcRenderer.invoke('redo'),

  // Export
  exportData: (): Promise<{ tags: Tag[]; tasks: Task[] }> =>
    ipcRenderer.invoke('exportData'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api

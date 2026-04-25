import { create } from 'zustand'
import type { Project, Task, TaskStatus, TimeEntry, CreateProjectInput, UpdateProjectInput, CreateTaskInput, UpdateTaskInput } from '../../shared/types'

type View = 'canvas' | 'list' | 'dashboard'
type CanvasMode = 'plan' | 'actual' | 'both'

interface AppState {
  // Data
  projects: Project[]
  tasks: Task[]
  selectedProjectId: number | null
  selectedStatus: TaskStatus | null

  // UI
  view: View
  searchQuery: string
  canvasMode: CanvasMode

  timeEntries: Record<number, TimeEntry[]>
  projectTimeSummaries: Record<number, number>

  // Loading
  isLoading: boolean

  // Actions
  setView: (view: View) => void
  setSearchQuery: (q: string) => void
  setSelectedProject: (id: number | null) => void
  setSelectedStatus: (status: TaskStatus | null) => void
  setCanvasMode: (mode: CanvasMode) => void

  loadProjects: () => Promise<void>
  loadTasks: () => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
  updateProject: (id: number, data: UpdateProjectInput) => Promise<void>
  deleteProject: (id: number) => Promise<void>

  createTask: (data: CreateTaskInput) => Promise<Task>
  updateTask: (id: number, data: UpdateTaskInput) => Promise<void>
  deleteTask: (id: number) => Promise<void>

  undo: () => Promise<void>

  toggleTaskTimer: (taskId: number) => Promise<void>
  loadTimeEntries: (taskId: number) => Promise<void>

  editingTaskId: number | null
  setEditingTaskId: (id: number | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  tasks: [],
  selectedProjectId: null,
  selectedStatus: null,
  view: 'canvas',
  searchQuery: '',
  canvasMode: 'plan',
  isLoading: false,
  timeEntries: {},
  projectTimeSummaries: {},
  editingTaskId: null,

  setView: (view) => set({ view }),
  setCanvasMode: (canvasMode) => set({ canvasMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedProject: (selectedProjectId) => {
    set({ selectedProjectId, selectedStatus: null })
    get().loadTasks()
  },
  setSelectedStatus: (selectedStatus) => {
    set({ selectedStatus, selectedProjectId: null })
    get().loadTasks()
  },

  loadProjects: async () => {
    const projects = await window.electronAPI.listProjects()
    set({ projects })
    const summaries: Record<number, number> = {}
    for (const p of projects) {
      const result = await window.electronAPI.getProjectTimeSummary(p.id)
      summaries[p.id] = result.total_seconds
    }
    set({ projectTimeSummaries: summaries })
  },

  loadTasks: async () => {
    const { selectedProjectId, selectedStatus } = get()
    const tasks = await window.electronAPI.listTasks(
      selectedProjectId ?? undefined,
      selectedStatus ?? undefined,
    )
    set({ tasks })
  },

  createProject: async (data) => {
    const project = await window.electronAPI.createProject(data)
    set((s) => ({ projects: [project, ...s.projects] }))
    return project
  },

  updateProject: async (id, data) => {
    const updated = await window.electronAPI.updateProject(id, data)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }))
  },

  deleteProject: async (id) => {
    await window.electronAPI.deleteProject(id)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)),
    }))
  },

  createTask: async (data) => {
    const task = await window.electronAPI.createTask(data)
    set((s) => ({ tasks: [task, ...s.tasks] }))
    return task
  },

  updateTask: async (id, data) => {
    // Optimistic update
    const oldTask = get().tasks.find((t) => t.id === id)
    if (!oldTask) return
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } as Task : t)),
    }))
    try {
      const updated = await window.electronAPI.updateTask(id, data)
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
      }))
    } catch (err) {
      // Rollback
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? oldTask : t)),
      }))
      throw err
    }
  },

  deleteTask: async (id) => {
    await window.electronAPI.deleteTask(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },

  undo: async () => {
    const result = await window.electronAPI.undo()
    if (result.success && result.task) {
      set((s) => ({
        tasks: s.tasks.some((t) => t.id === result.task!.id)
          ? s.tasks.map((t) => (t.id === result.task!.id ? result.task! : t))
          : [...s.tasks, result.task!],
      }))
    }
  },

  toggleTaskTimer: async (taskId) => {
    const updated = await window.electronAPI.toggleTaskTimer(taskId)
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
    }))
    const entries = await window.electronAPI.listTimeEntries(taskId)
    set((s) => ({
      timeEntries: { ...s.timeEntries, [taskId]: entries },
    }))
    if (updated.project_id != null) {
      const result = await window.electronAPI.getProjectTimeSummary(updated.project_id)
      set((s) => ({
        projectTimeSummaries: { ...s.projectTimeSummaries, [updated.project_id!]: result.total_seconds },
      }))
    }
  },

  loadTimeEntries: async (taskId) => {
    const entries = await window.electronAPI.listTimeEntries(taskId)
    set((s) => ({
      timeEntries: { ...s.timeEntries, [taskId]: entries },
    }))
  },

  setEditingTaskId: (editingTaskId) => set({ editingTaskId }),
}))

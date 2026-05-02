import { create } from 'zustand'
import type { Tag, Task, TaskStatus, TimeEntry, CreateTagInput, UpdateTagInput, CreateTaskInput, UpdateTaskInput } from '../shared/types'

type View = 'canvas' | 'list' | 'dashboard'
type CanvasMode = 'plan' | 'actual' | 'both'
type GanttSortBy = 'earliest' | 'name' | 'created_at'

const STORAGE_KEY = 'tm-gantt-preferences'

function loadPreferences(): { collapsedTagIds: number[]; ganttSortBy: GanttSortBy } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        collapsedTagIds: Array.isArray(parsed.collapsedTagIds) ? parsed.collapsedTagIds : [],
        ganttSortBy: ['earliest', 'name', 'created_at'].includes(parsed.ganttSortBy)
          ? parsed.ganttSortBy
          : 'earliest',
      }
    }
  } catch {
    // ignore
  }
  return { collapsedTagIds: [], ganttSortBy: 'earliest' }
}

function savePreferences(collapsedTagIds: number[], ganttSortBy: GanttSortBy) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsedTagIds, ganttSortBy }))
}

interface AppState {
  // Data
  tags: Tag[]
  secondaryTags: Tag[]
  tasks: Task[]
  selectedTagId: number | null
  selectedStatus: TaskStatus | null

  // UI
  view: View
  searchQuery: string
  canvasMode: CanvasMode
  collapsedTagIds: number[]
  ganttSortBy: GanttSortBy

  timeEntries: Record<number, TimeEntry[]>
  tagTimeSummaries: Record<number, number>

  // Loading
  isLoading: boolean

  // Actions
  setView: (view: View) => void
  setSearchQuery: (q: string) => void
  setSelectedTag: (id: number | null) => void
  setSelectedStatus: (status: TaskStatus | null) => void
  setCanvasMode: (mode: CanvasMode) => void
  toggleTagCollapse: (id: number) => void
  expandAllTags: () => void
  setGanttSortBy: (sort: GanttSortBy) => void

  loadTags: () => Promise<void>
  loadSecondaryTags: () => Promise<void>
  loadTasks: () => Promise<void>
  createTag: (data: CreateTagInput) => Promise<Tag>
  updateTag: (id: number, data: UpdateTagInput) => Promise<void>
  deleteTag: (id: number) => Promise<void>

  createTask: (data: CreateTaskInput) => Promise<Task>
  updateTask: (id: number, data: UpdateTaskInput) => Promise<void>
  deleteTask: (id: number) => Promise<void>

  undo: () => Promise<void>

  toggleTaskTimer: (taskId: number) => Promise<void>
  loadTimeEntries: (taskId: number) => Promise<void>

  editingTaskId: number | null
  setEditingTaskId: (id: number | null) => void
}

export const useStore = create<AppState>((set, get) => {
  const prefs = loadPreferences()

  return {
    tags: [],
    secondaryTags: [],
    tasks: [],
    selectedTagId: null,
    selectedStatus: null,
    view: 'canvas',
    searchQuery: '',
    canvasMode: 'plan',
    collapsedTagIds: prefs.collapsedTagIds,
    ganttSortBy: prefs.ganttSortBy,
    isLoading: false,
    timeEntries: {},
    tagTimeSummaries: {},
    editingTaskId: null,

    setView: (view) => set({ view }),
    setCanvasMode: (canvasMode) => set({ canvasMode }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedTag: (selectedTagId) => {
      set({ selectedTagId, selectedStatus: null })
      get().loadTasks()
    },
    setSelectedStatus: (selectedStatus) => {
      set({ selectedStatus, selectedTagId: null })
      get().loadTasks()
    },
    toggleTagCollapse: (id) => {
      set((s) => {
        const collapsedTagIds = s.collapsedTagIds.includes(id)
          ? s.collapsedTagIds.filter((tid) => tid !== id)
          : [...s.collapsedTagIds, id]
        savePreferences(collapsedTagIds, s.ganttSortBy)
        return { collapsedTagIds }
      })
    },
    expandAllTags: () => {
      set((s) => {
        savePreferences([], s.ganttSortBy)
        return { collapsedTagIds: [] }
      })
    },
    setGanttSortBy: (ganttSortBy) => {
      set((s) => {
        savePreferences(s.collapsedTagIds, ganttSortBy)
        return { ganttSortBy }
      })
    },

    loadTags: async () => {
      const tags = await window.electronAPI.listTags()
      set({ tags })
      const summaries: Record<number, number> = {}
      for (const t of tags) {
        const result = await window.electronAPI.getTagTimeSummary(t.id)
        summaries[t.id] = result.total_seconds
      }
      set({ tagTimeSummaries: summaries })
    },

    loadSecondaryTags: async () => {
      const secondaryTags = await window.electronAPI.listSecondaryTags()
      set({ secondaryTags })
    },

    loadTasks: async () => {
      const { selectedTagId, selectedStatus } = get()
      const tasks = await window.electronAPI.listTasks(
        selectedTagId ?? undefined,
        selectedStatus ?? undefined,
      )
      set({ tasks })
    },

    createTag: async (data) => {
      const tag = await window.electronAPI.createTag(data)
      set((s) => ({ tags: [tag, ...s.tags] }))
      return tag
    },

    updateTag: async (id, data) => {
      const updated = await window.electronAPI.updateTag(id, data)
      set((s) => ({
        tags: s.tags.map((t) => (t.id === id ? updated : t)),
      }))
    },

    deleteTag: async (id) => {
      await window.electronAPI.deleteTag(id)
      set((s) => ({
        tags: s.tags.filter((t) => t.id !== id),
        tasks: s.tasks.map((t) => (t.major_tag_id === id ? { ...t, major_tag_id: null } as Task : t)),
      }))
    },

    createTask: async (data) => {
      const task = await window.electronAPI.createTask(data)
      set((s) => ({ tasks: [task, ...s.tasks] }))
      return task
    },

    updateTask: async (id, data) => {
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
      if (updated.major_tag_id != null) {
        const result = await window.electronAPI.getTagTimeSummary(updated.major_tag_id)
        set((s) => ({
          tagTimeSummaries: { ...s.tagTimeSummaries, [updated.major_tag_id!]: result.total_seconds },
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
  }
})

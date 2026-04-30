import type { Tag, Task, CreateTagInput, UpdateTagInput, CreateTaskInput, UpdateTaskInput, TimeEntry } from '../shared/types'

function loadMockData() {
  try {
    const saved = localStorage.getItem('tm_mock_data')
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return { tags: [], tasks: [], nextTagId: 1, nextTaskId: 1 }
}

function saveMockData() {
  localStorage.setItem('tm_mock_data', JSON.stringify({
    tags: mockTags,
    tasks: mockTasks,
    timeEntries: mockTimeEntries,
    nextTagId,
    nextTaskId,
    nextTimeEntryId,
  }))
}

const initial = loadMockData()
let mockTags: Tag[] = initial.tags
let mockTasks: Task[] = initial.tasks
let nextTagId = initial.nextTagId
let nextTaskId = initial.nextTaskId
let mockTimeEntries: TimeEntry[] = initial.timeEntries ?? []
let nextTimeEntryId = initial.nextTimeEntryId ?? 1

// Ensure default "Other" tag exists
if (!mockTags.some((t) => t.name === 'Other')) {
  const otherTag: Tag = {
    id: nextTagId++,
    name: 'Other',
    description: '',
    color: '#87867f',
    created_at: new Date().toISOString(),
  }
  mockTags.push(otherTag)
  saveMockData()
}

function getDefaultTagId(): number {
  const other = mockTags.find((t) => t.name === 'Other')
  if (!other) throw new Error("Default 'Other' tag not found")
  return other.id
}

function computeDuration(start: string | null | undefined, end?: string | null | undefined): number | null {
  if (!start) return null
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
  return days * 8
}

function createTag(data: CreateTagInput): Promise<Tag> {
  const tag: Tag = {
    id: nextTagId++,
    name: data.name,
    description: data.description || '',
    color: data.color || '#3b82f6',
    created_at: new Date().toISOString(),
  }
  mockTags.push(tag)
  saveMockData()
  return Promise.resolve(tag)
}

function updateTag(id: number, data: UpdateTagInput): Promise<Tag> {
  const t = mockTags.find((x) => x.id === id)
  if (!t) throw new Error('Not found')
  if (data.name !== undefined) t.name = data.name
  if (data.description !== undefined) t.description = data.description
  if (data.color !== undefined) t.color = data.color
  saveMockData()
  return Promise.resolve(t)
}

function deleteTag(id: number): Promise<void> {
  const defaultId = getDefaultTagId()
  if (id === defaultId) {
    throw new Error("Cannot delete the default 'Other' tag")
  }
  mockTags = mockTags.filter((t) => t.id !== id)
  mockTasks = mockTasks.map((t) => (t.major_tag_id === id ? { ...t, major_tag_id: defaultId } as Task : t))
  saveMockData()
  return Promise.resolve()
}

function listTags(): Promise<Tag[]> {
  return Promise.resolve([...mockTags])
}

function listTaskTags(_taskId: number): Promise<Tag[]> {
  return Promise.resolve([])
}

function setTaskTags(_taskId: number, _tagIds: number[]): Promise<void> {
  return Promise.resolve()
}

function createTask(data: CreateTaskInput): Promise<Task> {
  const task: Task = {
    id: nextTaskId++,
    title: data.title,
    description: data.description || '',
    status: data.status || 'inbox',
    major_tag_id: data.major_tag_id ?? getDefaultTagId(),
    planned_start: data.planned_start ?? null,
    planned_end: data.planned_end ?? null,
    planned_duration: data.planned_duration ?? null,
    actual_start: null,
    actual_end: null,
    actual_duration: null,
    dependencies: data.dependencies || '[]',
    recurrence_rule: data.recurrence_rule ?? null,
    created_at: new Date().toISOString(),
    timer_running: 0,
    timer_started_at: null,
    timer_accumulated: 0,
  }
  mockTasks.push(task)
  saveMockData()
  return Promise.resolve(task)
}

function updateTask(id: number, data: UpdateTaskInput): Promise<Task> {
  const t = mockTasks.find((x) => x.id === id)
  if (!t) throw new Error('Not found')

  const effectiveData = { ...data }
  if (effectiveData.planned_start !== undefined && effectiveData.planned_end !== undefined && effectiveData.planned_duration == null) {
    effectiveData.planned_duration = computeDuration(effectiveData.planned_start, effectiveData.planned_end)
  }
  if (effectiveData.actual_start !== undefined && effectiveData.actual_duration == null) {
    effectiveData.actual_duration = computeDuration(effectiveData.actual_start, effectiveData.actual_end)
  }

  Object.assign(t, effectiveData)
  saveMockData()
  return Promise.resolve(t)
}

function deleteTask(id: number): Promise<void> {
  mockTasks = mockTasks.filter((t) => t.id !== id)
  saveMockData()
  return Promise.resolve()
}

function listTasks(majorTagId?: number | null, status?: string): Promise<Task[]> {
  let result = [...mockTasks]
  if (majorTagId !== undefined) {
    result = result.filter((t) => t.major_tag_id === majorTagId)
  }
  if (status) {
    result = result.filter((t) => t.status === status)
  }
  result = result.map((task) => {
    if (task.actual_start && !task.actual_end) {
      return { ...task, actual_duration: computeDuration(task.actual_start) }
    }
    return task
  })
  return Promise.resolve(result)
}

function undo(): Promise<{ success: boolean; task?: Task }> {
  return Promise.resolve({ success: false })
}

function redo(): Promise<{ success: boolean; task?: Task }> {
  return Promise.resolve({ success: false })
}

function exportData(): Promise<{ tags: Tag[]; tasks: Task[] }> {
  return Promise.resolve({ tags: [...mockTags], tasks: [...mockTasks] })
}

function toggleTaskTimer(taskId: number): Promise<Task> {
  const t = mockTasks.find((x) => x.id === taskId)
  if (!t) throw new Error('Not found')

  if (t.timer_running) {
    const entry = mockTimeEntries.find((e) => e.task_id === taskId && !e.ended_at)
    if (entry) {
      const startedAt = new Date(entry.started_at)
      const now = new Date()
      const elapsed = Math.round((now.getTime() - startedAt.getTime()) / 1000)
      entry.ended_at = now.toISOString()
      entry.duration_seconds = elapsed
      t.timer_accumulated += elapsed
    }
    t.timer_running = 0
    t.timer_started_at = null
  } else {
    mockTimeEntries.push({
      id: nextTimeEntryId++,
      task_id: taskId,
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_seconds: null,
      created_at: new Date().toISOString(),
    })
    t.timer_running = 1
    t.timer_started_at = new Date().toISOString()
  }
  saveMockData()
  return Promise.resolve(t)
}

function listTimeEntries(taskId: number): Promise<TimeEntry[]> {
  return Promise.resolve(
    mockTimeEntries
      .filter((e) => e.task_id === taskId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  )
}

function getTagTimeSummary(tagId: number): Promise<{ total_seconds: number }> {
  let total = 0
  const tasks = mockTasks.filter((t) => t.major_tag_id === tagId)
  for (const t of tasks) {
    total += t.timer_accumulated
    if (t.timer_running && t.timer_started_at) {
      const elapsed = Math.round((new Date().getTime() - new Date(t.timer_started_at).getTime()) / 1000)
      total += elapsed
    }
  }
  return Promise.resolve({ total_seconds: total })
}

export const mockElectronAPI = {
  createTag,
  updateTag,
  deleteTag,
  listTags,
  listTaskTags,
  setTaskTags,
  createTask,
  updateTask,
  deleteTask,
  listTasks,
  undo,
  redo,
  exportData,
  toggleTaskTimer,
  listTimeEntries,
  getTagTimeSummary,
}

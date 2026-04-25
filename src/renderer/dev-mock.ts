import type { Project, Task, CreateProjectInput, UpdateProjectInput, CreateTaskInput, UpdateTaskInput } from '../shared/types'

function loadMockData() {
  try {
    const saved = localStorage.getItem('tm_mock_data')
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return { projects: [], tasks: [], nextProjectId: 1, nextTaskId: 1 }
}

function saveMockData() {
  localStorage.setItem('tm_mock_data', JSON.stringify({
    projects: mockProjects,
    tasks: mockTasks,
    nextProjectId,
    nextTaskId,
  }))
}

const initial = loadMockData()
let mockProjects: Project[] = initial.projects
let mockTasks: Task[] = initial.tasks
let nextProjectId = initial.nextProjectId
let nextTaskId = initial.nextTaskId

// Ensure default "Other" project exists
if (!mockProjects.some((p) => p.name === 'Other')) {
  const otherProject: Project = {
    id: nextProjectId++,
    name: 'Other',
    description: '',
    color: '#87867f',
    created_at: new Date().toISOString(),
  }
  mockProjects.push(otherProject)
  saveMockData()
}

function getDefaultProjectId(): number {
  const other = mockProjects.find((p) => p.name === 'Other')
  if (!other) throw new Error("Default 'Other' project not found")
  return other.id
}

function computeDuration(start: string | null | undefined, end?: string | null | undefined): number | null {
  if (!start) return null
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
  return days * 8
}

function createProject(data: CreateProjectInput): Promise<Project> {
  const project: Project = {
    id: nextProjectId++,
    name: data.name,
    description: data.description || '',
    color: data.color || '#3b82f6',
    created_at: new Date().toISOString(),
  }
  mockProjects.push(project)
  saveMockData()
  return Promise.resolve(project)
}

function updateProject(id: number, data: UpdateProjectInput): Promise<Project> {
  const p = mockProjects.find((x) => x.id === id)
  if (!p) throw new Error('Not found')
  if (data.name !== undefined) p.name = data.name
  if (data.description !== undefined) p.description = data.description
  if (data.color !== undefined) p.color = data.color
  saveMockData()
  return Promise.resolve(p)
}

function deleteProject(id: number): Promise<void> {
  const defaultId = getDefaultProjectId()
  if (id === defaultId) {
    throw new Error("Cannot delete the default 'Other' project")
  }
  mockProjects = mockProjects.filter((p) => p.id !== id)
  mockTasks = mockTasks.map((t) => (t.project_id === id ? { ...t, project_id: defaultId } : t))
  saveMockData()
  return Promise.resolve()
}

function listProjects(): Promise<Project[]> {
  return Promise.resolve([...mockProjects])
}

function createTask(data: CreateTaskInput): Promise<Task> {
  const task: Task = {
    id: nextTaskId++,
    title: data.title,
    description: data.description || '',
    status: data.status || 'inbox',
    project_id: data.project_id ?? getDefaultProjectId(),
    planned_start: data.planned_start ?? null,
    planned_end: data.planned_end ?? null,
    planned_duration: data.planned_duration ?? null,
    actual_start: null,
    actual_end: null,
    actual_duration: null,
    dependencies: data.dependencies || '[]',
    recurrence_rule: data.recurrence_rule ?? null,
    created_at: new Date().toISOString(),
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

function listTasks(projectId?: number | null, status?: string): Promise<Task[]> {
  let result = [...mockTasks]
  if (projectId !== undefined) {
    result = result.filter((t) => t.project_id === projectId)
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

function exportData(): Promise<{ projects: Project[]; tasks: Task[] }> {
  return Promise.resolve({ projects: [...mockProjects], tasks: [...mockTasks] })
}

export const mockElectronAPI = {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  createTask,
  updateTask,
  deleteTask,
  listTasks,
  undo,
  redo,
  exportData,
}

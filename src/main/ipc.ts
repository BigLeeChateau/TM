import { ipcMain } from 'electron'
import { getDb, snapshotDatabase, getDefaultProjectId, DEFAULT_PROJECT_NAME } from './database'
import type {
  Project,
  Task,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '../shared/types'

function computeDuration(start: string | null | undefined, end?: string | null | undefined): number | null {
  if (!start) return null
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
  return days * 8
}

export function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('createProject', (_event, data: CreateProjectInput): Project => {
    const db = getDb()
    const stmt = db.prepare(
      'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)'
    )
    const result = stmt.run(data.name, data.description || '', data.color || '#3b82f6')
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid) as Project
    snapshotDatabase()
    return project
  })

  ipcMain.handle('updateProject', (_event, id: number, data: UpdateProjectInput): Project => {
    const db = getDb()
    const sets: string[] = []
    const values: (string | number)[] = []
    if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description) }
    if (data.color !== undefined) { sets.push('color = ?'); values.push(data.color) }
    values.push(id)
    const stmt = db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    snapshotDatabase()
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project
  })

  ipcMain.handle('deleteProject', (_event, id: number): void => {
    const db = getDb()
    const defaultId = getDefaultProjectId()
    if (id === defaultId) {
      throw new Error(`Cannot delete the default '${DEFAULT_PROJECT_NAME}' project`)
    }
    const tx = db.transaction((projectId: number, fallbackId: number) => {
      db.prepare('UPDATE tasks SET project_id = ? WHERE project_id = ?').run(fallbackId, projectId)
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
    })
    tx(id, defaultId)
    snapshotDatabase()
  })

  ipcMain.handle('listProjects', (): Project[] => {
    const db = getDb()
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[]
  })

  // Tasks
  ipcMain.handle('createTask', (_event, data: CreateTaskInput): Task => {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO tasks
      (title, description, status, project_id, planned_start, planned_end, planned_duration, dependencies, recurrence_rule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      data.title,
      data.description || '',
      data.status || 'inbox',
      data.project_id ?? getDefaultProjectId(),
      data.planned_start ?? null,
      data.planned_end ?? null,
      data.planned_duration ?? null,
      data.dependencies || '[]',
      data.recurrence_rule ?? null,
    )
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) as Task
    logMutation(task.id, 'created', null, JSON.stringify(task))
    snapshotDatabase()
    return task
  })

  ipcMain.handle('updateTask', (_event, id: number, data: UpdateTaskInput): Task => {
    const db = getDb()
    const oldTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined
    if (!oldTask) throw new Error(`Task ${id} not found`)

    const sets: string[] = []
    const values: (string | number | null)[] = []

    const fields: (keyof UpdateTaskInput)[] = [
      'title', 'description', 'status', 'project_id',
      'planned_start', 'planned_end', 'planned_duration',
      'actual_start', 'actual_end', 'actual_duration',
      'dependencies', 'recurrence_rule',
    ]

    const effectiveData = { ...data }
    if (effectiveData.planned_start !== undefined && effectiveData.planned_end !== undefined && effectiveData.planned_duration == null) {
      effectiveData.planned_duration = computeDuration(effectiveData.planned_start, effectiveData.planned_end)
    }
    if (effectiveData.actual_start !== undefined && effectiveData.actual_duration == null) {
      effectiveData.actual_duration = computeDuration(effectiveData.actual_start, effectiveData.actual_end)
    }

    for (const field of fields) {
      if (effectiveData[field] !== undefined) {
        sets.push(`${field} = ?`)
        values.push(effectiveData[field] ?? null)
        logMutation(id, field, (oldTask as unknown as Record<string, unknown>)[field] as string | null, effectiveData[field] as string | null)
      }
    }

    values.push(id)
    const stmt = db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`)
    stmt.run(...values)

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task

    // Push to undo stack
    pushUndo('updateTask', id, JSON.stringify(oldTask))

    snapshotDatabase()
    return task
  })

  ipcMain.handle('deleteTask', (_event, id: number): void => {
    const db = getDb()
    const oldTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined
    if (oldTask) {
      pushUndo('deleteTask', id, JSON.stringify(oldTask))
    }
    db.prepare('UPDATE tasks SET deleted_at = datetime("now") WHERE id = ?').run(id)
    snapshotDatabase()
  })

  ipcMain.handle('listTasks', (_event, projectId?: number | null, status?: string): Task[] => {
    const db = getDb()
    let sql = 'SELECT * FROM tasks WHERE deleted_at IS NULL'
    const params: (number | string | null)[] = []
    if (projectId !== undefined) {
      sql += ' AND project_id = ?'
      params.push(projectId)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params) as Task[]
    return rows.map((task) => {
      if (task.actual_start && !task.actual_end) {
        return { ...task, actual_duration: computeDuration(task.actual_start) }
      }
      return task
    })
  })

  // Undo / Redo
  ipcMain.handle('undo', (): { success: boolean; task?: Task } => {
    const db = getDb()
    const entry = db.prepare('SELECT * FROM undo_stack ORDER BY id DESC LIMIT 1').get() as
      { id: number; action_type: string; task_id: number | null; previous_state: string } | undefined
    if (!entry || !entry.task_id) return { success: false }

    const oldTask = JSON.parse(entry.previous_state) as Task
    const stmt = db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, project_id = ?,
        planned_start = ?, planned_end = ?, planned_duration = ?,
        actual_start = ?, actual_end = ?, actual_duration = ?,
        dependencies = ?, recurrence_rule = ?
      WHERE id = ?
    `)
    stmt.run(
      oldTask.title, oldTask.description, oldTask.status, oldTask.project_id,
      oldTask.planned_start, oldTask.planned_end, oldTask.planned_duration,
      oldTask.actual_start, oldTask.actual_end, oldTask.actual_duration,
      oldTask.dependencies, oldTask.recurrence_rule,
      entry.task_id,
    )
    // Restore soft-deleted task
    db.prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?').run(entry.task_id)
    db.prepare('DELETE FROM undo_stack WHERE id = ?').run(entry.id)

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(entry.task_id) as Task
    return { success: true, task }
  })

  ipcMain.handle('redo', (): { success: boolean; task?: Task } => {
    // Redo not implemented in v1 — undo stack is linear
    return { success: false }
  })

  // Export
  ipcMain.handle('exportData', (): { projects: Project[]; tasks: Task[] } => {
    const db = getDb()
    const projects = db.prepare('SELECT * FROM projects').all() as Project[]
    const tasks = db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all() as Task[]
    return { projects, tasks }
  })
}

function logMutation(taskId: number, field: string, oldValue: string | null, newValue: string | null): void {
  const db = getDb()
  db.prepare('INSERT INTO task_mutations (task_id, field, old_value, new_value) VALUES (?, ?, ?, ?)')
    .run(taskId, field, oldValue, newValue)
}

function pushUndo(actionType: string, taskId: number, previousState: string): void {
  const db = getDb()
  db.prepare('INSERT INTO undo_stack (action_type, task_id, previous_state) VALUES (?, ?, ?)')
    .run(actionType, taskId, previousState)
  // Keep only last 50
  db.prepare('DELETE FROM undo_stack WHERE id <= (SELECT id FROM undo_stack ORDER BY id DESC LIMIT 1 OFFSET 50)').run()
}

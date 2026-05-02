import { ipcMain } from 'electron'
import { getDb, snapshotDatabase, getDefaultTagId, DEFAULT_TAG_NAME } from './database'
import { getTodayLocal, validateActualDates, computeActualDatesFromTimer } from '../shared/actual-date-utils'
import type {
  Tag,
  Task,
  TimeEntry,
  CreateTagInput,
  UpdateTagInput,
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
  // Tags
  ipcMain.handle('createTag', (_event, data: CreateTagInput): Tag => {
    const db = getDb()
    const stmt = db.prepare(
      'INSERT INTO tags (name, description, color) VALUES (?, ?, ?)'
    )
    const result = stmt.run(data.name, data.description || '', data.color || '#3b82f6')
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag
    snapshotDatabase()
    return tag
  })

  ipcMain.handle('updateTag', (_event, id: number, data: UpdateTagInput): Tag => {
    const db = getDb()
    if (Object.keys(data).length === 0) {
      return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag
    }
    const sets: string[] = []
    const values: (string | number)[] = []
    if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description) }
    if (data.color !== undefined) { sets.push('color = ?'); values.push(data.color) }
    values.push(id)
    const stmt = db.prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    snapshotDatabase()
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag
  })

  ipcMain.handle('deleteTag', (_event, id: number): void => {
    const db = getDb()
    const defaultId = getDefaultTagId()
    if (id === defaultId) {
      throw new Error(`Cannot delete the default '${DEFAULT_TAG_NAME}' tag`)
    }
    const tx = db.transaction((tagId: number, fallbackId: number) => {
      db.prepare('UPDATE tasks SET major_tag_id = ? WHERE major_tag_id = ?').run(fallbackId, tagId)
      db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
    })
    tx(id, defaultId)
    snapshotDatabase()
  })

  ipcMain.handle('listTags', (): Tag[] => {
    const db = getDb()
    return db.prepare('SELECT * FROM tags ORDER BY created_at DESC').all() as Tag[]
  })

  ipcMain.handle('listSecondaryTags', (): Tag[] => {
    const db = getDb()
    return db.prepare(`
      SELECT DISTINCT t.* FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      ORDER BY t.name
    `).all() as Tag[]
  })

  // Task tag associations
  ipcMain.handle('listTaskTags', (_event, taskId: number): Tag[] => {
    const db = getDb()
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY t.name
    `).all(taskId) as Tag[]
  })

  ipcMain.handle('setTaskTags', (_event, taskId: number, tagIds: number[]): void => {
    const db = getDb()
    const tx = db.transaction((tid: number, tids: number[]) => {
      db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(tid)
      const stmt = db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)')
      for (const tagId of tids) {
        stmt.run(tid, tagId)
      }
    })
    tx(taskId, tagIds)
    snapshotDatabase()
  })

  // Tasks
  ipcMain.handle('createTask', (_event, data: CreateTaskInput): Task => {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO tasks
      (title, description, status, major_tag_id, planned_start, planned_end, planned_duration, dependencies, recurrence_rule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      data.title,
      data.description || '',
      data.status || 'inbox',
      data.major_tag_id ?? getDefaultTagId(),
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
      'title', 'description', 'status', 'major_tag_id',
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

    // Validate actual dates
    const actualStartValue = effectiveData.actual_start !== undefined ? effectiveData.actual_start : oldTask.actual_start
    const actualEndValue = effectiveData.actual_end !== undefined ? effectiveData.actual_end : oldTask.actual_end
    const validation = validateActualDates(actualStartValue, actualEndValue)
    if (!validation.valid) {
      throw new Error(validation.error)
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

  ipcMain.handle('listTasks', (_event, majorTagId?: number | null, status?: string): Task[] => {
    const db = getDb()
    let sql = 'SELECT * FROM tasks WHERE deleted_at IS NULL'
    const params: (number | string | null)[] = []
    if (majorTagId !== undefined) {
      sql += ' AND major_tag_id = ?'
      params.push(majorTagId)
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

  ipcMain.handle('toggleTaskTimer', (_event, taskId: number): Task => {
    const db = getDb()

    const toggle = db.transaction((id: number) => {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined
      if (!task) throw new Error(`Task ${id} not found`)

      if (task.timer_running) {
        if (!task.timer_started_at) {
          throw new Error(`Task ${id} has timer_running=true but no timer_started_at`)
        }
        const startedAt = new Date(task.timer_started_at)
        if (isNaN(startedAt.getTime())) {
          throw new Error(`Invalid timer_started_at for task ${id}`)
        }
        const now = new Date()
        const elapsedSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000)

        const updateResult = db.prepare(`
          UPDATE time_entries
          SET ended_at = ?, duration_seconds = ?
          WHERE task_id = ? AND ended_at IS NULL
        `).run(now.toISOString(), elapsedSeconds, id)

        if (updateResult.changes === 0) {
          throw new Error(`No open time entry found for task ${id}`)
        }

        const { actual_start, actual_end } = computeActualDatesFromTimer(task.timer_started_at!, now.toISOString())
        const actualDuration = computeDuration(actual_start, actual_end)

        db.prepare(`
          UPDATE tasks
          SET timer_running = 0, timer_started_at = NULL, timer_accumulated = timer_accumulated + ?,
              actual_start = ?, actual_end = ?, actual_duration = ?
          WHERE id = ?
        `).run(elapsedSeconds, actual_start, actual_end, actualDuration, id)
      } else {
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO time_entries (task_id, started_at) VALUES (?, ?)
        `).run(id, now)

        db.prepare(`
          UPDATE tasks
          SET timer_running = 1, timer_started_at = ?
          WHERE id = ?
        `).run(now, id)
      }

      return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task
    })

    const updated = toggle(taskId)
    snapshotDatabase()
    return updated
  })

  ipcMain.handle('listTimeEntries', (_event, taskId: number): TimeEntry[] => {
    const db = getDb()
    return db.prepare(`
      SELECT * FROM time_entries WHERE task_id = ? ORDER BY started_at DESC
    `).all(taskId) as TimeEntry[]
  })

  ipcMain.handle('getTagTimeSummary', (_event, tagId: number): { total_seconds: number } => {
    const db = getDb()
    const rows = db.prepare(`
      SELECT timer_running, timer_started_at, timer_accumulated
      FROM tasks
      WHERE major_tag_id = ? AND deleted_at IS NULL
    `).all(tagId) as { timer_running: number; timer_started_at: string | null; timer_accumulated: number }[]

    let total = 0
    for (const t of rows) {
      total += t.timer_accumulated
      if (t.timer_running && t.timer_started_at) {
        const elapsed = Math.round((new Date().getTime() - new Date(t.timer_started_at).getTime()) / 1000)
        total += elapsed
      }
    }

    return { total_seconds: total }
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
        title = ?, description = ?, status = ?, major_tag_id = ?,
        planned_start = ?, planned_end = ?, planned_duration = ?,
        actual_start = ?, actual_end = ?, actual_duration = ?,
        dependencies = ?, recurrence_rule = ?
      WHERE id = ?
    `)
    stmt.run(
      oldTask.title, oldTask.description, oldTask.status, oldTask.major_tag_id,
      oldTask.planned_start, oldTask.planned_end, oldTask.planned_duration,
      oldTask.actual_start, oldTask.actual_end, oldTask.actual_duration,
      oldTask.dependencies, oldTask.recurrence_rule,
      entry.task_id,
    )
    db.prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?').run(entry.task_id)
    db.prepare('DELETE FROM undo_stack WHERE id = ?').run(entry.id)

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(entry.task_id) as Task
    return { success: true, task }
  })

  ipcMain.handle('redo', (): { success: boolean; task?: Task } => {
    return { success: false }
  })

  // Export
  ipcMain.handle('exportData', (): { tags: Tag[]; tasks: Task[] } => {
    const db = getDb()
    const tags = db.prepare('SELECT * FROM tags').all() as Tag[]
    const tasks = db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all() as Task[]
    return { tags, tasks }
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
  db.prepare('DELETE FROM undo_stack WHERE id <= (SELECT id FROM undo_stack ORDER BY id DESC LIMIT 1 OFFSET 50)').run()
}

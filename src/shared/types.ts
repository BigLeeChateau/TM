export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'done'

export interface Tag {
  id: number
  name: string
  description: string
  color: string
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string
  status: TaskStatus
  major_tag_id: number | null
  planned_start: string | null
  planned_end: string | null
  planned_duration: number | null
  actual_start: string | null
  actual_end: string | null
  actual_duration: number | null
  dependencies: string
  recurrence_rule: string | null
  created_at: string
  timer_running: number
  timer_started_at: string | null
  timer_accumulated: number
}

export interface CreateTagInput {
  name: string
  description?: string
  color?: string
}

export interface UpdateTagInput {
  name?: string
  description?: string
  color?: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  major_tag_id?: number | null
  planned_start?: string | null
  planned_end?: string | null
  planned_duration?: number | null
  dependencies?: string
  recurrence_rule?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  major_tag_id?: number | null
  planned_start?: string | null
  planned_end?: string | null
  planned_duration?: number | null
  actual_start?: string | null
  actual_end?: string | null
  actual_duration?: number | null
  dependencies?: string
  recurrence_rule?: string | null
}

export interface UndoEntry {
  id: number
  action_type: string
  task_id: number | null
  previous_state: string
  created_at: string
}

export interface TimeEntry {
  id: number
  task_id: number
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  created_at: string
}

import React, { useState } from 'react'
import { useStore } from '../store'
import type { TaskStatus } from '../../../shared/types'

const statuses: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All Tasks' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'next', label: 'Next' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'done', label: 'Done' },
]

export function TaskList() {
  const {
    tasks,
    selectedStatus,
    setSelectedStatus,
    createTask,
    deleteTask,
    updateTask,
    projects,
    setEditingTaskId,
  } = useStore()

  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await createTask({ title: newTitle.trim(), status: selectedStatus ?? 'inbox' })
    setNewTitle('')
    setIsAdding(false)
  }

  const cycleStatus = async (task: { id: number; status: TaskStatus }) => {
    const next: Record<TaskStatus, TaskStatus> = {
      inbox: 'next',
      next: 'waiting',
      waiting: 'done',
      done: 'inbox',
    }
    await updateTask(task.id, { status: next[task.status] })
  }

  const currentStatusKey = selectedStatus ?? 'all'

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="px-3 py-2 text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">
        GTD
      </div>
      <div className="space-y-0.5 px-2 mb-2">
        {statuses.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSelectedStatus(key === 'all' ? null : key)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
              currentStatusKey === key
                ? 'bg-[#f5f4ed] text-[#141413] font-medium'
                : 'text-[#5e5d59] hover:bg-[#f5f4ed]'
            }`}
          >
            <span>{label}</span>
            {key !== 'all' && (
              <span className="text-xs text-[#b0aea5]">
                {tasks.filter((t) => t.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-[#e8e6dc] px-2 pt-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#f5f4ed]"
          >
            <button
              onClick={() => cycleStatus(task)}
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                task.status === 'inbox'
                  ? 'bg-[#b0aea5]'
                  : task.status === 'next'
                    ? 'bg-[#c96442]'
                    : task.status === 'waiting'
                      ? 'bg-[#d97757]'
                      : 'bg-[#4d4c48]'
              }`}
            />
            <span
              className={`flex-1 text-sm truncate cursor-pointer ${
                task.status === 'done' ? 'line-through text-[#b0aea5]' : 'text-[#4d4c48]'
              }`}
              onClick={() => setEditingTaskId(task.id)}
            >
              {task.title}
            </span>
            {task.project_id && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    projects.find((p) => p.id === task.project_id)?.color ?? '#666',
                }}
              />
            )}
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 text-xs text-[#b0aea5] hover:text-[#b53333] transition-opacity"
            >
              ×
            </button>
          </div>
        ))}

        {isAdding ? (
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') {
                setIsAdding(false)
                setNewTitle('')
              }
            }}
            onBlur={() => {
              if (!newTitle.trim()) setIsAdding(false)
            }}
            placeholder="Task title"
            className="w-full px-2 py-1.5 bg-white border border-[#e8e6dc] rounded-lg text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
          />
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#b0aea5] hover:text-[#4d4c48] hover:bg-[#f5f4ed] transition-colors text-left"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Task</span>
          </button>
        )}
      </div>
    </div>
  )
}

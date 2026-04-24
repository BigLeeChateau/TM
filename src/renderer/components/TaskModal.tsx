import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import type { TaskStatus } from '../../../shared/types'

interface TaskModalProps {
  taskId: number | null
  onClose: () => void
}

function nowDateString(): string {
  return new Date().toISOString().split('T')[0]
}

function computeDuration(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
  return days * 8
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { tasks, projects, updateTask, deleteTask } = useStore()
  const task = tasks.find((t) => t.id === taskId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('inbox')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [plannedDuration, setPlannedDuration] = useState<number | ''>('')
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [actualDuration, setActualDuration] = useState<number | ''>('')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setStatus(task.status)
      setProjectId(task.project_id)
      setPlannedStart(task.planned_start ?? '')
      setPlannedEnd(task.planned_end ?? '')
      setPlannedDuration(task.planned_duration ?? '')
      setActualStart(task.actual_start ?? '')
      setActualEnd(task.actual_end ?? '')
      setActualDuration(task.actual_duration ?? '')
    }
  }, [task])

  // Auto-compute planned duration when dates change
  useEffect(() => {
    if (plannedStart && plannedEnd && !plannedDuration) {
      setPlannedDuration(computeDuration(plannedStart, plannedEnd))
    }
  }, [plannedStart, plannedEnd])

  // Auto-compute actual duration when dates change
  useEffect(() => {
    if (actualStart && actualEnd && !actualDuration) {
      setActualDuration(computeDuration(actualStart, actualEnd))
    }
  }, [actualStart, actualEnd])

  if (!task) return null

  const handleSave = async () => {
    await updateTask(task.id, {
      title: title.trim(),
      description: description.trim(),
      status,
      project_id: projectId,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      planned_duration: plannedDuration ? Number(plannedDuration) : null,
      actual_start: actualStart || null,
      actual_end: actualEnd || null,
      actual_duration: actualDuration ? Number(actualDuration) : null,
    })
    onClose()
  }

  const handleDelete = async () => {
    await deleteTask(task.id)
    onClose()
  }

  const handleStartNow = () => {
    const today = nowDateString()
    setActualStart(today)
    if (status === 'inbox') setStatus('next')
  }

  const handleMarkComplete = () => {
    const today = nowDateString()
    setActualEnd(today)
    setStatus('done')
    if (actualStart && today) {
      setActualDuration(computeDuration(actualStart, today))
    }
  }

  return (
    <div
      className="fixed inset-0 bg-[rgba(20,20,19,0.4)] flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white border border-[#f0eee6] rounded-2xl w-full max-w-md p-5 shadow-[rgba(0,0,0,0.05)_0px_4px_24px] max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-medium text-[#141413] mb-4">Edit Task</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] resize-none placeholder:text-[#b0aea5]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              >
                <option value="inbox">Inbox</option>
                <option value="next">Next</option>
                <option value="waiting">Waiting</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Project</label>
              <select
                value={projectId ?? ''}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Planned dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Planned Start</label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Planned End</label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Hours</label>
              <input
                type="number"
                value={plannedDuration}
                onChange={(e) => setPlannedDuration(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              />
            </div>
          </div>

          {/* Actual dates */}
          <div className="border-t border-[#f0eee6] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">Actual Time</span>
              <div className="flex gap-2">
                {!actualStart && (
                  <button
                    onClick={handleStartNow}
                    className="px-2 py-1 text-xs bg-[#e8e6dc] text-[#c96442] rounded-lg hover:bg-[#d1cfc5] transition-colors"
                  >
                    Start now
                  </button>
                )}
                {actualStart && !actualEnd && (
                  <button
                    onClick={handleMarkComplete}
                    className="px-2 py-1 text-xs bg-[#e8e6dc] text-[#c96442] rounded-lg hover:bg-[#d1cfc5] transition-colors"
                  >
                    Mark complete
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Actual Start</label>
                <input
                  type="date"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Actual End</label>
                <input
                  type="date"
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">Hours</label>
                <input
                  type="number"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#f0eee6]">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-[#b53333] hover:text-[#b53333]/80 transition-colors"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#5e5d59] hover:text-[#141413] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-1.5 text-sm bg-[#c96442] text-[#faf9f5] rounded-lg hover:bg-[#d97757] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

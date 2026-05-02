import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { useTranslation } from '../i18n'
import type { TaskStatus } from '../../shared/types'

interface TaskModalProps {
  taskId: number | null
  onClose: () => void
}

function nowDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function computeDuration(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
  return days * 8
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { tasks, tags, updateTask, deleteTask, timeEntries, loadTimeEntries, toggleTaskTimer } = useStore()
  const { t } = useTranslation()
  const task = tasks.find((t) => t.id === taskId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('inbox')
  const [majorTagId, setMajorTagId] = useState<number | null>(null)
  const [secondaryTagIds, setSecondaryTagIds] = useState<number[]>([])
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [plannedDuration, setPlannedDuration] = useState<number | ''>('')
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [actualDuration, setActualDuration] = useState<number | ''>('')
  const [timerTick, setTimerTick] = useState(0)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setStatus(task.status)
      setMajorTagId(task.major_tag_id)
      setPlannedStart(task.planned_start ?? '')
      setPlannedEnd(task.planned_end ?? '')
      setPlannedDuration(task.planned_duration ?? '')
      setActualStart(task.actual_start ?? '')
      setActualEnd(task.actual_end ?? '')
      setActualDuration(task.actual_duration ?? '')
      // Load secondary tags
      window.electronAPI.listTaskTags(task.id).then((taskTags) => {
        setSecondaryTagIds(taskTags.map((t) => t.id))
      })
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

  useEffect(() => {
    if (task) {
      loadTimeEntries(task.id)
    }
  }, [task?.id])

  useEffect(() => {
    if (!task?.timer_running) return
    const id = setInterval(() => setTimerTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [task?.timer_running])

  if (!task) return null

  const entries = timeEntries[task?.id ?? -1] ?? []
  let totalTimerSeconds = task?.timer_accumulated ?? 0
  if (task?.timer_running && task?.timer_started_at) {
    totalTimerSeconds += Math.round((Date.now() - new Date(task.timer_started_at).getTime()) / 1000)
  }
  // timerTick is read to satisfy the compiler; it drives re-renders while the timer runs
  void timerTick

  const handleSave = async () => {
    await updateTask(task.id, {
      title: title.trim(),
      description: description.trim(),
      status,
      major_tag_id: majorTagId,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      planned_duration: plannedDuration ? Number(plannedDuration) : null,
      actual_start: actualStart || null,
      actual_end: actualEnd || null,
      actual_duration: actualDuration ? Number(actualDuration) : null,
    })
    // Sync secondary tags (exclude major tag)
    const secondaryIds = secondaryTagIds.filter((id) => id !== majorTagId)
    await window.electronAPI.setTaskTags(task.id, secondaryIds)
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
        <h3 className="text-lg font-medium text-[#141413] mb-4">{t('editTask')}</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('title')}</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] resize-none placeholder:text-[#b0aea5]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('status')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              >
                <option value="inbox">{t('status_inbox')}</option>
                <option value="next">{t('status_next')}</option>
                <option value="waiting">{t('status_waiting')}</option>
                <option value="done">{t('status_done')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('majorTag')}</label>
              <select
                value={majorTagId ?? ''}
                onChange={(e) => {
                  const newId = e.target.value ? Number(e.target.value) : null
                  setMajorTagId(newId)
                  // Remove new major tag from secondary selection
                  if (newId != null) {
                    setSecondaryTagIds((prev) => prev.filter((id) => id !== newId))
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              >
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('secondaryTags')}</label>
            <div className="flex flex-wrap gap-2">
              {tags
                .filter((t) => t.id !== majorTagId)
                .map((t) => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${
                      secondaryTagIds.includes(t.id)
                        ? 'bg-[#f5f4ed] border-[#c96442] text-[#141413]'
                        : 'bg-white border-[#e8e6dc] text-[#87867f] hover:border-[#b0aea5]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={secondaryTagIds.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSecondaryTagIds((prev) => [...prev, t.id])
                        } else {
                          setSecondaryTagIds((prev) => prev.filter((id) => id !== t.id))
                        }
                      }}
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              {tags.filter((t) => t.id !== majorTagId).length === 0 && (
                <span className="text-xs text-[#b0aea5]">{t('noOtherTags')}</span>
              )}
            </div>
          </div>

          {/* Planned dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('plannedStart')}</label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('plannedEnd')}</label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('plannedHours')}</label>
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
              <span className="text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">{t('actualTime')}</span>
              <div className="flex gap-2 items-center">
                {actualStart && !actualEnd && actualDuration !== '' && (
                  <span className="text-[11px] text-[#c96442]">{actualDuration}{t('elapsed')}</span>
                )}
                {!actualStart && (
                  <button
                    onClick={handleStartNow}
                    className="px-2 py-1 text-xs bg-[#e8e6dc] text-[#c96442] rounded-lg hover:bg-[#d1cfc5] transition-colors"
                  >
                    {t('startNow')}
                  </button>
                )}
                {actualStart && !actualEnd && (
                  <button
                    onClick={handleMarkComplete}
                    className="px-2 py-1 text-xs bg-[#e8e6dc] text-[#c96442] rounded-lg hover:bg-[#d1cfc5] transition-colors"
                  >
                    {t('markComplete')}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('actualStart')}</label>
                <input
                  type="date"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('actualEnd')}</label>
                <input
                  type="date"
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">{t('actualHours')}</label>
                <input
                  type="number"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
                />
              </div>
            </div>
          </div>

          {/* Session Log */}
          <div className="border-t border-[#f0eee6] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">
                {t('sessionLog')}
              </span>
              <button
                onClick={() => toggleTaskTimer(task.id)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors font-medium ${
                  task.timer_running
                    ? 'bg-[#c96442] text-[#faf9f5] hover:bg-[#d97757]'
                    : 'bg-[#e8e6dc] text-[#4d4c48] hover:bg-[#d1cfc5]'
                }`}
              >
                {task.timer_running ? t('stopTimer') : t('startTimer')}
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="text-sm text-[#b0aea5]">{t('noSessions')}</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-auto">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-[#4d4c48] text-xs">
                      {new Date(entry.started_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[#87867f] text-xs font-mono tabular-nums">
                      {entry.ended_at && entry.duration_seconds != null
                        ? formatDuration(entry.duration_seconds)
                        : t('running')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {totalTimerSeconds > 0 && (
              <div className="mt-2 pt-2 border-t border-[#f0eee6] flex items-center justify-between">
                <span className="text-sm font-medium text-[#4d4c48]">{t('total')}</span>
                <span className="text-sm font-medium text-[#c96442] font-mono tabular-nums">
                  {formatDuration(totalTimerSeconds)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#f0eee6]">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-[#b53333] hover:text-[#b53333]/80 transition-colors"
          >
            {t('delete')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#5e5d59] hover:text-[#141413] transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-1.5 text-sm bg-[#c96442] text-[#faf9f5] rounded-lg hover:bg-[#d97757] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

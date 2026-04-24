import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import type { Task } from '../../../shared/types'

const DAY_WIDTH = 80
const HEADER_HEIGHT = 56
const BLOCK_HEIGHT = 32
const BLOCK_GAP = 8
const ROW_OFFSET = 60
const OVERCOMMIT_THRESHOLD = 8

let draggedTaskId: number | null = null

export function TimeCanvas() {
  const { tasks, projects, updateTask, setEditingTaskId, canvasMode, setCanvasMode } = useStore()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)

  // Determine date range
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 3)
  const dayCount = 21

  const dateRange = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return d
  })

  const getDayIndex = (dateStr: string | null) => {
    if (!dateStr) return -1
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    const diff = d.getTime() - startDate.getTime()
    return Math.round(diff / (1000 * 60 * 60 * 24))
  }

  const getDateFromIndex = (index: number) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + index)
    return d.toISOString().split('T')[0]
  }

  // ---- Row assignment for overlap avoidance ----
  function assignRows(tasksToLayout: Task[], startKey: keyof Task, endKey: keyof Task): Map<number, number> {
    const rows = new Map<number, number>()
    const rowEnds: number[] = []

    const sorted = [...tasksToLayout].sort((a, b) => {
      const ai = getDayIndex(a[startKey] as string | null)
      const bi = getDayIndex(b[startKey] as string | null)
      return ai - bi
    })

    for (const task of sorted) {
      const startIdx = getDayIndex(task[startKey] as string | null)
      const endIdx = getDayIndex(task[endKey] as string | null)
      if (startIdx < 0 || endIdx < 0) continue
      let row = 0
      while (rowEnds[row] !== undefined && rowEnds[row] > startIdx) {
        row++
      }
      rows.set(task.id, row)
      rowEnds[row] = endIdx
    }

    return rows
  }

  // ---- Overcommitment: sum planned_duration per day ----
  const dayLoad = new Map<number, number>()
  for (let i = 0; i < dayCount; i++) {
    let total = 0
    for (const task of tasks) {
      const s = getDayIndex(task.planned_start)
      const e = getDayIndex(task.planned_end)
      if (s <= i && e > i) {
        total += task.planned_duration ?? (e - s) * 8
      }
    }
    dayLoad.set(i, total)
  }

  // Filter tasks based on canvas mode
  const plannedTasks = tasks.filter((t) => t.planned_start && t.planned_end)
  const actualTasks = tasks.filter((t) => t.actual_start && t.actual_end)

  const plannedRows = assignRows(plannedTasks, 'planned_start', 'planned_end')
  const actualRows = assignRows(actualTasks, 'actual_start', 'actual_end')

  const maxPlannedRow = plannedTasks.length > 0
    ? Math.max(...plannedTasks.map((t) => plannedRows.get(t.id) ?? 0)) + 1
    : 1
  const maxActualRow = actualTasks.length > 0
    ? Math.max(...actualTasks.map((t) => actualRows.get(t.id) ?? 0)) + 1
    : 1

  // Canvas height depends on mode
  let canvasHeight: number
  if (canvasMode === 'both') {
    canvasHeight = ROW_OFFSET + maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP) + 20 + maxActualRow * (BLOCK_HEIGHT + BLOCK_GAP) + 40
  } else if (canvasMode === 'actual') {
    canvasHeight = ROW_OFFSET + maxActualRow * (BLOCK_HEIGHT + BLOCK_GAP) + 40
  } else {
    canvasHeight = ROW_OFFSET + maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP) + 40
  }

  // ---- Drag handlers (only for planned blocks in plan/both mode) ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, task: Task, mode: 'move' | 'resize') => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const startX = e.clientX - rect.left
      const startIdx = getDayIndex(task.planned_start)
      const endIdx = getDayIndex(task.planned_end)
      setDragState({
        taskId: task.id,
        mode,
        startX,
        startIdx,
        endIdx,
        offsetX: mode === 'move' ? startX - startIdx * DAY_WIDTH : 0,
      })
    },
    []
  )

  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const { mode, startIdx, endIdx, offsetX } = dragState

      if (mode === 'move') {
        const rawIdx = Math.round((x - offsetX) / DAY_WIDTH)
        const newStart = Math.max(0, rawIdx)
        const duration = endIdx - startIdx
        const newEnd = newStart + duration
        setDragState((s) => (s ? { ...s, currentStart: newStart, currentEnd: newEnd } : null))
      } else {
        const rawEnd = Math.round(x / DAY_WIDTH)
        const newEnd = Math.max(startIdx + 1, rawEnd)
        setDragState((s) => (s ? { ...s, currentEnd: newEnd } : null))
      }
    }

    const handleMouseUp = async () => {
      if (!dragState) return
      const { taskId, mode, startIdx, currentStart, currentEnd } = dragState
      if (currentStart !== undefined || currentEnd !== undefined) {
        if (mode === 'move' && currentStart !== undefined) {
          const duration = dragState.endIdx - dragState.startIdx
          const newStartDate = getDateFromIndex(currentStart)
          const newEndDate = getDateFromIndex(currentStart + duration)
          await updateTask(taskId, {
            planned_start: newStartDate,
            planned_end: newEndDate,
          })
        } else if (mode === 'resize' && currentEnd !== undefined) {
          const newEndDate = getDateFromIndex(currentEnd)
          await updateTask(taskId, {
            planned_end: newEndDate,
          })
        }
      }
      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, updateTask])

  // Keyboard undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useStore.getState().undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const getTaskStyle = (task: Task, startKey: keyof Task, endKey: keyof Task, rowMap: Map<number, number>, rowOffset: number = 0): React.CSSProperties => {
    const startIdx = getDayIndex(task[startKey] as string | null)
    const endIdx = getDayIndex(task[endKey] as string | null)
    const row = rowMap.get(task.id) ?? 0

    let left = startIdx * DAY_WIDTH
    let width = (endIdx - startIdx) * DAY_WIDTH

    // Apply drag preview (only for planned blocks)
    if (dragState?.taskId === task.id && startKey === 'planned_start') {
      if (dragState.currentStart !== undefined) {
        left = dragState.currentStart * DAY_WIDTH
        width = (dragState.currentEnd! - dragState.currentStart) * DAY_WIDTH
      } else if (dragState.currentEnd !== undefined) {
        width = (dragState.currentEnd - startIdx) * DAY_WIDTH
      }
    }

    return {
      position: 'absolute',
      left,
      top: ROW_OFFSET + rowOffset + row * (BLOCK_HEIGHT + BLOCK_GAP),
      width: Math.max(width, DAY_WIDTH),
      height: BLOCK_HEIGHT,
    }
  }

  const projectColor = (pid: number | null) =>
    projects.find((p) => p.id === pid)?.color ?? '#4b5563'

  const renderBlock = (task: Task, startKey: keyof Task, endKey: keyof Task, rowMap: Map<number, number>, rowOffset: number = 0) => {
    const isPlanned = startKey === 'planned_start'
    return (
      <div
        key={`${task.id}-${startKey}`}
        className={`absolute rounded-lg px-2 py-1 text-xs font-medium select-none cursor-move overflow-hidden whitespace-nowrap border ${
          task.status === 'done' ? 'opacity-40' : ''
        }`}
        style={{
          ...getTaskStyle(task, startKey, endKey, rowMap, rowOffset),
          backgroundColor: projectColor(task.project_id) + (isPlanned ? '26' : 'ff'),
          borderColor: projectColor(task.project_id) + (isPlanned ? '40' : 'ff'),
          color: isPlanned ? '#141413' : '#faf9f5',
        }}
        onMouseDown={isPlanned ? (e) => handleMouseDown(e, task, 'move') : undefined}
        onDoubleClick={() => setEditingTaskId(task.id)}
      >
        <span>{task.title}</span>
        {isPlanned && (
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#141413]/10"
            onMouseDown={(e) => {
              e.stopPropagation()
              handleMouseDown(e, task, 'resize')
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" ref={canvasRef}>
      <div style={{ width: dayCount * DAY_WIDTH + DAY_WIDTH, minHeight: '100%' }}>
        {/* Date headers */}
        <div
          className="flex border-b border-[#f0eee6] sticky top-0 bg-[#faf9f5] z-10"
          style={{ height: HEADER_HEIGHT }}
        >
          {dateRange.map((d, i) => {
            const load = dayLoad.get(i) ?? 0
            const isOvercommitted = load > OVERCOMMIT_THRESHOLD
            return (
              <div
                key={i}
                className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-[#f0eee6] relative ${
                  d.getTime() === now.getTime() ? 'bg-[rgba(201,100,66,0.06)]' : ''
                } ${isOvercommitted ? 'bg-[rgba(181,51,51,0.06)]' : ''}`}
                style={{ width: DAY_WIDTH }}
              >
                <span className="text-[11px] text-[#87867f] uppercase tracking-[0.5px]">
                  {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
                <span
                  className={`text-[15px] font-medium ${
                    d.getTime() === now.getTime() ? 'text-[#c96442]' : 'text-[#141413]'
                  }`}
                >
                  {d.getDate()}
                </span>
                {isOvercommitted && (
                  <span className="absolute top-0.5 right-1 text-[9px] text-[#b53333] font-bold">
                    {Math.round(load)}h
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 px-2 py-2 border-b border-[#f0eee6] bg-[#faf9f5] sticky top-[56px] z-10">
          {(['plan', 'actual', 'both'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setCanvasMode(mode)}
              className={`px-3 py-1 text-xs rounded-lg capitalize transition-colors ${
                canvasMode === mode
                  ? 'bg-[#141413] text-[#faf9f5]'
                  : 'text-[#5e5d59] hover:text-[#141413] hover:bg-[#f5f4ed]'
              }`}
            >
              {mode === 'both' ? 'Plan + Actual' : mode}
            </button>
          ))}
        </div>

        {/* Unscheduled tasks area */}
        <div className="px-2 py-3 border-b border-[#f0eee6]">
          <div className="text-[11px] text-[#87867f] mb-2 uppercase tracking-[0.5px]">Inbox / Unscheduled</div>
          <div className="flex flex-wrap gap-2">
            {tasks
              .filter((t) => !t.planned_start && t.status !== 'done')
              .map((task) => (
                <div
                  key={task.id}
                  className="px-2 py-1 rounded bg-white text-[#4d4c48] border border-[#e8e6dc]"
                  draggable
                  onDragStart={() => {
                    draggedTaskId = task.id
                  }}
                >
                  {task.title}
                </div>
              ))}
          </div>
        </div>

        {/* Canvas area with grid + blocks */}
        <div className="relative" style={{ height: canvasHeight }}>
          {/* Day column backgrounds */}
          <div className="absolute inset-0 flex">
            {dateRange.map((d, i) => {
              const load = dayLoad.get(i) ?? 0
              const isOvercommitted = load > OVERCOMMIT_THRESHOLD
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 border-r ${
                    d.getTime() === now.getTime() ? 'bg-[rgba(201,100,66,0.03)]' : ''
                  } ${isOvercommitted ? 'bg-[rgba(181,51,51,0.03)]' : ''}`}
                  style={{ width: DAY_WIDTH, borderColor: 'rgba(240, 238, 230, 0.6)' }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!draggedTaskId) return
                    const dropDate = getDateFromIndex(i)
                    const nextDay = getDateFromIndex(i + 1)
                    updateTask(draggedTaskId, {
                      planned_start: dropDate,
                      planned_end: nextDay,
                    })
                    draggedTaskId = null
                  }}
                />
              )
            })}
          </div>

          {/* Planned blocks */}
          {(canvasMode === 'plan' || canvasMode === 'both') &&
            plannedTasks.map((task) =>
              renderBlock(task, 'planned_start', 'planned_end', plannedRows, 0)
            )}

          {/* Actual blocks */}
          {(canvasMode === 'actual' || canvasMode === 'both') &&
            actualTasks.map((task) =>
              renderBlock(
                task,
                'actual_start',
                'actual_end',
                actualRows,
                canvasMode === 'both' ? maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP) + 20 : 0
              )
            )}

          {/* Both mode: separator label */}
          {canvasMode === 'both' && actualTasks.length > 0 && (
            <div
              className="absolute left-2 text-[10px] text-[#b0aea5] uppercase tracking-[1px]"
              style={{ top: ROW_OFFSET + maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP) + 4 }}
            >
              Actual
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface DragState {
  taskId: number
  mode: 'move' | 'resize'
  startX: number
  startIdx: number
  endIdx: number
  offsetX: number
  currentStart?: number
  currentEnd?: number
}

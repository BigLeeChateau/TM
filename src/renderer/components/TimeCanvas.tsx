import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type { MouseEvent as ReactMouseEvent, CSSProperties } from 'react'
import { useStore } from '../store'
import { useTranslation } from '../i18n'
import type { Task, Tag, UpdateTaskInput } from '../../shared/types'

const DAY_WIDTH = 80
const HEADER_HEIGHT = 56
const BLOCK_HEIGHT = 32
const BLOCK_GAP = 8
const ROW_OFFSET = 60
const OVERCOMMIT_THRESHOLD = 8
const GROUP_HEADER_HEIGHT = 28
const GROUP_GAP = 12

export function TimeCanvas() {
  const { tasks, tags, updateTask, setEditingTaskId, canvasMode, setCanvasMode, collapsedTagIds, toggleTagCollapse, expandAllTags, ganttSortBy, setGanttSortBy } = useStore()
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const draggedTaskIdRef = useRef<number | null>(null)

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
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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

  const tagById = useMemo(() => {
    const map = new Map<number, Tag>()
    for (const t of tags) map.set(t.id, t)
    return map
  }, [tags])

  const tagColor = (tid: number | null) =>
    tagById.get(tid ?? -1)?.color ?? '#4b5563'

  const { dayLoad, groups, tasksByTag, canvasHeight } = useMemo(() => {
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

    // ---- Group tasks by major tag ----
    const tasksByTag = new Map<number | null, Task[]>()
    for (const task of tasks) {
      const key = task.major_tag_id ?? null
      if (!tasksByTag.has(key)) tasksByTag.set(key, [])
      tasksByTag.get(key)!.push(task)
    }

    // ---- Sort tag groups ----
    const tagEntries = Array.from(tasksByTag.entries())
    tagEntries.sort((a, b) => {
      const [tagIdA, tasksA] = a
      const [tagIdB, tasksB] = b
      const tagA = tagById.get(tagIdA ?? -1)
      const tagB = tagById.get(tagIdB ?? -1)

      if (ganttSortBy === 'name') {
        const nameA = tagA?.name ?? t('other')
        const nameB = tagB?.name ?? t('other')
        return nameA.localeCompare(nameB)
      }
      if (ganttSortBy === 'created_at') {
        const createdA = tagA?.created_at ?? ''
        const createdB = tagB?.created_at ?? ''
        return createdB.localeCompare(createdA)
      }
      // earliest (default)
      const earliestA = Math.min(...tasksA.map((t) => {
        const ps = getDayIndex(t.planned_start)
        const as = getDayIndex(t.actual_start)
        if (ps >= 0 && as >= 0) return Math.min(ps, as)
        return ps >= 0 ? ps : (as >= 0 ? as : Infinity)
      }))
      const earliestB = Math.min(...tasksB.map((t) => {
        const ps = getDayIndex(t.planned_start)
        const as = getDayIndex(t.actual_start)
        if (ps >= 0 && as >= 0) return Math.min(ps, as)
        return ps >= 0 ? ps : (as >= 0 ? as : Infinity)
      }))
      if (earliestA === Infinity && earliestB === Infinity) return 0
      if (earliestA === Infinity) return 1
      if (earliestB === Infinity) return -1
      return earliestA - earliestB
    })

    // ---- Per-group row assignment ----
    interface GroupInfo {
      tagId: number | null
      tag: Tag | undefined
      plannedRows: Map<number, number>
      actualRows: Map<number, number>
      ghostRows: Map<number, number>
      maxPlannedRow: number
      maxActualRow: number
      maxGhostRow: number
      height: number
      yOffset: number
    }

    const groups: GroupInfo[] = []
    let currentYOffset = 0

    for (const [tagId, groupTasks] of tagEntries) {
      const planned = groupTasks.filter((t) => t.planned_start && t.planned_end)
      const actual = groupTasks.filter((t) => t.actual_start && t.actual_end)

      const plannedRows = assignRows(planned, 'planned_start', 'planned_end')
      const actualRows = assignRows(actual, 'actual_start', 'actual_end')

      const ghostTasks = groupTasks.filter((t) => t.planned_start && t.planned_end && !t.actual_start)
      const ghostRows = assignRows(ghostTasks, 'planned_start', 'planned_end')
      const maxGhost = ghostTasks.length > 0
        ? Math.max(...ghostTasks.map((t) => ghostRows.get(t.id) ?? 0)) + 1
        : 0

      const maxPlanned = planned.length > 0
        ? Math.max(...planned.map((t) => plannedRows.get(t.id) ?? 0)) + 1
        : 0
      const maxActual = Math.max(
        actual.length > 0
          ? Math.max(...actual.map((t) => actualRows.get(t.id) ?? 0)) + 1
          : 0,
        maxGhost,
      )

      const isCollapsed = collapsedTagIds.includes(tagId ?? -1)
      const taskHeight = isCollapsed
        ? 0
        : maxPlanned * (BLOCK_HEIGHT + BLOCK_GAP) + maxActual * (BLOCK_HEIGHT + BLOCK_GAP)

      const height = GROUP_HEADER_HEIGHT + taskHeight + GROUP_GAP

      groups.push({
        tagId,
        tag: tagById.get(tagId ?? -1),
        plannedRows,
        actualRows,
        ghostRows,
        maxPlannedRow: maxPlanned,
        maxActualRow: maxActual,
        maxGhostRow: maxGhost,
        height,
        yOffset: currentYOffset,
      })

      currentYOffset += height
    }

    const canvasHeight = ROW_OFFSET + currentYOffset + 40
    return { dayLoad, groups, tasksByTag, canvasHeight }
  }, [tasks, tags, ganttSortBy, collapsedTagIds])

  // ---- Drag handlers (only for planned blocks in plan/both mode) ----
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent, task: Task, mode: 'move' | 'resize', startField: 'planned_start' | 'actual_start', endField: 'planned_end' | 'actual_end', edge?: 'left' | 'right') => {
      e.preventDefault()
      const canvas = canvasRef.current
      const rect = canvas?.getBoundingClientRect()
      if (!rect || !canvas) return
      const startX = e.clientX - rect.left + canvas.scrollLeft
      const startIdx = getDayIndex(task[startField])
      const endIdx = getDayIndex(task[endField])
      setDragState({
        taskId: task.id,
        mode,
        edge,
        startField,
        endField,
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
      const x = e.clientX - rect.left + canvasRef.current.scrollLeft
      const { mode, startIdx, endIdx, offsetX, edge } = dragState

      if (mode === 'move') {
        const rawIdx = Math.round((x - offsetX) / DAY_WIDTH)
        const newStart = Math.max(0, rawIdx)
        const duration = endIdx - startIdx
        const newEnd = newStart + duration
        setDragState((s) => (s ? { ...s, currentStart: newStart, currentEnd: newEnd } : null))
      } else {
        const edgeX = edge === 'left' ? startIdx * DAY_WIDTH : endIdx * DAY_WIDTH
        const deltaX = x - edgeX
        const deltaDays = Math.sign(deltaX) * Math.round(Math.abs(deltaX) / DAY_WIDTH)
        if (edge === 'left') {
          const newStart = Math.min(endIdx - 1, Math.max(0, startIdx + deltaDays))
          setDragState((s) => (s ? { ...s, currentStart: newStart } : null))
        } else {
          const newEnd = Math.max(startIdx + 1, endIdx + deltaDays)
          setDragState((s) => (s ? { ...s, currentEnd: newEnd } : null))
        }
      }
    }

    const handleMouseUp = async () => {
      if (!dragState) return
      const { taskId, mode, currentStart, currentEnd, startField, endField } = dragState
      if (currentStart !== undefined || currentEnd !== undefined) {
        if (mode === 'move' && currentStart !== undefined) {
          const duration = dragState.endIdx - dragState.startIdx
          const newStartDate = getDateFromIndex(currentStart)
          const newEndDate = getDateFromIndex(currentStart + duration)
          await updateTask(taskId, {
            [startField]: newStartDate,
            [endField]: newEndDate,
          } as UpdateTaskInput)
        } else if (mode === 'resize') {
          if (currentStart !== undefined) {
            await updateTask(taskId, {
              [startField]: getDateFromIndex(currentStart),
            } as UpdateTaskInput)
          } else if (currentEnd !== undefined) {
            await updateTask(taskId, {
              [endField]: getDateFromIndex(currentEnd),
            } as UpdateTaskInput)
          }
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

  const getTaskStyle = (task: Task, startKey: keyof Task, endKey: keyof Task, rowMap: Map<number, number>, rowOffset: number = 0): CSSProperties => {
    const startIdx = getDayIndex(task[startKey] as string | null)
    const endIdx = getDayIndex(task[endKey] as string | null)
    const row = rowMap.get(task.id) ?? 0

    let left = startIdx * DAY_WIDTH
    let width = (endIdx - startIdx) * DAY_WIDTH

    if (dragState && dragState.taskId === task.id && startKey === dragState.startField) {
      const newStart = dragState.currentStart ?? startIdx
      const newEnd = dragState.currentEnd ?? endIdx
      left = newStart * DAY_WIDTH
      width = (newEnd - newStart) * DAY_WIDTH
    }

    return {
      position: 'absolute',
      left,
      top: rowOffset + row * (BLOCK_HEIGHT + BLOCK_GAP),
      width: Math.max(width, DAY_WIDTH),
      height: BLOCK_HEIGHT,
    }
  }

  const renderBlock = (task: Task, startKey: keyof Task, endKey: keyof Task, rowMap: Map<number, number>, rowOffset: number = 0) => {
    const isPlanned = startKey === 'planned_start'
    const startField = isPlanned ? 'planned_start' as const : 'actual_start' as const
    const endField = isPlanned ? 'planned_end' as const : 'actual_end' as const
    const isDragging = dragState?.taskId === task.id && dragState?.startField === startField

    return (
      <div
        key={`${task.id}-${String(startKey)}`}
        className={`absolute rounded-lg px-2 py-1 text-xs font-medium select-none cursor-move overflow-hidden whitespace-nowrap border transition-shadow ${
          task.status === 'done' ? 'opacity-40' : ''
        } ${isDragging ? 'shadow-lg z-20' : 'z-10'}`}
        style={{
          ...getTaskStyle(task, startKey, endKey, rowMap, rowOffset),
          backgroundColor: tagColor(task.major_tag_id) + (isPlanned ? '26' : 'ff'),
          borderColor: tagColor(task.major_tag_id) + (isPlanned ? '40' : 'ff'),
          color: isPlanned ? '#141413' : '#faf9f5',
        }}
        onMouseDown={(e) => handleMouseDown(e, task, 'move', startField, endField)}
        onDoubleClick={() => setEditingTaskId(task.id)}
      >
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group"
          onMouseDown={(e) => {
            e.stopPropagation()
            handleMouseDown(e, task, 'resize', startField, endField, 'left')
          }}
        >
          <div className="w-[3px] h-4 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity" />
        </div>

        <span className="px-4">{task.title}</span>

        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group"
          onMouseDown={(e) => {
            e.stopPropagation()
            handleMouseDown(e, task, 'resize', startField, endField, 'right')
          }}
        >
          <div className="w-[3px] h-4 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity" />
        </div>
      </div>
    )
  }

  const renderGhostBlock = (task: Task, rowMap: Map<number, number>, rowOffset: number = 0) => {
    const startIdx = getDayIndex(task.planned_start)
    const endIdx = getDayIndex(task.planned_end)
    const row = rowMap.get(task.id) ?? 0

    return (
      <div
        key={`${task.id}-ghost`}
        className="absolute rounded-lg px-2 py-1 text-xs font-medium select-none overflow-hidden whitespace-nowrap border border-dashed cursor-pointer transition-shadow z-10"
        style={{
          position: 'absolute',
          left: startIdx * DAY_WIDTH,
          top: rowOffset + row * (BLOCK_HEIGHT + BLOCK_GAP),
          width: Math.max((endIdx - startIdx) * DAY_WIDTH, DAY_WIDTH),
          height: BLOCK_HEIGHT,
          backgroundColor: tagColor(task.major_tag_id) + '10',
          borderColor: tagColor(task.major_tag_id) + '4d',
          color: '#141413',
          opacity: 0.5,
        }}
        onDoubleClick={() => setEditingTaskId(task.id)}
      >
        <span className="px-4">{task.title}</span>
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
              {mode === 'both' ? t('planActual') : t(mode === 'plan' ? 'plan' : 'actual')}
            </button>
          ))}
        </div>

        {/* Toolbar: sort + expand all */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f0eee6] bg-[#faf9f5]">
          <select
            value={ganttSortBy}
            onChange={(e) => setGanttSortBy(e.target.value as GanttSortBy)}
            className="px-2 py-1 text-xs rounded-lg border border-[#e8e6dc] bg-white text-[#141413] focus:outline-none focus:border-[#3898ec]"
          >
            <option value="earliest">{t('sortEarliest')}</option>
            <option value="name">{t('sortName')}</option>
            <option value="created_at">{t('sortCreated')}</option>
          </select>
          <button
            onClick={expandAllTags}
            className="px-2 py-1 text-xs rounded-lg border border-[#e8e6dc] bg-white text-[#5e5d59] hover:text-[#141413] hover:bg-[#f5f4ed] transition-colors"
          >
            {t('expandAll')}
          </button>
        </div>

        {/* Unscheduled tasks area */}
        <div className="px-2 py-3 border-b border-[#f0eee6]">
          <div className="text-[11px] text-[#87867f] mb-2 uppercase tracking-[0.5px]">{t('inboxUnscheduled')}</div>
          <div className="flex flex-wrap gap-2">
            {tasks
              .filter((t) => !t.planned_start && t.status !== 'done')
              .map((task) => (
                <div
                  key={task.id}
                  className="px-2 py-1 rounded bg-white text-[#4d4c48] border border-[#e8e6dc]"
                  draggable
                  onDragStart={() => {
                    draggedTaskIdRef.current = task.id
                  }}
                >
                  {task.title}
                </div>
              ))}
          </div>
        </div>

        {/* Canvas area with grid + grouped blocks */}
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
                    if (!draggedTaskIdRef.current) return
                    const dropDate = getDateFromIndex(i)
                    const nextDay = getDateFromIndex(i + 1)
                    updateTask(draggedTaskIdRef.current, {
                      planned_start: dropDate,
                      planned_end: nextDay,
                    })
                    draggedTaskIdRef.current = null
                  }}
                />
              )
            })}
          </div>

          {/* Tag groups */}
          {groups.map((group) => {
            const isCollapsed = collapsedTagIds.includes(group.tagId ?? -1)
            const groupTop = ROW_OFFSET + group.yOffset
            const taskAreaTop = groupTop + GROUP_HEADER_HEIGHT

            return (
              <div key={group.tagId ?? 'none'}>
                {/* Group header */}
                <div
                  className="absolute left-0 right-0 flex items-center gap-2 px-3 cursor-pointer select-none hover:bg-[rgba(0,0,0,0.02)]"
                  style={{
                    top: groupTop,
                    height: GROUP_HEADER_HEIGHT,
                  }}
                  onClick={() => toggleTagCollapse(group.tagId ?? -1)}
                >
                  <span className="text-[10px] text-[#87867f]">
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.tag?.color ?? '#87867f' }}
                  />
                  <span className="text-[11px] font-bold text-[#141413]">
                    {group.tag?.name ?? t('other')}
                  </span>
                  {isCollapsed && (
                    <span className="text-[10px] text-[#b0aea5]">
                      ({group.plannedRows.size + group.actualRows.size} tasks hidden)
                    </span>
                  )}
                </div>

                {/* Task blocks */}
                {!isCollapsed && (
                  <>
                    {(canvasMode === 'plan' || canvasMode === 'both') &&
                      Array.from(tasksByTag.get(group.tagId) ?? [])
                        .filter((t) => t.planned_start && t.planned_end)
                        .map((task) =>
                          renderBlock(task, 'planned_start', 'planned_end', group.plannedRows, taskAreaTop)
                        )}

                    {(canvasMode === 'actual' || canvasMode === 'both') && (
                      <>
                        {Array.from(tasksByTag.get(group.tagId) ?? [])
                          .filter((t) => t.actual_start && t.actual_end)
                          .map((task) =>
                            renderBlock(
                              task,
                              'actual_start',
                              'actual_end',
                              group.actualRows,
                              taskAreaTop + group.maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP)
                            )
                          )}
                        {/* Ghost blocks for planned-but-not-started tasks */}
                        {Array.from(tasksByTag.get(group.tagId) ?? [])
                          .filter((t) => t.planned_start && t.planned_end && !t.actual_start)
                          .map((task) =>
                            renderGhostBlock(
                              task,
                              group.ghostRows,
                              taskAreaTop + group.maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP)
                            )
                          )}
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type GanttSortBy = 'earliest' | 'name' | 'created_at'

interface DragState {
  taskId: number
  mode: 'move' | 'resize'
  edge?: 'left' | 'right'
  startField: 'planned_start' | 'actual_start'
  endField: 'planned_end' | 'actual_end'
  startX: number
  startIdx: number
  endIdx: number
  offsetX: number
  currentStart?: number
  currentEnd?: number
}

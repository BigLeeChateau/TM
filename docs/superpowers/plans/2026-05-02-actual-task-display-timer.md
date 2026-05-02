# Actual Task Display, Timer Auto-Set, and Date Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show planned-but-not-started tasks as ghost blocks in actual Gantt mode; prevent future actual dates; auto-set actual dates on timer stop.

**Architecture:** A new shared module `actual-date-utils.ts` centralizes timezone-safe date formatting, validation, and timer-to-actual conversion. TimeCanvas renders ghost blocks; TaskModal adds UI validation and read-only states; IPC handlers enforce server-side validation and timer auto-write.

**Tech Stack:** React, TypeScript, Tailwind CSS, better-sqlite3, Electron IPC

---

## File Structure

| File | Responsibility |
|------|--------------|
| `src/shared/actual-date-utils.ts` (new) | Timezone-safe `getTodayLocal()`, `validateActualDates()`, `computeActualDatesFromTimer()` |
| `src/main/ipc.ts` (modify) | `toggleTaskTimer` auto-writes actual dates on stop; `updateTask` validates actual dates |
| `src/renderer/components/TaskModal.tsx` (modify) | `max={today}` on date inputs; actual_start read-only when set; frontend validation |
| `src/renderer/components/TimeCanvas.tsx` (modify) | Render ghost blocks for planned-but-not-started tasks in actual/both mode |
| `src/renderer/dev-mock.ts` (modify) | Mock `toggleTaskTimer` auto-sets actual dates; mock `updateTask` validates dates |

---

### Task 1: Create `src/shared/actual-date-utils.ts`

**Files:**
- Create: `src/shared/actual-date-utils.ts`

- [ ] **Step 1: Write the module**

  ```typescript
  export function getTodayLocal(): string {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  export function validateActualDates(
    start?: string | null,
    end?: string | null,
  ): { valid: boolean; error?: string } {
    const today = getTodayLocal()

    if (start && start > today) {
      return { valid: false, error: 'Actual start cannot be in the future' }
    }
    if (end && end > today) {
      return { valid: false, error: 'Actual end cannot be in the future' }
    }
    if (start && end && end < start) {
      return { valid: false, error: 'Actual end cannot be before actual start' }
    }
    return { valid: true }
  }

  export function computeActualDatesFromTimer(
    timerStartedAt: string,
    timerStoppedAt: string,
  ): { actual_start: string; actual_end: string } {
    const start = new Date(timerStartedAt)
    const end = new Date(timerStoppedAt)
    return {
      actual_start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      actual_end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    }
  }
  ```

- [ ] **Step 2: Verify compilation**

  Run: `bun run build:main && bun run build:preload`
  Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/actual-date-utils.ts
  git commit -m "feat: add actual-date-utils shared module"
  ```

---

### Task 2: Update IPC `toggleTaskTimer` to auto-set actual dates on stop

**Files:**
- Modify: `src/main/ipc.ts:203-249`

- [ ] **Step 1: Add import for computeActualDatesFromTimer**

  At the top of `src/main/ipc.ts`, add:
  ```typescript
  import { getTodayLocal, computeActualDatesFromTimer } from '../shared/actual-date-utils'
  ```

- [ ] **Step 2: Replace the timer stop branch in toggleTaskTimer**

  In `src/main/ipc.ts`, inside the `toggleTaskTimer` handler, replace the timer-running (stop) branch (around lines 210-229) with:

  ```typescript
  if (task.timer_running) {
    const startedAt = new Date(task.timer_started_at!)
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

    // Auto-set actual dates from timer
    const { actual_start, actual_end } = computeActualDatesFromTimer(
      task.timer_started_at!,
      now.toISOString(),
    )
    const actualDuration = computeDuration(actual_start, actual_end)

    db.prepare(`
      UPDATE tasks
      SET timer_running = 0, timer_started_at = NULL, timer_accumulated = timer_accumulated + ?,
          actual_start = ?, actual_end = ?, actual_duration = ?
      WHERE id = ?
    `).run(elapsedSeconds, actual_start, actual_end, actualDuration, id)
  } else {
  ```

  Note: the `else` branch (timer start) stays unchanged.

- [ ] **Step 3: Verify compilation**

  Run: `bun run build:main && bun run build:preload`
  Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/main/ipc.ts
  git commit -m "feat: auto-set actual dates when timer stops"
  ```

---

### Task 3: Add server-side actual date validation to `updateTask`

**Files:**
- Modify: `src/main/ipc.ts:128-169`

- [ ] **Step 1: Add import for validateActualDates**

  Update the import line from Task 2 to also include `validateActualDates`:
  ```typescript
  import { getTodayLocal, validateActualDates, computeActualDatesFromTimer } from '../shared/actual-date-utils'
  ```

- [ ] **Step 2: Insert validation before the update in updateTask**

  In `src/main/ipc.ts`, inside the `updateTask` handler, after building `effectiveData` and before the `for (const field of fields)` loop, add:

  ```typescript
    // Validate actual dates
    const actualStartValue = effectiveData.actual_start !== undefined ? effectiveData.actual_start : oldTask.actual_start
    const actualEndValue = effectiveData.actual_end !== undefined ? effectiveData.actual_end : oldTask.actual_end
    const validation = validateActualDates(actualStartValue, actualEndValue)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
  ```

  This validates the resulting actual dates after the update (including fields not being changed).

- [ ] **Step 3: Verify compilation**

  Run: `bun run build:main && bun run build:preload`
  Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/main/ipc.ts
  git commit -m "feat: validate actual dates server-side in updateTask"
  ```

---

### Task 4: Update TaskModal for date validation and actual_start read-only

**Files:**
- Modify: `src/renderer/components/TaskModal.tsx`

- [ ] **Step 1: Add import for actual-date-utils**

  At the top of `src/renderer/components/TaskModal.tsx`, add:
  ```typescript
  import { getTodayLocal, validateActualDates } from '../../shared/actual-date-utils'
  ```

- [ ] **Step 2: Add validation state and helper**

  After the existing state declarations (around line 52), add:
  ```typescript
  const [validationError, setValidationError] = useState<string | null>(null)
  ```

  Replace `handleSave` (around line 109) with:
  ```typescript
  const handleSave = async () => {
    const validation = validateActualDates(
      actualStart || null,
      actualEnd || null,
    )
    if (!validation.valid) {
      setValidationError(validation.error!)
      return
    }
    setValidationError(null)

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
    const secondaryIds = secondaryTagIds.filter((id) => id !== majorTagId)
    await window.electronAPI.setTaskTags(task.id, secondaryIds)
    onClose()
  }
  ```

- [ ] **Step 3: Update actual date inputs with max and read-only**

  Replace the actual start input (around line 319) with:
  ```tsx
  <input
    type="date"
    value={actualStart}
    max={getTodayLocal()}
    readOnly={!!task.actual_start}
    onChange={(e) => setActualStart(e.target.value)}
    className={`w-full px-3 py-2 border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5] ${task.actual_start ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
  />
  ```

  Replace the actual end input (around line 329) with:
  ```tsx
  <input
    type="date"
    value={actualEnd}
    max={getTodayLocal()}
    onChange={(e) => setActualEnd(e.target.value)}
    className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
  />
  ```

- [ ] **Step 4: Add read-only label for actual_start**

  After the actual start input's `</div>` (around line 325), add a conditional label:
  ```tsx
  {task.actual_start && (
    <span className="text-[10px] text-[#87867f] mt-0.5">{t('actualStartLocked')}</span>
  )}
  ```

- [ ] **Step 5: Add validation error display**

  Inside the actual dates section, before the grid (around line 316), add:
  ```tsx
  {validationError && (
    <div className="text-[11px] text-[#b53333] mb-2">{validationError}</div>
  )}
  ```

- [ ] **Step 6: Disable save button when validation fails**

  Update the save button (around line 416) to also disable on validation error:
  ```tsx
  <button
    onClick={handleSave}
    disabled={!title.trim() || !!validationError}
    className="px-4 py-1.5 text-sm bg-[#c96442] text-[#faf9f5] rounded-lg hover:bg-[#d97757] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {t('save')}
  </button>
  ```

  Note: `validationError` clears on successful validation in `handleSave`, so the button re-enables when the user fixes the dates.

- [ ] **Step 7: Verify compilation**

  Run: `bun run build:main && bun run build:preload`
  Expected: No TypeScript errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/renderer/components/TaskModal.tsx
  git commit -m "feat: actual date validation and read-only actual_start in TaskModal"
  ```

---

### Task 5: Add ghost block rendering to TimeCanvas

**Files:**
- Modify: `src/renderer/components/TimeCanvas.tsx`

- [ ] **Step 1: Add ghostRows computation in the useMemo**

  In the `useMemo` that computes groups (around line 85), after computing `actualRows`, add ghost rows computation:

  ```typescript
  const ghostTasks = groupTasks.filter((t) => t.planned_start && t.planned_end && !t.actual_start)
  const ghostRows = assignRows(ghostTasks, 'planned_start', 'planned_end')
  const maxGhost = ghostTasks.length > 0
    ? Math.max(...ghostTasks.map((t) => ghostRows.get(t.id) ?? 0)) + 1
    : 0
  ```

  Update `maxActual` to include ghost rows:
  ```typescript
  const maxActual = Math.max(
    actual.length > 0
      ? Math.max(...actual.map((t) => actualRows.get(t.id) ?? 0)) + 1
      : 0,
    maxGhost,
  )
  ```

  Add `ghostRows` and `maxGhostRow` to the `GroupInfo` interface and group object:
  ```typescript
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
  ```

  In the push to `groups`:
  ```typescript
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
  ```

- [ ] **Step 2: Add renderGhostBlock function**

  After `renderBlock` (around line 370), add:

  ```typescript
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
  ```

- [ ] **Step 3: Render ghost blocks in the JSX**

  In the actual block rendering section (around line 535), add ghost block rendering:

  ```tsx
  {(canvasMode === 'actual' || canvasMode === 'both') && (
    <>
      {Array.from(tasksByTag.get(group.tagId) ?? [])
        .filter((t) => t.actual_start && t.actual_end)
        .map((task) =>
          renderBlock(task, 'actual_start', 'actual_end', group.actualRows, taskAreaTop + group.maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP))
        )}
      {/* Ghost blocks for planned-but-not-started tasks */}
      {Array.from(tasksByTag.get(group.tagId) ?? [])
        .filter((t) => t.planned_start && t.planned_end && !t.actual_start)
        .map((task) =>
          renderGhostBlock(task, group.ghostRows, taskAreaTop + group.maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP))
        )}
    </>
  )}
  ```

- [ ] **Step 4: Verify compilation**

  Run: `bun run build:main && bun run build:preload`
  Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/components/TimeCanvas.tsx
  git commit -m "feat: render ghost blocks for planned-but-not-started tasks in actual mode"
  ```

---

### Task 6: Update dev-mock.ts for consistency

**Files:**
- Modify: `src/renderer/dev-mock.ts`

- [ ] **Step 1: Add import for actual-date-utils**

  At the top of `src/renderer/dev-mock.ts`, add:
  ```typescript
  import { getTodayLocal, validateActualDates, computeActualDatesFromTimer } from '../shared/actual-date-utils'
  ```

- [ ] **Step 2: Update mock updateTask to validate actual dates**

  In the `updateTask` function (around line 132), after building `effectiveData`, before `Object.assign`, add:

  ```typescript
  const actualStartValue = effectiveData.actual_start !== undefined ? effectiveData.actual_start : t.actual_start
  const actualEndValue = effectiveData.actual_end !== undefined ? effectiveData.actual_end : t.actual_end
  const validation = validateActualDates(actualStartValue, actualEndValue)
  if (!validation.valid) {
    throw new Error(validation.error)
  }
  ```

- [ ] **Step 3: Update mock toggleTaskTimer to auto-set actual dates on stop**

  In the `toggleTaskTimer` function (around line 184), replace the timer stop branch with:

  ```typescript
  if (t.timer_running) {
    const entry = mockTimeEntries.find((e) => e.task_id === taskId && !e.ended_at)
    if (entry) {
      const startedAt = new Date(entry.started_at)
      const now = new Date()
      const elapsed = Math.round((now.getTime() - startedAt.getTime()) / 1000)
      entry.ended_at = now.toISOString()
      entry.duration_seconds = elapsed
      t.timer_accumulated += elapsed

      // Auto-set actual dates
      const { actual_start, actual_end } = computeActualDatesFromTimer(entry.started_at, now.toISOString())
      t.actual_start = actual_start
      t.actual_end = actual_end
      t.actual_duration = Math.max(1, Math.round((new Date(actual_end).getTime() - new Date(actual_start).getTime()) / (1000 * 60 * 60 * 24))) * 8
    }
    t.timer_running = 0
    t.timer_started_at = null
  } else {
  ```

  The `else` branch (timer start) stays unchanged.

- [ ] **Step 4: Verify compilation**

  Run: `bun run build:main && bun run build:preload`
  Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/dev-mock.ts
  git commit -m "feat: update mock API for actual date auto-set and validation"
  ```

---

### Task 7: Manual verification in dev environment

**Files:**
- None (runtime verification)

- [ ] **Step 1: Start the dev server**

  Run: `bun run dev`
  Wait for Electron window to open.

- [ ] **Step 2: Verify ghost blocks appear**

  1. Create a task with planned start/end dates but no actual dates
  2. Switch Gantt to "actual" or "both" mode
  3. Expected: a dashed-border ghost block appears at the planned position
  4. Click on the ghost block → TaskModal opens

- [ ] **Step 3: Verify future date prevention in TaskModal**

  1. Open TaskModal for any task
  2. Try to select tomorrow in actual_start or actual_end
  3. Expected: date picker does not allow selection (max={today})

- [ ] **Step 4: Verify actual_start read-only**

  1. Open TaskModal for a task that already has actual_start set
  2. Expected: actual_start field is grayed out and read-only

- [ ] **Step 5: Verify timer auto-set**

  1. Create a task with no actual dates
  2. Open TaskModal, click "Start Timer"
  3. Wait a few seconds, click "Stop Timer"
  4. Re-open TaskModal
  5. Expected: actual_start shows the date when timer started; actual_end shows today

- [ ] **Step 6: Verify server-side validation**

  1. Try to bypass UI and send a future actual date (e.g., via console `window.electronAPI.updateTask(id, { actual_end: '2099-01-01' })`)
  2. Expected: Promise rejects with validation error

- [ ] **Step 7: Verify undo still works**

  1. Start timer, stop timer (auto-sets actual dates)
  2. Press Cmd+Z (Ctrl+Z)
  3. Expected: actual dates revert to previous state

- [ ] **Step 8: Commit verification**

  ```bash
  git add -A
  git commit -m "test: manual verification of actual task display and timer auto-set"
  ```

---

## Self-Review

**1. Spec coverage:**

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| Ghost block for planned-but-not-started tasks | Task 5 |
| Ghost block styling (dashed, transparent, no drag) | Task 5, Step 2 |
| actual dates cannot be in future — UI | Task 4, Step 3 (`max={today}`) |
| actual dates cannot be in future — server | Task 3 |
| actual_start read-only once set | Task 4, Step 3 (`readOnly={!!task.actual_start}`) |
| Timer stop auto-sets actual_start and actual_end | Task 2 |
| Timer overrides existing actual_start | Task 2 (always writes on stop) |
| actual_end can be changed anytime | Task 4, Step 3 (no readOnly on actualEnd) |
| Timezone-safe date formatting | Task 1 (`getTodayLocal`, `computeActualDatesFromTimer`) |

All spec requirements covered. No gaps.

**2. Placeholder scan:**

- No "TBD", "TODO", "implement later", "fill in details" found.
- All code blocks contain complete, copy-pasteable code.
- No vague requirements.

**3. Type consistency:**

- `getTodayLocal(): string` used in Task 4 (`max={getTodayLocal()}`) and Task 2 (indirectly via `computeActualDatesFromTimer`)
- `validateActualDates()` signature consistent between Task 1 (definition), Task 3 (IPC usage), and Task 4 (TaskModal usage)
- `computeActualDatesFromTimer()` used in Task 2 (IPC) and Task 6 (dev-mock)
- All good.

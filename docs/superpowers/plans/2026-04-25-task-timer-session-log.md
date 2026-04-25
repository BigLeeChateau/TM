# Task Timer + Session Log + Project Rollup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-task timer tracking with a full session log, live elapsed display in TaskList, and project-level time rollup in ProjectList.

**Architecture:** A `time_entries` table stores every start/stop session. Tasks get three new fields (`timer_running`, `timer_started_at`, `timer_accumulated`) for fast UI state. Toggling the timer creates or closes a time_entries row and updates the task. Project rollup sums `timer_accumulated` plus any running session elapsed time. Dev-mock mirrors everything in localStorage.

**Tech Stack:** Electron, better-sqlite3, React, Zustand, TypeScript, Tailwind CSS

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/shared/types.ts` | `TimeEntry` interface; add timer fields to `Task` |
| `src/main/database.ts` | `time_entries` table schema; migrate timer columns onto existing `tasks` |
| `src/main/ipc.ts` | `toggleTaskTimer`, `listTimeEntries`, `getProjectTimeSummary` handlers |
| `src/preload/index.ts` | Expose new IPC methods on `window.electronAPI` |
| `src/renderer/store.ts` | Add time entries state, timer actions, project summary loading |
| `src/renderer/dev-mock.ts` | Mirror all new IPC methods with localStorage-backed mocks |
| `src/renderer/components/TaskList.tsx` | Timer toggle button + live elapsed display per task |
| `src/renderer/components/ProjectList.tsx` | Show total hours next to each project |
| `src/renderer/components/TaskModal.tsx` | Session log table + timer toggle + total time |

---

## Task 1: Data Model

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/database.ts`

### Step 1: Add TimeEntry type and update Task

In `src/shared/types.ts`, add after the `UndoEntry` interface:

```typescript
export interface TimeEntry {
  id: number
  task_id: number
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  created_at: string
}
```

Add timer fields to the existing `Task` interface (after `created_at`):

```typescript
export interface Task {
  // ... existing fields unchanged
  created_at: string
  timer_running: number
  timer_started_at: string | null
  timer_accumulated: number
}
```

### Step 2: Create time_entries table and migrate timer columns

In `src/main/database.ts`, inside `createTables()`, add after the existing table creation:

```sql
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
```

Add a migration function after `migrateTasksForeignKey`:

```typescript
function migrateTimerColumns(): void {
  const db = getDb()
  const cols = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
  const hasTimer = cols.some((c) => c.name === 'timer_running')
  if (!hasTimer) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN timer_running INTEGER DEFAULT 0;
      ALTER TABLE tasks ADD COLUMN timer_started_at TEXT;
      ALTER TABLE tasks ADD COLUMN timer_accumulated INTEGER DEFAULT 0;
    `)
  }
}
```

Call `migrateTimerColumns()` in `initDatabase()` after `ensureDefaultProject()`.

### Step 3: Update dev-mock createTask defaults

In `src/renderer/dev-mock.ts`, inside `createTask()`, add these fields to the created task object:

```typescript
timer_running: 0,
timer_started_at: null,
timer_accumulated: 0,
```

---

## Task 2: IPC Handlers (main)

**Files:**
- Modify: `src/main/ipc.ts`

Import `TimeEntry` from shared types.

### Step 1: toggleTaskTimer handler

Add inside `registerIpcHandlers()`:

```typescript
ipcMain.handle('toggleTaskTimer', (_event, taskId: number): Task => {
  const db = getDb()
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined
  if (!task) throw new Error(`Task ${taskId} not found`)

  if (task.timer_running) {
    const startedAt = new Date(task.timer_started_at!)
    const now = new Date()
    const elapsedSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000)

    db.prepare(`
      UPDATE time_entries
      SET ended_at = ?, duration_seconds = ?
      WHERE task_id = ? AND ended_at IS NULL
    `).run(now.toISOString(), elapsedSeconds, taskId)

    db.prepare(`
      UPDATE tasks
      SET timer_running = 0, timer_started_at = NULL, timer_accumulated = timer_accumulated + ?
      WHERE id = ?
    `).run(elapsedSeconds, taskId)
  } else {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO time_entries (task_id, started_at) VALUES (?, ?)
    `).run(taskId, now)

    db.prepare(`
      UPDATE tasks
      SET timer_running = 1, timer_started_at = ?
      WHERE id = ?
    `).run(now, taskId)
  }

  snapshotDatabase()
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task
})
```

### Step 2: listTimeEntries handler

```typescript
ipcMain.handle('listTimeEntries', (_event, taskId: number): TimeEntry[] => {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM time_entries WHERE task_id = ? ORDER BY started_at DESC
  `).all(taskId) as TimeEntry[]
})
```

### Step 3: getProjectTimeSummary handler

```typescript
ipcMain.handle('getProjectTimeSummary', (_event, projectId: number): { total_seconds: number } => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT timer_running, timer_started_at, timer_accumulated
    FROM tasks
    WHERE project_id = ? AND deleted_at IS NULL
  `).all(projectId) as { timer_running: number; timer_started_at: string | null; timer_accumulated: number }[]

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
```

---

## Task 3: Preload API

**Files:**
- Modify: `src/preload/index.ts`

Import `TimeEntry` from shared types. Add to the `api` object:

```typescript
toggleTaskTimer: (taskId: number): Promise<Task> =>
  ipcRenderer.invoke('toggleTaskTimer', taskId),
listTimeEntries: (taskId: number): Promise<TimeEntry[]> =>
  ipcRenderer.invoke('listTimeEntries', taskId),
getProjectTimeSummary: (projectId: number): Promise<{ total_seconds: number }> =>
  ipcRenderer.invoke('getProjectTimeSummary', projectId),
```

---

## Task 4: Zustand Store

**Files:**
- Modify: `src/renderer/store.ts`

Import `TimeEntry`. Add to `AppState` interface:

```typescript
timeEntries: Record<number, TimeEntry[]>
projectTimeSummaries: Record<number, number>

toggleTaskTimer: (taskId: number) => Promise<void>
loadTimeEntries: (taskId: number) => Promise<void>
```

Add to initial state:

```typescript
timeEntries: {},
projectTimeSummaries: {},
```

Add actions:

```typescript
toggleTaskTimer: async (taskId) => {
  const updated = await window.electronAPI.toggleTaskTimer(taskId)
  set((s) => ({
    tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
  }))
  const entries = await window.electronAPI.listTimeEntries(taskId)
  set((s) => ({
    timeEntries: { ...s.timeEntries, [taskId]: entries },
  }))
  if (updated.project_id != null) {
    const result = await window.electronAPI.getProjectTimeSummary(updated.project_id)
    set((s) => ({
      projectTimeSummaries: { ...s.projectTimeSummaries, [updated.project_id!]: result.total_seconds },
    }))
  }
},

loadTimeEntries: async (taskId) => {
  const entries = await window.electronAPI.listTimeEntries(taskId)
  set((s) => ({
    timeEntries: { ...s.timeEntries, [taskId]: entries },
  }))
},
```

Update `loadProjects` to also fetch summaries:

```typescript
loadProjects: async () => {
  const projects = await window.electronAPI.listProjects()
  set({ projects })
  const summaries: Record<number, number> = {}
  for (const p of projects) {
    const result = await window.electronAPI.getProjectTimeSummary(p.id)
    summaries[p.id] = result.total_seconds
  }
  set({ projectTimeSummaries: summaries })
},
```

---

## Task 5: Dev Mock

**Files:**
- Modify: `src/renderer/dev-mock.ts`

Add time entries state at the top (after `nextTaskId`):

```typescript
let mockTimeEntries: TimeEntry[] = initial.timeEntries ?? []
let nextTimeEntryId = initial.nextTimeEntryId ?? 1
```

Update `saveMockData`:

```typescript
function saveMockData() {
  localStorage.setItem('tm_mock_data', JSON.stringify({
    projects: mockProjects,
    tasks: mockTasks,
    timeEntries: mockTimeEntries,
    nextProjectId,
    nextTaskId,
    nextTimeEntryId,
  }))
}
```

Add handlers:

```typescript
function toggleTaskTimer(taskId: number): Promise<Task> {
  const t = mockTasks.find((x) => x.id === taskId)
  if (!t) throw new Error('Not found')

  if (t.timer_running) {
    const entry = mockTimeEntries.find((e) => e.task_id === taskId && !e.ended_at)
    if (entry) {
      const startedAt = new Date(entry.started_at)
      const now = new Date()
      const elapsed = Math.round((now.getTime() - startedAt.getTime()) / 1000)
      entry.ended_at = now.toISOString()
      entry.duration_seconds = elapsed
      t.timer_accumulated += elapsed
    }
    t.timer_running = 0
    t.timer_started_at = null
  } else {
    mockTimeEntries.push({
      id: nextTimeEntryId++,
      task_id: taskId,
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_seconds: null,
      created_at: new Date().toISOString(),
    })
    t.timer_running = 1
    t.timer_started_at = new Date().toISOString()
  }
  saveMockData()
  return Promise.resolve(t)
}

function listTimeEntries(taskId: number): Promise<TimeEntry[]> {
  return Promise.resolve(
    mockTimeEntries
      .filter((e) => e.task_id === taskId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  )
}

function getProjectTimeSummary(projectId: number): Promise<{ total_seconds: number }> {
  let total = 0
  const tasks = mockTasks.filter((t) => t.project_id === projectId)
  for (const t of tasks) {
    total += t.timer_accumulated
    if (t.timer_running && t.timer_started_at) {
      const elapsed = Math.round((new Date().getTime() - new Date(t.timer_started_at).getTime()) / 1000)
      total += elapsed
    }
  }
  return Promise.resolve({ total_seconds: total })
}
```

Export them:

```typescript
export const mockElectronAPI = {
  // ... existing exports
  toggleTaskTimer,
  listTimeEntries,
  getProjectTimeSummary,
}
```

---

## Task 6: TaskList Timer UI

**Files:**
- Modify: `src/renderer/components/TaskList.tsx`

### Step 1: Add format helper

At the top of the file (outside the component):

```typescript
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

### Step 2: Add TimerDisplay sub-component

After the helper, before `TaskList`:

```typescript
function TimerDisplay({ task }: { task: Task }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!task.timer_running || !task.timer_started_at) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [task.timer_running, task.timer_started_at])

  let total = task.timer_accumulated
  if (task.timer_running && task.timer_started_at) {
    total += Math.round((Date.now() - new Date(task.timer_started_at).getTime()) / 1000)
  }

  if (total === 0) return null

  return (
    <span className="text-xs text-[#b0aea5] flex-shrink-0 font-mono tabular-nums">
      {formatDuration(total)}
    </span>
  )
}
```

Import `useEffect` and `useState` from React if not already.

### Step 3: Wire timer toggle and display into task rows

In `TaskList`, add `toggleTaskTimer` to the destructured store:

```typescript
const { toggleTaskTimer } = useStore()
```

Inside the task map, insert the timer button and display between the status dot and the title:

```tsx
<button
  onClick={() => toggleTaskTimer(task.id)}
  className={`text-[10px] flex-shrink-0 w-4 h-4 flex items-center justify-center rounded ${
    task.timer_running
      ? 'text-[#c96442]'
      : 'text-[#b0aea5] hover:text-[#c96442]'
  }`}
  title={task.timer_running ? 'Stop timer' : 'Start timer'}
>
  {task.timer_running ? '⏸' : '▶'}
</button>

<span ...>{task.title}</span>

<TimerDisplay task={task} />
```

---

## Task 7: ProjectList Rollup UI

**Files:**
- Modify: `src/renderer/components/ProjectList.tsx`

### Step 1: Add format helper

```typescript
function formatHours(totalSeconds: number): string {
  const hours = (totalSeconds / 3600).toFixed(1)
  return `${hours}h`
}
```

### Step 2: Display total hours per project

Add `projectTimeSummaries` to the store destructuring:

```typescript
const { projectTimeSummaries } = useStore()
```

Inside the project button, after the project name, add:

```tsx
<span className="truncate flex-1">{project.name}</span>
{projectTimeSummaries[project.id] > 0 && (
  <span className="text-xs text-[#b0aea5] flex-shrink-0 font-mono tabular-nums">
    {formatHours(projectTimeSummaries[project.id])}
  </span>
)}
```

---

## Task 8: TaskModal Session Log

**Files:**
- Modify: `src/renderer/components/TaskModal.tsx`

### Step 1: Load time entries

Import `useEffect` if not already. Add to store destructuring:

```typescript
const { timeEntries, loadTimeEntries, toggleTaskTimer } = useStore()
```

Add an effect to load entries when the task changes:

```typescript
useEffect(() => {
  if (task) {
    loadTimeEntries(task.id)
  }
}, [task?.id])
```

Read entries for this task:

```typescript
const entries = timeEntries[task?.id ?? -1] ?? []
```

### Step 2: Compute total time with live update

Add state for live ticking:

```typescript
const [timerTick, setTimerTick] = useState(0)

useEffect(() => {
  if (!task?.timer_running) return
  const id = setInterval(() => setTimerTick((t) => t + 1), 1000)
  return () => clearInterval(id)
}, [task?.timer_running])
```

Compute total:

```typescript
let totalTimerSeconds = task?.timer_accumulated ?? 0
if (task?.timer_running && task?.timer_started_at) {
  totalTimerSeconds += Math.round((Date.now() - new Date(task.timer_started_at).getTime()) / 1000)
}
```

### Step 3: Add session log section

After the Actual Time section closing `</div>`, add:

```tsx
{/* Session Log */}
<div className="border-t border-[#f0eee6] pt-3">
  <div className="flex items-center justify-between mb-2">
    <span className="text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">
      Session Log
    </span>
    <button
      onClick={() => toggleTaskTimer(task.id)}
      className={`px-2.5 py-1 text-xs rounded-lg transition-colors font-medium ${
        task.timer_running
          ? 'bg-[#c96442] text-[#faf9f5] hover:bg-[#d97757]'
          : 'bg-[#e8e6dc] text-[#4d4c48] hover:bg-[#d1cfc5]'
      }`}
    >
      {task.timer_running ? 'Stop Timer' : 'Start Timer'}
    </button>
  </div>

  {entries.length === 0 ? (
    <p className="text-sm text-[#b0aea5]">No sessions recorded</p>
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
              : 'Running...'}
          </span>
        </div>
      ))}
    </div>
  )}

  {totalTimerSeconds > 0 && (
    <div className="mt-2 pt-2 border-t border-[#f0eee6] flex items-center justify-between">
      <span className="text-sm font-medium text-[#4d4c48]">Total</span>
      <span className="text-sm font-medium text-[#c96442] font-mono tabular-nums">
        {formatDuration(totalTimerSeconds)}
      </span>
    </div>
  )}
</div>
```

Add the `formatDuration` helper at the top of the file if not already present from TaskList (they are separate files, so duplicate it here or import from a shared util). For the plan, add it inline:

```typescript
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

---

## Task 9: Verification

- [ ] **Step 1: Timer start/stop**
  1. Open app, create a task.
  2. In TaskList, click the ▶ button → button changes to ⏸, elapsed time appears and ticks every second.
  3. Wait 5 seconds, click ⏸ → timer stops, accumulated time is saved.
  4. Reopen TaskModal → Session Log shows one entry with ~5s duration. Total shows ~5s.

- [ ] **Step 2: Multiple sessions**
  1. Start timer again on the same task.
  2. Wait 3 seconds, stop.
  3. TaskModal shows two sessions. Total shows ~8s.

- [ ] **Step 3: Project rollup**
  1. Assign the timed task to a project.
  2. ProjectList shows the project with `0.0h` (or actual hours if accumulated).
  3. Start timer on another task in the same project.
  4. ProjectList total updates live.

- [ ] **Step 4: Dev mock**
  1. Open in browser dev mode.
  2. Clear localStorage, reload.
  3. Create task, toggle timer → works identically to Electron.
  4. Reload page → timer state and session log persist.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/main/database.ts src/main/ipc.ts src/preload/index.ts src/renderer/store.ts src/renderer/dev-mock.ts src/renderer/components/TaskList.tsx src/renderer/components/ProjectList.tsx src/renderer/components/TaskModal.tsx
git commit -m "feat: per-task timer with session log and project time rollup"
```

---

## Spec Coverage Check

| Requirement | Task |
|------------|------|
| Per-task timer toggle | Task 2 (toggleTaskTimer IPC), Task 6 (TaskList UI) |
| System clock-based actual work time | Task 2 (compute elapsed from Date.now()) |
| Accumulates across multiple start/stop cycles | Task 2 (timer_accumulated += elapsed), Task 5 (dev-mock) |
| Full session log | Task 1 (time_entries table), Task 2 (listTimeEntries), Task 8 (TaskModal UI) |
| Live timer in TaskList | Task 6 (TimerDisplay with setInterval) |
| Project-level rollup | Task 2 (getProjectTimeSummary), Task 7 (ProjectList UI) |
| Dev mock mirrors production | Task 5 (dev-mock.ts) |

## Placeholder Scan

- No TBDs, TODOs, or "implement later" references.
- All code snippets are complete and copy-paste ready.
- All file paths are exact.

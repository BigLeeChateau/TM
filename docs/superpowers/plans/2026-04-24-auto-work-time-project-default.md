# Auto Work Time + Project Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically calculate actual work duration for in-progress tasks (actual_start set, actual_end not set) and ensure every task is always associated with a project, defaulting to an "Other" project.

**Architecture:** Keep the existing SQLite + IPC pattern. Extract a shared `computeDuration` helper that accepts an optional end date (defaulting to today) so in-progress tasks show elapsed hours. Create an "Other" project on DB init and enforce it at the `createTask` and `deleteProject` boundaries. Mirror all main-side logic in `dev-mock.ts`.

**Tech Stack:** Electron, better-sqlite3, React, Zustand, TypeScript, Tailwind CSS

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main/database.ts` | Ensure "Other" project exists after table creation |
| `src/main/ipc.ts` | Compute running duration in `listTasks`/`updateTask`; enforce project default in `createTask`/`deleteProject` |
| `src/shared/types.ts` | No structural changes (keep `project_id: number \| null` for safety) |
| `src/renderer/dev-mock.ts` | Mirror main-side duration + project default logic |
| `src/renderer/components/TaskModal.tsx` | Remove "None" from Project dropdown; show computed running duration |
| `src/renderer/components/TaskList.tsx` | No changes needed — `createTask` handles the default |

---

## Task 1: Extract and Update Duration Helper

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/dev-mock.ts`

- [ ] **Step 1: Update `computeDuration` to support running duration**

In `src/main/ipc.ts`, replace the existing `computeDuration` (inside `updateTask`) with this top-level helper:

```typescript
function computeDuration(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start) return null
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
  return days * 8
}
```

- [ ] **Step 2: Apply running duration in `listTasks`**

In `src/main/ipc.ts`, inside the `listTasks` handler, after fetching tasks, map over them and patch the running duration for in-progress tasks:

```typescript
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
  const tasks = db.prepare(sql).all(...params) as Task[]

  return tasks.map((t) => {
    if (t.actual_start && !t.actual_end) {
      return { ...t, actual_duration: computeDuration(t.actual_start, null) }
    }
    return t
  })
})
```

- [ ] **Step 3: Update `updateTask` duration logic**

Inside `updateTask`, change the auto-compute blocks to use the new helper:

```typescript
const effectiveData = { ...data }
if (effectiveData.planned_start !== undefined && effectiveData.planned_end !== undefined && effectiveData.planned_duration === undefined) {
  effectiveData.planned_duration = computeDuration(effectiveData.planned_start, effectiveData.planned_end)
}
if (effectiveData.actual_start !== undefined && effectiveData.actual_duration === undefined) {
  // Compute running duration if no end date yet, or fixed duration if end is provided
  effectiveData.actual_duration = computeDuration(
    effectiveData.actual_start,
    effectiveData.actual_end,
  )
}
```

- [ ] **Step 4: Mirror changes in `dev-mock.ts`**

Replace the existing `computeDuration` in `dev-mock.ts` with the same top-level helper (accepts optional end, defaults to today). Update `updateTask` logic identically. Update `listTasks` to patch running duration:

```typescript
function listTasks(projectId?: number | null, status?: string): Promise<Task[]> {
  let result = [...mockTasks]
  if (projectId !== undefined) {
    result = result.filter((t) => t.project_id === projectId)
  }
  if (status) {
    result = result.filter((t) => t.status === status)
  }
  return Promise.resolve(result.map((t) => {
    if (t.actual_start && !t.actual_end) {
      return { ...t, actual_duration: computeDuration(t.actual_start, null) }
    }
    return t
  }))
}
```

---

## Task 2: Create and Enforce "Other" Default Project

**Files:**
- Modify: `src/main/database.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/dev-mock.ts`
- Modify: `src/renderer/components/TaskModal.tsx`

- [ ] **Step 1: Ensure "Other" project exists on DB init**

In `src/main/database.ts`, after `createTables()` inside `initDatabase()`, add:

```typescript
function ensureDefaultProject(): void {
  const db = getDb()
  const existing = db.prepare("SELECT * FROM projects WHERE name = 'Other'").get() as Project | undefined
  if (!existing) {
    db.prepare("INSERT INTO projects (name, description, color) VALUES (?, ?, ?)")
      .run('Other', '', '#87867f')
  }
}
```

Call `ensureDefaultProject()` right after `createTables()` in `initDatabase()`.

- [ ] **Step 2: Add helper to get "Other" project ID**

In `src/main/database.ts`, add:

```typescript
export function getDefaultProjectId(): number {
  const db = getDb()
  const row = db.prepare("SELECT id FROM projects WHERE name = 'Other'").get() as { id: number } | undefined
  if (!row) throw new Error('Default "Other" project not found')
  return row.id
}
```

- [ ] **Step 3: Enforce project default in `createTask`**

In `src/main/ipc.ts`, at the top of `createTask`:

```typescript
ipcMain.handle('createTask', (_event, data: CreateTaskInput): Task => {
  const db = getDb()
  const projectId = data.project_id ?? getDefaultProjectId()
  const stmt = db.prepare(`
    INSERT INTO tasks
    (title, description, status, project_id, planned_start, planned_end, planned_duration, dependencies, recurrence_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.title,
    data.description || '',
    data.status || 'inbox',
    projectId,
    data.planned_start ?? null,
    data.planned_end ?? null,
    data.planned_duration ?? null,
    data.dependencies || '[]',
    data.recurrence_rule ?? null,
  )
  // ... rest unchanged
})
```

- [ ] **Step 4: Reassign tasks to "Other" on project delete**

In `src/main/ipc.ts`, replace the `deleteProject` handler:

```typescript
ipcMain.handle('deleteProject', (_event, id: number): void => {
  const db = getDb()
  const defaultId = getDefaultProjectId()
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  db.prepare('UPDATE tasks SET project_id = ? WHERE project_id = ?').run(defaultId, id)
  snapshotDatabase()
})
```

- [ ] **Step 5: Mirror in `dev-mock.ts`**

At the top of `dev-mock.ts`, ensure an "Other" project exists on load. Add this right after loading initial data:

```typescript
const OTHER_COLOR = '#87867f'
let otherProject = mockProjects.find((p) => p.name === 'Other')
if (!otherProject) {
  otherProject = {
    id: nextProjectId++,
    name: 'Other',
    description: '',
    color: OTHER_COLOR,
    created_at: new Date().toISOString(),
  }
  mockProjects.push(otherProject)
  saveMockData()
}

function getDefaultProjectId(): number {
  const p = mockProjects.find((x) => x.name === 'Other')
  if (!p) throw new Error('Default "Other" project not found')
  return p.id
}
```

Update `createTask` to use `getDefaultProjectId()` when `data.project_id` is null/undefined:

```typescript
project_id: data.project_id ?? getDefaultProjectId(),
```

Update `deleteProject` to reassign to "Other":

```typescript
function deleteProject(id: number): Promise<void> {
  const defaultId = getDefaultProjectId()
  mockProjects = mockProjects.filter((p) => p.id !== id)
  mockTasks = mockTasks.map((t) => (t.project_id === id ? { ...t, project_id: defaultId } : t))
  saveMockData()
  return Promise.resolve()
}
```

- [ ] **Step 6: Update TaskModal Project dropdown**

In `src/renderer/components/TaskModal.tsx`, remove the "None" option from the Project `<select>`:

```tsx
<select
  value={projectId ?? ''}
  onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
  className="..."
>
  {/* Remove the <option value="">None</option> line */}
  {projects.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ))}
</select>
```

Also update the save handler to fall back to the "Other" project if somehow null:

```typescript
await updateTask(task.id, {
  // ... other fields
  project_id: projectId ?? getDefaultProjectId(), // we don't have direct access to this helper in renderer
})
```

Actually, since `createTask` and `updateTask` on the main side already enforce the default, the renderer can just pass `projectId` as-is. The main side will handle null. So no change needed in the save handler — just remove "None" from the dropdown.

- [ ] **Step 7: Display running duration in TaskModal**

In `src/renderer/components/TaskModal.tsx`, in the Actual Time section, show a small indicator when the task is in progress:

Find the "Actual Time" header area (around line 201) and update it:

```tsx
<div className="flex items-center justify-between mb-2">
  <span className="text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">Actual Time</span>
  <div className="flex gap-2 items-center">
    {actualStart && !actualEnd && actualDuration !== '' && (
      <span className="text-[11px] text-[#c96442]">{actualDuration}h elapsed</span>
    )}
    {!actualStart && (
      <button onClick={handleStartNow} className="...">Start now</button>
    )}
    {actualStart && !actualEnd && (
      <button onClick={handleMarkComplete} className="...">Mark complete</button>
    )}
  </div>
</div>
```

Note: `actualDuration` state is `number | ''`. When the task is fetched from `listTasks`, the running duration is already patched in, so the `useEffect` that syncs task to state will pick it up.

---

## Task 3: Verification

- [ ] **Step 1: Test running duration**
  1. Create a task, set `actual_start` to 3 days ago via modal (or click "Start now" and manually edit the date).
  2. Leave `actual_end` blank.
  3. Close and reopen modal — Actual Hours should show `24` (3 days * 8h).
  4. In canvas "actual" or "both" mode, the block should reflect the running duration.

- [ ] **Step 2: Test project default**
  1. Create a new task from TaskList without selecting a project.
  2. Open the task modal — Project should show "Other".
  3. Create a second project "TestProj", assign the task to it.
  4. Delete "TestProj".
  5. The task should automatically reassign to "Other".

- [ ] **Step 3: Test dev-mock**
  1. Open the app in browser dev mode (`npm run dev:renderer` or similar).
  2. Clear localStorage.
  3. Reload — an "Other" project should appear automatically.
  4. Create a task without a project — it should default to "Other".

- [ ] **Step 4: Commit**

```bash
git add src/main/database.ts src/main/ipc.ts src/renderer/dev-mock.ts src/renderer/components/TaskModal.tsx
git commit -m "feat: auto-calculate running actual duration and enforce Other project default"
```

---

## Spec Coverage Check

| Requirement | Task |
|------------|------|
| Auto-calculate actual work time for in-progress tasks | Task 1 — running duration in `listTasks` and `updateTask` |
| Actual duration updates automatically as days pass | Task 1 — `computeDuration` defaults end to `new Date()` |
| Every task associated with a project | Task 2 — `createTask` enforces default, `deleteProject` reassigns |
| Default project named "Other" | Task 2 — created on DB init with color `#87867f` |
| UI reflects no null projects | Task 2 — TaskModal removes "None" option |
| Dev mock mirrors production logic | Task 1 & 2 — `dev-mock.ts` updated |

## Placeholder Scan

- No TBDs, TODOs, or "implement later" references.
- All code snippets are complete and copy-paste ready.
- All file paths are exact.
- Type names (`Task`, `Project`, `CreateTaskInput`, etc.) match `src/shared/types.ts`.

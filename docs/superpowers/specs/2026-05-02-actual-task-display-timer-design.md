# Actual Task Display, Timer Auto-Set, and Date Validation Design

## Goal

1. Show planned-but-not-started tasks on the Gantt in actual mode as ghost/placeholder blocks
2. Prevent actual dates from being set to future dates (UI + data layer)
3. Auto-set actual_start and actual_end when timer stops; make actual_start immutable once set

---

## Architecture

All actual-date logic is centralized in a new shared module `src/shared/actual-date-utils.ts`. This module provides timezone-safe date formatting, validation, and timer-to-actual-date conversion. It is consumed by both the renderer (TaskModal, TimeCanvas) and main (IPC) processes.

Visual updates are localized to `TimeCanvas.tsx` (ghost block rendering) and `TaskModal.tsx` (read-only state and validation). Data layer changes are in `src/main/ipc.ts` (timer stop auto-write and updateTask validation).

---

## 1. Shared Module: `src/shared/actual-date-utils.ts`

### `getTodayLocal(): string`

Returns today's date as `YYYY-MM-DD` in local time. Uses `getFullYear()` / `getMonth()` / `getDate()` — **not** `toISOString()` — to avoid the UTC timezone shift bug.

### `validateActualDates(start?: string | null, end?: string | null): { valid: boolean; error?: string }`

Validation rules:
- If `start` is provided, it must not be later than today
- If `end` is provided, it must not be later than today
- If both are provided, `end` must not be earlier than `start`
- Returns `{ valid: true }` if all provided values pass

### `computeActualDatesFromTimer(timerStartedAt: string, timerStoppedAt: string): { actual_start: string; actual_end: string }`

- Extracts the date part (YYYY-MM-DD) from `timerStartedAt` for `actual_start`
- Extracts the date part from `timerStoppedAt` for `actual_end`
- Both extractions use local date parsing to avoid UTC shifts

---

## 2. TimeCanvas: Ghost Block Rendering

### Ghost block condition

In `actual` or `both` mode, for tasks that have `planned_start && planned_end` but do **not** have `actual_start`, render a ghost block at the planned date position.

### Ghost block styling

- `border-dashed` border, tag color at 30% opacity
- Fill: tag color + `10` hex opacity (e.g., `#3b82f610`)
- Text: task title at 50% opacity
- Cursor: `pointer` (not `move`)
- No resize handles
- `onDoubleClick` opens TaskModal (same as real blocks)
- No `onMouseDown` drag handler

### Implementation

Add a `renderGhostBlock` function alongside `renderBlock`, or extract a shared rendering helper with an `isGhost` flag. Ghost blocks participate in row assignment using the planned date fields.

### Row assignment

Ghost blocks use the same `plannedRows` Map as planned blocks. They are rendered in the same row positions as their planned counterparts would be.

---

## 3. TaskModal: Validation and Read-Only

### Date input constraints

Both `actualStart` and `actualEnd` `<input type="date">` elements get:
- `max={getTodayLocal()}` attribute

### actual_start read-only

When the task already has `actual_start` (truthy):
- The `actualStart` input is `readOnly`
- Visual cue: gray background (`bg-gray-100`) + small text label "开始时间已固定"

### Frontend validation on save

Before calling `updateTask`:
- Call `validateActualDates(actualStart, actualEnd)`
- If invalid, show error message and disable save

### Timer override behavior

If a user manually sets `actual_start` and then starts a timer, the timer stop will **override** the manually set value. This is by design — the user's explicit requirement.

---

## 4. IPC: Timer Auto-Write and Server-Side Validation

### `toggleTaskTimer` on stop

In the existing database transaction, after closing the `time_entries` row, add:

1. Read the open `time_entries.started_at` for this task
2. Compute `actual_start = date part of started_at`
3. Compute `actual_end = today`
4. Compute `actual_duration = computeDuration(actual_start, actual_end)`
5. Update the task row with these three fields

All date extractions use local date parsing (via `actual-date-utils.ts`).

### `updateTask` validation

If the update payload contains `actual_start` or `actual_end`:
- Call `validateActualDates()` with the new values
- If invalid, throw an error before any database write
- The error propagates to the renderer as a rejected Promise

---

## Data Flow

```
User starts timer
  → IPC: toggleTaskTimer (start)
  → DB: insert time_entries, set timer_running=1

User stops timer
  → IPC: toggleTaskTimer (stop)
  → DB: close time_entries row
  → compute actual_start/actual_end from time_entries
  → DB: update tasks.actual_start, tasks.actual_end, tasks.actual_duration
  → Renderer: store refreshes, ghost block becomes real actual block

User edits task in TaskModal
  → Frontend: validate with max date + validateActualDates()
  → IPC: updateTask
  → IPC: validateActualDates() again
  → DB: update task
  → Renderer: store refreshes
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| User selects future actual date in TaskModal | `max` attribute prevents selection; fallback validation blocks save |
| IPC receives future actual date (bypass UI) | `validateActualDates` throws, update rejected |
| actual_end < actual_start | Validation error in both frontend and backend |
| Timer stop but no open time_entries | Should not happen; log error and skip auto-write |
| actual_start already set, timer starts again | Timer runs normally; on stop, overrides actual_start with new timer start date |

---

## Testing Strategy

1. **Ghost block**: Create task with planned dates but no actual dates → switch to actual mode → verify ghost block appears at planned position
2. **Future date prevention**: Try to set actual_end to tomorrow in TaskModal → verify blocked
3. **Timer auto-set**: Start timer on task with no actual dates → stop timer → verify actual_start and actual_end are populated
4. **actual_start immutability**: Open TaskModal for task with actual_start → verify field is read-only
5. **Timezone safety**: Test on UTC+8 machine → verify dates don't shift by one day

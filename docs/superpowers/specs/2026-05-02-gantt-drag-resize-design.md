# Gantt Chart Drag-and-Drop Resize Fix

## Problem

1. **Missing left-edge resize**: Task blocks in the Gantt chart only support resizing the end date via a handle on the right edge. Users cannot adjust the start date by dragging the left edge.
2. **Asymmetric snap behavior**: When resizing the right edge, the snap-to-day logic uses absolute mouse position (`Math.round(x / DAY_WIDTH)`) rather than delta from the mousedown position. This causes:
   - Extending a task requires dragging farther than reducing it.
   - The effective snap threshold depends on where inside the 16px resize handle the user clicked.

## Design

### 1. Interaction Behavior

| Action | Behavior |
|--------|----------|
| **Drag task body** | Move entire task (start + end shift together), preserving duration. Unchanged. |
| **Drag left-edge handle** | Adjust start date only. End date stays fixed. Duration changes. Minimum 1-day duration enforced. |
| **Drag right-edge handle** | Adjust end date only. Start date stays fixed. Duration changes. Minimum 1-day duration enforced. |
| **Snap rule** | Delta-based: dragging past half a day-column width (40px) in either direction snaps to the adjacent day. Symmetric for left and right. |

### 2. Data Structure Change

```typescript
interface DragState {
  taskId: number
  mode: 'move' | 'resize'
  edge?: 'left' | 'right'       // NEW: only set when mode === 'resize'
  startField: 'planned_start' | 'actual_start'
  endField: 'planned_end' | 'actual_end'
  startX: number
  startIdx: number
  endIdx: number
  offsetX: number
  currentStart?: number
  currentEnd?: number
}
```

### 3. `renderBlock` — Add Left Resize Handle

Add a left-edge handle symmetric to the existing right-edge handle inside `renderBlock`:

```tsx
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
```

Update `handleMouseDown` signature to accept an optional `edge` parameter:

```typescript
const handleMouseDown = (
  e: ReactMouseEvent,
  task: Task,
  mode: 'move' | 'resize',
  startField: 'planned_start' | 'actual_start',
  endField: 'planned_end' | 'actual_end',
  edge?: 'left' | 'right'
) => { ... }
```

### 4. `handleMouseMove` — Delta-Based Snap

Replace the absolute-position resize logic with delta-based snap:

```typescript
const deltaX = x - dragState.startX
const deltaDays = Math.sign(deltaX) * Math.round(Math.abs(deltaX) / DAY_WIDTH)

if (dragState.mode === 'move') {
  const rawIdx = Math.round((x - dragState.offsetX) / DAY_WIDTH)
  const newStart = Math.max(0, rawIdx)
  const duration = dragState.endIdx - dragState.startIdx
  const newEnd = newStart + duration
  setDragState((s) => (s ? { ...s, currentStart: newStart, currentEnd: newEnd } : null))
} else if (dragState.edge === 'left') {
  const newStart = Math.min(dragState.endIdx - 1, Math.max(0, dragState.startIdx + deltaDays))
  setDragState((s) => (s ? { ...s, currentStart: newStart } : null))
} else {
  const newEnd = Math.max(dragState.startIdx + 1, dragState.endIdx + deltaDays)
  setDragState((s) => (s ? { ...s, currentEnd: newEnd } : null))
}
```

Key properties:
- `Math.sign(deltaX) * Math.round(Math.abs(deltaX) / DAY_WIDTH)` ensures symmetric rounding (half away from zero), avoiding JavaScript's `Math.round(-0.5) === 0` asymmetry.
- Left edge clamp: `newStart ≤ endIdx - 1` guarantees at least 1 day duration.
- Right edge clamp: `newEnd ≥ startIdx + 1` guarantees at least 1 day duration.

### 5. `handleMouseUp` — Save Changes

```typescript
} else if (mode === 'resize') {
  if (currentStart !== undefined) {
    // Left-edge resize: update start only
    await updateTask(taskId, {
      [startField]: getDateFromIndex(currentStart),
    } as UpdateTaskInput)
  } else if (currentEnd !== undefined) {
    // Right-edge resize: update end only
    await updateTask(taskId, {
      [endField]: getDateFromIndex(currentEnd),
    } as UpdateTaskInput)
  }
}
```

### 6. `getTaskStyle` — Unified Visual Update

Replace the separate `currentStart` / `currentEnd` branches with a single unified block:

```typescript
if (dragState && dragState.taskId === task.id && startKey === dragState.startField) {
  const newStart = dragState.currentStart ?? startIdx
  const newEnd = dragState.currentEnd ?? endIdx
  left = newStart * DAY_WIDTH
  width = (newEnd - newStart) * DAY_WIDTH
}
```

This works for all three drag modes (move, resize-left, resize-right) because:
- **Move**: both `currentStart` and `currentEnd` are defined.
- **Resize-left**: `currentStart` is defined, `currentEnd` falls back to original `endIdx`.
- **Resize-right**: `currentEnd` is defined, `currentStart` falls back to original `startIdx`.

## Scope

- File changed: `src/renderer/components/TimeCanvas.tsx` only.
- No database schema changes.
- No API changes.
- Planned and actual task blocks both receive the new behavior.

## Testing Checklist

- [ ] Left-edge handle appears on hover for both planned and actual blocks.
- [ ] Dragging left edge changes start date; end date stays fixed.
- [ ] Left-edge resize enforces minimum 1-day duration (cannot drag past end date - 1).
- [ ] Right-edge resize still works; end date changes; start date stays fixed.
- [ ] Snap threshold is symmetric: extending and reducing both require dragging ~40px from mousedown.
- [ ] Move mode unaffected.
- [ ] Visual feedback (block position/width) matches the snapped value during drag.

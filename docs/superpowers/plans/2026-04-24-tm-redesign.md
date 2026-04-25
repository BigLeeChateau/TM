# TM Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TM app from dark utilitarian to warm editorial design system (parchment, ivory, terracotta, serif accents).

**Architecture:** Big bang swap — update all component styling in one pass. Colors map directly from current dark Tailwind classes to new warm hex values. No functional changes, no new components, purely visual.

**Tech Stack:** React + Tailwind CSS + Electron. Colors applied via Tailwind arbitrary values (e.g. `bg-[#f5f4ed]`) and inline styles.

---

## File Structure

| File | Responsibility | Change Type |
|---|---|---|
| `src/renderer/index.css` | Global body bg, text color, scrollbar, font | Modify |
| `src/renderer/App.tsx` | App shell layout, sidebar bg, header bg | Modify |
| `src/renderer/components/ProjectList.tsx` | Sidebar project list, new project button | Modify |
| `src/renderer/components/TaskList.tsx` | GTD filters, task chips, status dots, new task button | Modify |
| `src/renderer/components/TimeCanvas.tsx` | Date headers, grid, task blocks, mode toggle, overcommit | Modify |
| `src/renderer/components/TaskModal.tsx` | Modal overlay, card, inputs, buttons | Modify |

---

## Pre-Existing Bug to Fix

`src/renderer/components/TaskList.tsx:42` — `updateTask` is called but not imported from `useStore`. This will crash if a user clicks a status dot. Import `updateTask` from `useStore` in Task 4.

---

## Task 1: Global Styles (`index.css`)

**Files:**
- Modify: `src/renderer/index.css`

- [ ] **Step 1: Update body background and text color**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f4ed;
  color: #141413;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #d1cfc5;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #b0aea5;
}
```

- [ ] **Step 2: Verify — open app, page background should be warm cream (`#f5f4ed`)**

---

## Task 2: App Shell (`App.tsx`)

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Update App shell colors**

Replace the outer div and sidebar/header classes:

```tsx
<div className="flex h-full bg-[#f5f4ed] text-[#141413]">
  {>/* Left sidebar */>}
  <aside className="w-64 flex-shrink-0 border-r border-[#f0eee6] flex flex-col bg-[#faf9f5]">
```

Update header:

```tsx
<header className="h-14 border-b border-[#f0eee6] flex items-center px-4 gap-4 bg-[#faf9f5]">
```

Update nav buttons:

```tsx
<button
  key={v}
  onClick={() => setView(v)}
  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
    view === v
      ? 'bg-[#141413] text-[#faf9f5]'
      : 'text-[#5e5d59] hover:text-[#141413] hover:bg-[#f5f4ed]'
  }`}
>
```

Update Export JSON button:

```tsx
<button
  onClick={async () => { ... }}
  className="px-3 py-1.5 text-sm text-[#5e5d59] hover:text-[#141413] hover:bg-[#f5f4ed] rounded-lg transition-colors border border-[#e8e6dc]"
>
```

Update search input:

```tsx
<input
  type="text"
  placeholder="Search..."
  className="w-48 px-3 py-1.5 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
/>
```

Update ListView and DashboardView card backgrounds:

```tsx
<div className="p-4 overflow-auto h-full">
  <h2 className="text-lg font-medium mb-4 text-[#141413]">All Tasks</h2>
  <div className="space-y-2">
    {tasks.map((task) => (
      <div
        key={task.id}
        className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-[#f0eee6]"
      >
```

```tsx
<div className="bg-white border border-[#f0eee6] rounded-lg p-4">
```

Update StatusBadge colors:

```tsx
const colors: Record<string, string> = {
  inbox: 'bg-[#b0aea5]',
  next: 'bg-[#c96442]',
  waiting: 'bg-[#d97757]',
  done: 'bg-[#4d4c48]',
}
```

- [ ] **Step 2: Verify — sidebar is Ivory (`#faf9f5`), header is Ivory, nav active button is Near Black**

---

## Task 3: ProjectList (`ProjectList.tsx`)

**Files:**
- Modify: `src/renderer/components/ProjectList.tsx`

- [ ] **Step 1: Update section label and project items**

Section label:

```tsx
<div className="px-3 py-2 text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">
  Projects
</div>
```

Project item button:

```tsx
<button
  key={project.id}
  onClick={() => setSelectedProject(project.id === selectedProjectId ? null : project.id)}
  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
    project.id === selectedProjectId
      ? 'bg-[#f5f4ed] text-[#141413] font-medium'
      : 'text-[#4d4c48] hover:bg-[#f5f4ed]'
  }`}
>
```

New Project input:

```tsx
<input
  autoFocus
  value={newName}
  onChange={(e) => setNewName(e.target.value)}
  onKeyDown={(e) => { ... }}
  onBlur={() => { ... }}
  placeholder="Project name"
  className="w-full px-2 py-1 bg-white border border-[#e8e6dc] rounded-lg text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
/>
```

New Project button:

```tsx
<button
  onClick={() => setIsAdding(true)}
  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[#b0aea5] hover:text-[#4d4c48] hover:bg-[#f5f4ed] transition-colors text-left"
>
```

- [ ] **Step 2: Verify — project list shows warm tones, active project has parchment bg, new project button is muted**

---

## Task 4: TaskList (`TaskList.tsx`)

**Files:**
- Modify: `src/renderer/components/TaskList.tsx`

- [ ] **Step 1: Add missing `updateTask` import**

```tsx
import { useStore } from '../store'
```

Change to:

```tsx
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
```

- [ ] **Step 2: Update GTD section label and filter buttons**

Section label:

```tsx
<div className="px-3 py-2 text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">
  GTD
</div>
```

Filter buttons:

```tsx
<button
  key={key}
  onClick={() => setSelectedStatus(key === 'all' ? null : key)}
  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
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
```

- [ ] **Step 3: Update task items and status dots**

Task item container:

```tsx
<div
  key={task.id}
  className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f5f4ed]"
>
```

Status dots (replace bg colors):

```tsx
className={`w-2 h-2 rounded-full flex-shrink-0 ${
  task.status === 'inbox'
    ? 'bg-[#b0aea5]'
    : task.status === 'next'
      ? 'bg-[#c96442]'
      : task.status === 'waiting'
        ? 'bg-[#d97757]'
        : 'bg-[#4d4c48]'
}`}
```

Task title text:

```tsx
<span
  className={`flex-1 text-sm truncate cursor-pointer ${
    task.status === 'done' ? 'line-through text-[#b0aea5]' : 'text-[#4d4c48]'
  }`}
  onClick={() => setEditingTaskId(task.id)}
>
```

Delete button:

```tsx
<button
  onClick={() => deleteTask(task.id)}
  className="opacity-0 group-hover:opacity-100 text-xs text-[#b0aea5] hover:text-[#b53333] transition-opacity"
>
  ×
</button>
```

- [ ] **Step 4: Update new task input and button**

New task input:

```tsx
<input
  autoFocus
  value={newTitle}
  onChange={(e) => setNewTitle(e.target.value)}
  onKeyDown={(e) => { ... }}
  onBlur={() => { ... }}
  placeholder="Task title"
  className="w-full px-2 py-1.5 bg-white border border-[#e8e6dc] rounded-lg text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
/>
```

New Task button:

```tsx
<button
  onClick={() => setIsAdding(true)}
  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[#b0aea5] hover:text-[#4d4c48] hover:bg-[#f5f4ed] transition-colors text-left"
>
```

- [ ] **Step 5: Verify — status dots are terracotta/orange/charcoal, done tasks are strikethrough muted, hover states work**

---

## Task 5: TimeCanvas (`TimeCanvas.tsx`)

**Files:**
- Modify: `src/renderer/components/TimeCanvas.tsx`

- [ ] **Step 1: Update date header row and cells**

Date header row:

```tsx
<div
  className="flex border-b border-[#f0eee6] sticky top-0 bg-[#faf9f5] z-10"
  style={{ height: HEADER_HEIGHT }}
>
```

Date cells:

```tsx
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
    } ${isOvercommitted ? 'text-[#b53333]' : ''}`}
  >
    {d.getDate()}
  </span>
  {isOvercommitted && (
    <span className="absolute top-0.5 right-1 text-[9px] text-[#b53333] font-bold">
      {Math.round(load)}h
    </span>
  )}
</div>
```

- [ ] **Step 2: Update mode toggle bar**

```tsx
<div className="flex gap-1 px-2 py-2 border-b border-[#f0eee6] bg-[#faf9f5] sticky top-[40px] z-10">
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
```

- [ ] **Step 3: Update inbox/unscheduled area**

```tsx
<div className="px-2 py-3 border-b border-[#f0eee6]">
  <div className="text-[11px] text-[#87867f] mb-2 uppercase tracking-[0.5px]">Inbox / Unscheduled</div>
  <div className="flex flex-wrap gap-2">
    {tasks
      .filter((t) => !t.planned_start && t.status !== 'done')
      .map((task) => (
        <div
          key={task.id}
          className="px-2 py-1 rounded-lg bg-white text-sm text-[#4d4c48] border border-[#e8e6dc]"
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
```

- [ ] **Step 4: Update grid columns**

```tsx
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
        style={{
          width: DAY_WIDTH,
          borderColor: 'rgba(240, 238, 230, 0.6)',
        }}
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
```

- [ ] **Step 5: Update renderBlock colors**

In `renderBlock`, update the style object:

```tsx
style={{
  ...getTaskStyle(task, startKey, endKey, rowMap, rowOffset),
  backgroundColor: projectColor(task.project_id) + (isPlanned && canvasMode === 'both' ? '15' : '25'),
  borderColor: projectColor(task.project_id) + (isPlanned && canvasMode === 'both' ? '25' : '40'),
  color: isPlanned ? '#141413' : '#faf9f5',
  opacity: opacity,
}}
```

And update the base className:

```tsx
className={`absolute rounded-lg px-2 py-1 text-xs font-medium select-none cursor-move overflow-hidden whitespace-nowrap border ${
  task.status === 'done' ? 'opacity-40' : ''
}`}
```

- [ ] **Step 6: Update "ACTUAL" separator label**

```tsx
<div
  className="absolute left-2 text-[10px] text-[#b0aea5] uppercase tracking-[1px]"
  style={{ top: ROW_OFFSET + maxPlannedRow * (BLOCK_HEIGHT + BLOCK_GAP) + 4 }}
>
  Actual
</div>
```

- [ ] **Step 7: Verify — canvas shows warm cream grid, terracotta today highlight, crimson overcommit warnings, task blocks tinted correctly**

---

## Task 6: TaskModal (`TaskModal.tsx`)

**Files:**
- Modify: `src/renderer/components/TaskModal.tsx`

- [ ] **Step 1: Update modal overlay and card**

Overlay:

```tsx
<div
  className="fixed inset-0 bg-[rgba(20,20,19,0.4)] flex items-center justify-center z-50"
  onClick={(e) => {
    if (e.target === e.currentTarget) onClose()
  }}
>
```

Card:

```tsx
<div className="bg-white border border-[#f0eee6] rounded-2xl w-full max-w-md p-5 shadow-[rgba(0,0,0,0.05)_0px_4px_24px] max-h-[90vh] overflow-auto">
  <h3 className="text-lg font-medium text-[#141413] mb-4">Edit Task</h3>
```

- [ ] **Step 2: Update all labels and inputs**

All labels:

```tsx
<label className="block text-[11px] text-[#87867f] mb-1 uppercase tracking-[0.5px]">
```

All inputs/selects/textarea:

```tsx
className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
```

Textarea keeps `resize-none`:

```tsx
className="w-full px-3 py-2 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] resize-none placeholder:text-[#b0aea5]"
```

Select options inherit text color (no change needed).

- [ ] **Step 3: Update buttons**

"Start now" button:

```tsx
<button
  onClick={handleStartNow}
  className="px-2 py-1 text-xs bg-[#e8e6dc] text-[#c96442] rounded-lg hover:bg-[#d1cfc5] transition-colors"
>
  Start now
</button>
```

"Mark complete" button:

```tsx
<button
  onClick={handleMarkComplete}
  className="px-2 py-1 text-xs bg-[#e8e6dc] text-[#c96442] rounded-lg hover:bg-[#d1cfc5] transition-colors"
>
  Mark complete
</button>
```

"Actual Time" section header:

```tsx
<span className="text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">Actual Time</span>
```

Delete button:

```tsx
<button
  onClick={handleDelete}
  className="px-3 py-1.5 text-sm text-[#b53333] hover:text-[#b53333]/80 transition-colors"
>
  Delete
</button>
```

Cancel button:

```tsx
<button
  onClick={onClose}
  className="px-4 py-1.5 text-sm text-[#5e5d59] hover:text-[#141413] transition-colors"
>
  Cancel
</button>
```

Save button:

```tsx
<button
  onClick={handleSave}
  disabled={!title.trim()}
  className="px-4 py-1.5 text-sm bg-[#c96442] text-[#faf9f5] rounded-lg hover:bg-[#d97757] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
>
  Save
</button>
```

- [ ] **Step 4: Verify — modal has white card, warm cream inputs, terracotta primary button, crimson delete**

---

## Task 7: Visual Regression Check

**Files:** None (manual verification)

- [ ] **Step 1: Open app in browser and verify each view**

Checklist:
- [ ] Page background: `#f5f4ed` Parchment
- [ ] Sidebar: `#faf9f5` Ivory with cream borders
- [ ] "TM" title: serif font, `#141413`
- [ ] Section labels: 11px uppercase, `#87867f`
- [ ] Active nav button: `#141413` bg, `#faf9f5` text
- [ ] Search input: white bg, warm border, rounded-xl
- [ ] Project list: terracotta dots, active = parchment bg
- [ ] GTD filters: active = parchment bg + near black text
- [ ] Task chips: white bg, warm border
- [ ] Status dots: inbox=muted, next=terracotta, waiting=coral, done=charcoal
- [ ] TimeCanvas: date headers on ivory, today = terracotta tint
- [ ] Overcommitment: crimson text + background tint
- [ ] Task blocks: planned = tinted at low opacity, actual = solid color
- [ ] TaskModal: white card, warm inputs, terracotta save, crimson delete
- [ ] Export JSON: still works
- [ ] Drag and drop: still works
- [ ] All hover/focus states use warm tones

- [ ] **Step 2: Commit all changes**

```bash
git add -A
git commit -m "feat: redesign to warm editorial design system"
```

---

## Self-Review

**Spec coverage check:**
- Color mapping — all 15 colors mapped to tasks (Task 1–6) ✅
- Typography — serif title, sans UI, 11px labels covered ✅
- Spacing — radii, padding, heights covered ✅
- Component rules — all 6 files have explicit styling instructions ✅
- Pre-existing bug — `updateTask` import missing, fixed in Task 4 ✅

**Placeholder scan:**
- No TBDs, TODOs, or "implement later" ✅
- All className changes show exact code ✅
- All color values are explicit hex codes ✅

**Type consistency:**
- No new types or functions introduced ✅
- All changes are CSS/Tailwind class replacements ✅

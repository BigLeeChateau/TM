# TM Redesign: Editorial Warm Design System

## Overview

Redesign the TM (Time-First OS) desktop app from its current dark utilitarian aesthetic to a warm, editorial design system inspired by the project's DESIGN.md (Claude/Anthropic style). The app should feel like a thoughtfully designed object — warm parchment tones, serif headlines, terracotta accents, and generous whitespace — while remaining fully functional as a dense productivity tool.

**Approach:** Big bang swap. All components updated in one pass to maintain visual coherence.

---

## 1. Color System Mapping

| Current (Dark) | New (Warm Editorial) | Usage |
|---|---|---|
| `#0f0f0f` page bg | `#f5f4ed` Parchment | Primary page background |
| `#1a1a1a` surface | `#faf9f5` Ivory | Sidebar, header, cards |
| `gray-900` (`#111827`) | `#ffffff` Pure White | Elevated cards, inputs |
| `gray-800` borders | `#f0eee6` Border Cream | All borders, dividers |
| `gray-700` input borders | `#e8e6dc` Border Warm | Input borders, button bg |
| `gray-100` primary text | `#141413` Near Black | Headlines, primary text |
| `gray-200` body text | `#4d4c48` Charcoal Warm | Body text |
| `gray-300` secondary | `#5e5d59` Olive Gray | Secondary text |
| `gray-400` muted | `#87867f` Stone Gray | Labels, metadata |
| `gray-500` labels | `#b0aea5` Warm Silver | Tertiary, disabled |
| `blue-500/600` accent | `#c96442` Terracotta | Primary actions, brand |
| `blue-400` links/active | `#d97757` Coral | Links, hover accents |
| `green-600` done | `#4d4c48` Charcoal + opacity | Done status (no green) |
| `yellow-500` warning | `#b53333` Error Crimson | Overcommitment warning |
| `red-400` delete | `#b53333` Error Crimson | Delete actions |

**Project colors:** User-defined project colors remain unchanged. Canvas block tints shift from `projectColor + '20'` to `projectColor + '15'` on Parchment for subtler ghosting.

---

## 2. Typography & Spacing

### Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| App title "TM" | Georgia (serif) | 28px | 500 | `#141413` |
| Section labels | system-ui | 11px | 500 | `#87867f` |
| Body / nav / buttons | system-ui | 14px | 400–500 | varies |
| Task block labels | system-ui | 12px | 500 | `#141413` |
| Date weekday | system-ui | 11px | 400 | `#87867f` |
| Date number | system-ui | 15px | 500 | `#141413` |

- Section labels: uppercase, letter-spacing 0.5px
- All UI text uses sans-serif (system-ui / Inter fallback)
- The "TM" title is the only serif moment in the UI

### Spacing & Shape

| Element | Value |
|---|---|
| Button radius | 8px |
| Card radius | 8px |
| Input radius | 12px |
| Modal radius | 16px |
| Sidebar width | 260px |
| Header height | 56px |
| Date header height | 56px |
| Sidebar section gap | 28px |
| Button padding | 6px 14px |
| Card internal padding | 20–24px |

**Shadows:**
- Modal: `rgba(0,0,0,0.05) 0px 4px 24px` (whisper shadow)
- Button/card hover ring: `0px 0px 0px 1px #d1cfc5`

**Borders:** All 1px solid `#f0eee6` (Border Cream). No more `gray-800`.

---

## 3. Component Styling Rules

### App Shell (`App.tsx`)
- Background: `#f5f4ed` Parchment
- Sidebar: `#faf9f5` Ivory, 260px wide, border-right 1px `#f0eee6`
- Header: `#faf9f5` Ivory, 56px height, border-bottom 1px `#f0eee6`

### Sidebar (`ProjectList` + `TaskList`)
- Section labels: 11px uppercase, `#87867f`, letter-spacing 0.5px
- Project items: 14px, `#4d4c48`, 8px radius, hover `#f5f4ed`
- GTD filter items: 14px, `#5e5d59`, hover `#f5f4ed`
- Active GTD item: `#f5f4ed` bg + `#141413` text
- Task chips: `#ffffff` bg, 1px `#e8e6dc` border, 8px radius, 13px text
- "+ New Task" button: `#e8e6dc` bg, `#4d4c48` text, 8px radius

### TimeCanvas (`TimeCanvas.tsx`)
- Date header row: `#faf9f5` bg, 56px height, sticky top
- Date cells: 80px wide, `#f0eee6` right border
- Today cell: bg `rgba(201,100,66,0.06)`, date text `#c96442`
- Overcommit cell: bg `rgba(181,51,51,0.06)`, date text + badge `#b53333`
- Mode toggle bar: `#faf9f5` bg, sticky below header
- Active mode button: `#141413` bg, `#faf9f5` text, 8px radius
- Inactive mode button: transparent, `#5e5d59` text
- Grid columns: `#f0eee6` right border at 60% opacity
- Planned blocks: `projectColor` fill at 15% opacity, `projectColor` border at 25% opacity, 8px radius
- Actual blocks: solid `projectColor` fill, `#faf9f5` text, 8px radius
- Done blocks: 40% opacity (same behavior as current)
- "ACTUAL" label: 10px uppercase, `#b0aea5`, letter-spacing 1px

### TaskModal (`TaskModal.tsx`)
- Overlay: `rgba(20,20,19,0.4)` warm black
- Modal card: `#ffffff` bg, 16px radius, whisper shadow `rgba(0,0,0,0.05) 0px 4px 24px`
- Input fields: `#ffffff` bg, 1px `#e8e6dc` border, 12px radius, `#141413` text
- Focus ring: `#3898ec` (the only cool color, per DESIGN.md)
- Primary save button: `#c96442` bg, `#faf9f5` text, 8px radius
- Secondary buttons: transparent, `#5e5d59` text
- Delete button: `#b53333` text
- "Start now" / "Mark complete" buttons: `#e8e6dc` bg, `#c96442` text, 8px radius
- Section headers (e.g. "Actual Time"): 11px uppercase, `#87867f`, letter-spacing 0.5px

---

## 4. Files to Modify

1. `src/renderer/App.tsx` — App shell background, sidebar, header styling
2. `src/renderer/components/TimeCanvas.tsx` — Canvas colors, blocks, headers, toggles
3. `src/renderer/components/TaskModal.tsx` — Modal overlay, card, inputs, buttons
4. `src/renderer/components/ProjectList.tsx` — Sidebar project list styling
5. `src/renderer/components/TaskList.tsx` — Sidebar GTD filters, task chips, buttons
6. `src/renderer/index.css` or `tailwind.config.js` — Global color tokens if extracted

---

## 5. Verification Plan

- [ ] Open app — page background is Parchment (`#f5f4ed`), sidebar is Ivory (`#faf9f5`)
- [ ] Sidebar — section labels are uppercase 11px, projects show terracotta dots
- [ ] TimeCanvas — date headers on Ivory, today highlighted in terracotta tint
- [ ] Overcommitment — warning shows crimson (`#b53333`) text and background tint
- [ ] Plan/Actual/Both toggle — active button is Near Black (`#141413`) with Ivory text
- [ ] Task blocks — planned blocks are tinted project color at low opacity, actual blocks are solid project color
- [ ] TaskModal — white card with warm cream inputs, terracotta primary button
- [ ] Export JSON — functionality unchanged
- [ ] Drag and drop — functionality unchanged
- [ ] All interactions (hover, focus, active) use warm tones

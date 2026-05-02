# Contributing to TM

Thanks for your interest in improving TM!

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (Electron + Vite hot reload)
npm run dev

# Or run just the renderer in a browser (uses mock data, no Electron)
npx vite

# Type-check
npx tsc --noEmit

# Build for production
npm run build

# Package the app (dmg, exe, etc.)
npm run dist
```

## Project Structure

```
src/
  main/           # Electron main process
    index.ts      # App lifecycle, window creation
    database.ts   # SQLite schema and migrations
    ipc.ts        # IPC handlers for all operations
  preload/        # Context bridge for secure IPC
  renderer/       # React frontend
    components/   # UI components
    store.ts      # Zustand store
    i18n/         # Translations (7 languages)
    dev-mock.ts   # Browser development mock API
  shared/         # Shared types and utilities
```

## Data Model

- **Tags** — name, color, description. Tasks have one major tag and optional secondary tags.
- **Tasks** — title, status, major tag, planned/actual dates and durations, timer state
- **Time Entries** — full session log with start, end, and duration per task

All data is stored locally in SQLite. No cloud, no accounts, no subscription.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Confirm task/tag creation |
| `Escape` | Cancel task/tag creation, close modal |
| `Cmd/Ctrl + Z` | Undo last task update |

## Tech Stack

- **Electron** — Cross-platform desktop shell
- **React + TypeScript** — UI layer
- **Vite** — Build tooling
- **Tailwind CSS** — Styling
- **Zustand** — State management
- **better-sqlite3** — Local database (WAL mode)

# TODOS

## Deferred from CEO Review

### Natural Language Project Creation
- **What:** Type a sentence like "I'm launching a SaaS in 6 weeks" and the system generates tasks, estimates, and places them on the canvas.
- **Why:** Magic moment feature that demonstrates the 10x vision.
- **Pros:** Dramatically lowers barrier to planning; shows AI value immediately.
- **Cons:** Requires canvas to be proven first; needs 50+ tasks of user history for good estimates.
- **Context:** Deferred from Phase 1. Gate: 30-day active usage on canvas + 50+ tasks created manually.
- **Depends on:** Phase 1 core loop proven, Smart Estimates data layer.

### Plugin / Integration Architecture
- **What:** Extensible API for GitHub/Notion/Linear integrations.
- **Why:** Users already have tools; TM should connect to them, not replace them.
- **Pros:** High leverage; community can build integrations.
- **Cons:** API design is a one-way door; needs real usage patterns first.
- **Context:** Deferred from Phase 1. Gate: 3+ users request specific integrations, or 90-day active usage reached.
- **Depends on:** Stable data model, real usage feedback.

## From Engineering Review

### Update Design Doc
- **What:** Rewrite the approved design document to reflect CEO plan + engineering review decisions.
- **Why:** The design doc still contains rejected architecture (generic IPC query/mutate, undo in Zustand, SVG-first canvas, conditional snapshot cache). Implementing from it will reintroduce dead design.
- **Pros:** Single source of truth for implementation.
- **Cons:** ~1 hour of writing.
- **Context:** Codex outside voice flagged this as a critical gap. All review decisions (narrow IPC, dual state, snapshot cache, start/stop tracking, subtasks) must be reflected.
- **Depends on:** Completion of this engineering review.

### Electron Build Pipeline / CI/CD
- **What:** Set up electron-builder + GitHub Actions workflow for macOS (.dmg) and Windows (.exe).
- **Why:** Code without distribution is code nobody can use. Codex flagged cross-platform details as hand-waved.
- **Pros:** Proven distribution from day one; validates the build on every commit.
- **Cons:** ~1 day setup; code signing and notarization for macOS is fiddly.
- **Context:** Deferred to Phase 2 per user decision. Distribution Plan section mentions GitHub Releases but no implementation phase includes the pipeline.
- **Depends on:** Phase 1 scaffold complete.

### Recurring Tasks Instance Lifecycle
- **What:** Define UI for creating/editing RRULE rules and behavior of completing one instance vs. the series.
- **Why:** The rendering strategy (materialized blocks) is defined, but instance lifecycle is thin. Codex flagged this as structurally wrong for per-instance edits.
- **Pros:** Makes recurring tasks actually usable.
- **Cons:** Complex state machine; RRULE libraries handle generation but not instance mutation.
- **Context:** Noted in design doc adversarial review. Will be refined during implementation.
- **Depends on:** Phase 1 core loop.

### Calendar Export (ICS)
- **What:** One-way push of planned tasks to Apple Calendar / Outlook via ICS files.
- **Why:** Users want to see their plan in their calendar. Codex argues this recreates the manual bridge the product claims to remove.
- **Pros:** Connects planning surface to execution surface.
- **Cons:** One-way means no data comes back; conflicts with local-first purity.
- **Context:** Pulled from Phase 3 to Phase 2 in CEO review. Resolution: one-way ICS push only, no bidirectional sync.
- **Depends on:** Phase 1 core loop.

### Focus Mode with Auto Time Tracking
- **What:** Full-screen overlay with current task + timer. Logs actual duration automatically.
- **Why:** Eliminates manual start/stop friction; captures real execution data.
- **Pros:** Best actual time tracking UX; aligns with the "sovereign time" vision.
- **Cons:** Complex UI; timer accuracy across app restarts.
- **Context:** Deferred to Phase 3 in design doc. User chose manual start/stop tracking for Phase 2; auto tracking can augment this later.
- **Depends on:** Start/stop tracking proven.

### Keyboard-First Power Navigation
- **What:** Vim-style canvas shortcuts (j/k for next/prev task, hjkl for movement, etc.).
- **Why:** Power users want keyboard control; aligns with "sovereign" feel.
- **Pros:** Fast navigation for heavy users.
- **Cons:** Discovery problem; conflicts with text input.
- **Context:** Listed as lower-priority option in CEO plan.
- **Depends on:** Phase 1 core loop.

### Mobile Companion App (Capture-Only)
- **What:** Minimal mobile app for quick capture on the go.
- **Why:** Capture friction exists outside the desktop.
- **Pros:** Lower capture friction.
- **Cons:** Requires cloud sync or local network sync; contradicts local-first.
- **Context:** Listed as lower-priority option in CEO plan.
- **Depends on:** Plugin architecture or sync module.

### Smart Dependency Enforcement
- **What:** Optional blocking rules where dependent tasks can't start until prerequisites are done.
- **Why:** Visual-only dependencies are easy to ignore.
- **Pros:** Real project management power.
- **Cons:** Rigid; conflicts with personal flexibility.
- **Context:** Listed as lower-priority option in CEO plan.
- **Depends on:** Phase 2 actual tracking.

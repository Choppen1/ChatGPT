# CLAUDE.md — Planner in 3 stappen

This file documents the codebase structure, conventions, and development guidelines for AI assistants working on this repository.

---

## Project Overview

**Name**: Planner in 3 stappen (Planner in 3 Steps)
**Language**: Dutch (Nederlands) — all UI text, variable names, and comments are in Dutch
**Tech**: React with TypeScript (single-file component, `.jsx` extension)
**Runtime target**: Browser-based playground (e.g., ChatGPT canvas, StackBlitz, CodeSandbox)
**Persistence**: `localStorage` only — no backend, no server, no API

This is a weekly planning application for students (ROC context: school/stage/thuis). Users color a weekly schedule grid, create tasks, and then run an auto-scheduler to fit tasks into available time slots. The result can be exported as an `.ics` calendar file or a `.csv` task list.

---

## Repository Structure

```
ChatGPT/
├── Plannen in 3 stappen.jsx   # Entire application — single file
├── README.md                  # Minimal (just the repo name)
├── .gitignore                 # Python-style gitignore (no build artifacts to ignore)
└── CLAUDE.md                  # This file
```

There is no `package.json`, no bundler config, and no test setup. The file is designed to run directly in an interactive playground environment where React and optionally XLSX are already available.

---

## Architecture

### Single-File Pattern

The entire app lives in `Plannen in 3 stappen.jsx`. It exports one default component (`PlanningApp`) and contains all helper functions, sub-components, types, and state management inline. **Do not split into multiple files** unless the project explicitly moves to a proper build setup.

### Component Hierarchy

```
PlanningApp (default export)        — main state, all logic, step routing
├── Stepper                         — defined inline; step navigation UI
├── CatBadge                        — defined inline; color badge for a category
├── [Step 1 JSX]                    — weekly grid (paint-by-click)
├── [Step 2 JSX]                    — task list, import wizard, NewTask
│   └── NewTask                     — separate exported function at bottom of file
├── [Step 3 JSX]                    — scheduled calendar view, ICS export
└── NewCategory                     — separate exported function at bottom of file
```

### State Management

All state uses the custom `useLocalState<T>` hook (wraps `useState` + `useEffect` to sync with `localStorage`). There is no external state library (Redux, Zustand, etc.).

Key state variables in `PlanningApp`:

| Variable      | LocalStorage key   | Type             | Purpose                                 |
|---------------|--------------------|------------------|-----------------------------------------|
| `step`        | `plan.step`        | `number`         | Current step (1, 2, or 3)              |
| `startHour`   | `plan.start`       | `number`         | Grid start hour (default 7)            |
| `endHour`     | `plan.end`         | `number`         | Grid end hour (default 22)             |
| `cats`        | `plan.cats`        | `Category[]`     | Color categories                        |
| `activeCat`   | `plan.activeCat`   | `string\|null`   | Currently selected paint color         |
| `grid`        | `plan.grid`        | `Grid`           | day → hour → catId mapping             |
| `tasks`       | `plan.tasks`       | `Task[]`         | To-do list                             |
| `placed`      | `plan.placed`      | `Placed[]`       | Scheduled task blocks                  |
| `drawerOpen`  | `plan.drawer`      | `boolean`        | Palette drawer open/closed             |

---

## Core Types

All types are defined near the top of the file:

```ts
type Category = {
  id: string;
  naam: string;       // display name
  kleur: string;      // hex color, e.g. "#2563eb"
  context: "thuis" | "stage" | "school" | "overig";
};

type Task = {
  id: string;
  titel: string;
  minuten: number;    // duration in minutes
  deadline?: string;  // ISO date string (YYYY-MM-DD)
  context: "thuis" | "stage" | "school" | "overig";
  io?: string;        // IO-code or assignment label
  prioriteit: 1 | 2 | 3;   // 1 = low, 3 = high
  status: "open" | "gepland" | "gedeeltelijk" | "klaar";
};

type Placed = {
  taskId: string;
  day: typeof DAYS[number];  // "ma"|"di"|"wo"|"do"|"vr"|"za"|"zo"
  hour: number;
  span: number;       // number of hours this block occupies
};

type Grid = Record<typeof DAYS[number], Record<number, string | null>>;
```

---

## Key Constants

```ts
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;

const DAY_LABEL: Record<...> = {
  ma: "maandag", di: "dinsdag", wo: "woensdag", do: "donderdag",
  vr: "vrijdag", za: "zaterdag", zo: "zondag"
};
```

---

## Key Functions

### Utilities (top of file)

| Function           | Signature                            | Purpose                           |
|--------------------|--------------------------------------|-----------------------------------|
| `uid(prefix?)`     | `(string?) => string`                | Generate a random ID              |
| `clamp(n, a, b)`   | `(number, number, number) => number` | Clamp n between a and b           |
| `toHHMM(n)`        | `(number) => string`                 | Convert hour integer to "HH:00"   |
| `useLocalState<T>` | custom hook                          | useState + localStorage sync      |

### Business Logic (inside `PlanningApp`)

| Function          | Purpose                                                              |
|-------------------|----------------------------------------------------------------------|
| `autoSchedule()`  | Auto-schedules open tasks into matching grid cells                   |
| `downloadICS()`   | Generates and triggers download of an `.ics` calendar file          |
| `exportTasksCSV()`| Exports task list as `.csv`                                          |
| `handleFile()`    | Reads XLSX/CSV file using the `XLSX` library                        |
| `applyHeaderRow()`| Adjusts which row of an imported file is the header                 |
| `mapImportToTasks()` | Maps imported spreadsheet rows to `Task` objects via heuristic column name matching |

### Grid Painting (inside `PlanningApp`)

| Function                        | Purpose                                         |
|---------------------------------|-------------------------------------------------|
| `handleCellDown(ev, day, hour)` | Start paint operation on mousedown              |
| `handleCellEnter(day, hour)`    | Continue paint operation on mouseenter          |
| `handleMouseUp()`               | End paint operation on global mouseup           |

---

## Auto-Scheduler Logic (`autoSchedule`)

The scheduler works as follows:

1. **Filter**: Only tasks with `status !== "klaar"` are scheduled.
2. **Sort**: Descending priority → ascending deadline → descending duration.
3. **Slot matching**: For each task, eligible grid cells are found by matching `task.context` to `category.naam`:
   - `"thuis"` → cells with a category whose name includes `"huiswerk"`
   - `"stage"` → cells with a category whose name includes `"stage"`
   - `"school"` → cells with `"school"` or `"les"` in category name
   - `"overig"` → cells with `"vrij"` or `context === "overig"` categories
   - Cells with `"slaap"` in category name are **always excluded**
4. **Fallback slots**: For `school`/`overig` tasks, "vrij" (free) and empty cells are also considered.
5. **Placement**: Contiguous same-day blocks are preferred. A task requiring `n` hours may be split across multiple non-contiguous placements.
6. **Status update**: After placement, `status` is set to `"gepland"` (fully placed), `"gedeeltelijk"` (partially placed), or left unchanged.

---

## ICS Export Format

The exported `.ics` file uses UTC timestamps and targets `Europe/Amsterdam` timezone (informational only). Key fields:

- `DTSTART` / `DTEND`: derived from the current week, delta-calculated from today
- `SUMMARY`: task title (truncated at 120 chars, special characters stripped)
- `DESCRIPTION`: includes context and IO code

---

## Excel/CSV Import Wizard

The import wizard uses heuristic column matching. Columns are detected by scanning header names (case-insensitive, partial match):

| Task field   | Detected column names                          |
|--------------|------------------------------------------------|
| `titel`      | "titel", "taak", "opdracht", "io"             |
| `minuten`    | "min", "duur", "uren"                         |
| `deadline`   | "deadline", "datum", "oplever"                |
| `context`    | "context", "thuis", "roc", "stage"            |
| `io`         | "io", "opdracht", "code"                      |

Context is inferred from cell values: "stage" → stage, "school"/"roc" → school, "thuis" → thuis, otherwise overig.

---

## Styling Conventions

- **CSS framework**: Tailwind CSS utility classes (assumed loaded by the playground environment)
- **No custom CSS files**: All styles are inline Tailwind classes
- **Color pattern**: Category colors use `kleur + "33"` (20% opacity) for backgrounds and `kleur + "22"` / `kleur + "55"` for borders/badges
- **Layout**: `max-w-[1200px] mx-auto`, rounded cards (`rounded-2xl`), shadow borders
- **Responsive**: `grid md:grid-cols-6 grid-cols-2` pattern for task form

---

## Naming Conventions

This project uses **Dutch** for all user-facing and most internal naming:

| Pattern         | Example                                      |
|-----------------|----------------------------------------------|
| State variables | `cats`, `taken`, `placed`, `drawerOpen`      |
| Type fields     | `naam`, `kleur`, `titel`, `minuten`, `prio`  |
| LocalStorage    | `plan.cats`, `plan.tasks`, `plan.grid`       |
| UI text         | All Dutch ("volgende stap", "plan automatisch", etc.) |
| Code comments   | Dutch (e.g., `// Kleine helpers`, `// Stap-navigatie`) |

**Do not mix in English** naming when adding features. Keep the Dutch convention.

---

## Development Guidelines for AI Assistants

### Before making changes

1. Read the entire file — it is self-contained and the context is critical.
2. Understand which step (1/2/3) the change affects.
3. Check if the feature involves state that must be persisted to `localStorage` — if so, use `useLocalState` with a `plan.*` key.

### When adding new state

- Always use `useLocalState<T>("plan.<key>", defaultValue)` for persistent state.
- Choose descriptive but short Dutch key names.

### When adding new task fields

- Extend the `Task` type with the new field (optional if not always required).
- Update `NewTask` form (input + state), `mapImportToTasks` heuristics, CSV export header, and the task list table columns.

### When adding categories / context types

- The context union type `"thuis"|"stage"|"school"|"overig"` appears in multiple places: `Category`, `Task`, the `<select>` elements in `NewCategory` and `NewTask`, and the `autoSchedule` matching logic. All must be updated consistently.

### Grid changes

- The grid shape is `Record<day, Record<hour, catId|null>>`. Hour range is driven by `startHour`/`endHour`. When the range changes, a `useEffect` re-initializes the grid while preserving existing values.

### No external dependencies

- The XLSX library is loaded optionally via `try { XLSX = require("xlsx"); } catch {}`. Do not assume it is available.
- Do not introduce new `require()` or `import` calls for libraries that may not be available in the playground.

### Reset behavior

- The reset button calls `localStorage.clear()` followed by `location.reload()`. Any new `localStorage` keys with the `plan.*` prefix will be cleared by this action.

---

## No Build System

There is no `npm`, `package.json`, `tsconfig.json`, or bundler. The file runs as-is in the playground. Do not add build steps, install scripts, or config files unless the project explicitly migrates to a standalone build setup.

---

## Git Workflow

- Default development branch: `claude/claude-md-mlqzr856rftnov6g-8WBrL`
- Main branch: `master`
- Push with: `git push -u origin <branch-name>`
- Commit messages should be in English, descriptive, and reference the affected step or feature.

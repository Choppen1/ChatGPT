# Test Coverage Analysis

## Current State

**Test coverage: 0%** — The codebase has no test files, no testing framework configured, and no `package.json`. The entire application lives in a single 671-line React/JSX file (`Plannen in 3 stappen.jsx`).

---

## Codebase Summary

The application is a 3-step weekly planning tool (Dutch UI) built with React + Tailwind CSS. It features:

- A weekly schedule grid (step 1)
- A to-do list with task management (step 2)
- An auto-scheduler that assigns tasks to time slots (step 3)
- ICS/CSV export and XLSX import

---

## Recommended Test Areas (by priority)

### 1. Pure Utility Functions — HIGH priority, LOW effort

These are stateless, easy to extract and unit-test:

| Function | Line | What it does | Why test it |
|---|---|---|---|
| `uid(prefix)` | 12 | Generates random IDs | Verify format, uniqueness, prefix behavior |
| `clamp(n, a, b)` | 13 | Clamps number to range | Edge cases: n < a, n > b, n === a, n === b |
| `toHHMM(n)` | 14 | Formats hour number to `"HH:00"` | Single-digit padding, boundary values (0, 23) |

**Suggested tests:**
- `clamp(5, 0, 10)` returns `5`; `clamp(-1, 0, 10)` returns `0`; `clamp(15, 0, 10)` returns `10`
- `toHHMM(7)` returns `"07:00"`; `toHHMM(22)` returns `"22:00"`
- `uid("cat")` starts with `"cat_"` and has 7 random chars

---

### 2. Auto-Scheduling Algorithm — HIGH priority, HIGH effort

The `autoSchedule()` function (lines 120–209) is the most complex and critical logic in the app. It contains multiple sub-algorithms:

**a) Task sorting** (line 137–143): Sorts open tasks by priority (desc), deadline (asc), duration (desc). This determines scheduling order and directly affects outcomes.

**b) `allowedForTask(t, c)`** (lines 147–157): Maps task context to allowed category names. This is a pure function with clear rules:
- `"thuis"` tasks → only `"huiswerk"` categories
- `"stage"` tasks → only `"stage"` categories
- `"school"` tasks → `"school"` or `"les"` categories
- `"overig"` tasks → `"vrij"` or `context === "overig"` categories
- Never allows `"slaap"` categories

**c) `slotsForTask(t)`** (lines 159–176): Finds available slots, with fallback logic for school/overig tasks to also use "vrij" and empty slots.

**d) Contiguous block allocation** (lines 184–198): Greedy algorithm that tries to find contiguous hour blocks on the same day before splitting across slots.

**e) Status updates** (line 200): Sets task status to `"gepland"`, `"gedeeltelijk"`, or leaves unchanged based on how many hours were placed vs. needed.

**Suggested tests:**
- A high-priority task with a near deadline gets scheduled before a low-priority task
- A `"thuis"` task only gets placed in `"huiswerk"` slots
- A 3-hour task gets a contiguous block when 3 consecutive hours are available
- A task that can only partially fit gets status `"gedeeltelijk"`
- Tasks marked `"klaar"` are excluded from scheduling
- When no matching slots exist, the task status remains unchanged

---

### 3. ICS Export Generation — MEDIUM priority, MEDIUM effort

`downloadICS()` (lines 212–270) generates iCalendar data. The date calculation and string formatting are error-prone:

**Key logic to test:**
- Day-of-week offset calculation (lines 233–237): Converts `DAYS` index to a future date relative to "today"
- `toUTCStamp(d)` (line 219): ISO date → ICS timestamp format (`YYYYMMDDTHHMMSSZ`)
- Special character sanitization in summary/description (lines 243–247)
- Correct VEVENT structure with DTSTART, DTEND, UID

**Suggested tests:**
- Verify that a placed task on "wo" (Wednesday) generates the correct next-Wednesday date
- Verify `toUTCStamp` output format
- Verify that task titles with commas, semicolons, and newlines get sanitized
- Verify VCALENDAR/VEVENT structure is well-formed

---

### 4. CSV Export — MEDIUM priority, LOW effort

`exportTasksCSV()` (lines 273–278) has a subtle bug risk: task titles containing commas will break CSV column alignment since values are not quoted.

**Suggested tests:**
- Verify header row matches expected columns
- Verify that tasks are correctly serialized
- Test edge case: task title containing commas → currently broken, test would catch this

---

### 5. Import Wizard / Column Mapping — MEDIUM priority, MEDIUM effort

`mapImportToTasks()` (lines 315–343) uses heuristic column matching:

**Key logic to test:**
- Column name matching: `"titel"`, `"taak"`, `"opdracht"` all map to the title field
- Duration parsing: `"min"`, `"duur"`, `"uren"` → minutes field, defaults to 60
- Context inference: string containing `"stage"` → `"stage"`, `"school"` or `"roc"` → `"school"`, etc.
- Default values when columns are missing

**Suggested tests:**
- Import with columns named `["taak", "duur", "deadline"]` correctly maps fields
- A row with context `"ROC Mondriaan"` maps to `"school"`
- Missing duration defaults to 60 minutes
- Missing deadline results in `undefined`

---

### 6. `useLocalState` Hook — MEDIUM priority, LOW effort

The custom hook (lines 33–39) handles localStorage serialization with error handling.

**Suggested tests:**
- Returns initial value when localStorage is empty
- Persists value to localStorage on state change
- Handles corrupted/unparseable JSON gracefully (falls back to init)
- Handles `localStorage.setItem` throwing (e.g., quota exceeded)

---

### 7. Grid / Category Totals — LOW priority, LOW effort

`catTotals` (lines 106–114) and `vrijeUren` (line 117) are derived calculations.

**Suggested tests:**
- A grid with 3 cells set to category X reports `uren: 3` for that category
- Empty cells count as "vrije uren"
- Total hours across all categories sums correctly

---

### 8. Component Rendering — LOW priority, HIGH effort

Component tests for `PlanningApp`, `NewTask`, `NewCategory`, `Stepper`, and `CatBadge` would verify UI behavior but are lower priority than the business logic above.

**Suggested tests (if pursued):**
- `NewTask` form submission creates a task with correct fields
- `NewTask` doesn't submit when title is empty
- `NewCategory` doesn't submit when name is blank
- `Stepper` highlights the active step
- Grid cells respond to click-and-drag painting

---

## Recommended Setup

To enable testing, the project needs:

1. **Initialize npm project**: `npm init`
2. **Install testing framework**: Vitest (lightweight, Vite-native) or Jest + React Testing Library
3. **Extract pure logic into separate modules**: Move `uid`, `clamp`, `toHHMM`, scheduling logic, export functions, and import mapping into standalone `.ts` files so they can be unit-tested without rendering React components
4. **Add a `tsconfig.json`** for TypeScript support (the JSX file already uses TS annotations)

### Suggested file structure after refactoring:

```
src/
  utils.ts              # uid, clamp, toHHMM
  scheduler.ts          # autoSchedule logic, allowedForTask, slotsForTask
  export-ics.ts         # ICS generation
  export-csv.ts         # CSV generation
  import-wizard.ts      # mapImportToTasks, column mapping
  types.ts              # Task, Category, Placed, Grid types
  hooks/
    useLocalState.ts    # localStorage hook
  components/
    PlanningApp.tsx     # main component (slimmed down)
    NewTask.tsx
    NewCategory.tsx
    Stepper.tsx
    CatBadge.tsx
__tests__/
  utils.test.ts
  scheduler.test.ts
  export-ics.test.ts
  export-csv.test.ts
  import-wizard.test.ts
  useLocalState.test.ts
```

---

## Summary of Priorities

| Area | Priority | Effort | Impact |
|---|---|---|---|
| Utility functions (`clamp`, `toHHMM`, `uid`) | HIGH | LOW | Catches basic regressions |
| Auto-scheduler algorithm | HIGH | HIGH | Most complex and critical logic |
| ICS export | MEDIUM | MEDIUM | Date math is error-prone |
| CSV export | MEDIUM | LOW | Comma-in-title bug already exists |
| Import column mapping | MEDIUM | MEDIUM | Heuristic matching needs validation |
| `useLocalState` hook | MEDIUM | LOW | Data persistence correctness |
| Grid totals | LOW | LOW | Simple derived state |
| Component rendering | LOW | HIGH | UI correctness, less likely to regress |

The highest-value starting point is to **extract the pure utility functions and the scheduling algorithm into separate modules and write unit tests for them**. This gives the best coverage-to-effort ratio and protects the most critical business logic.

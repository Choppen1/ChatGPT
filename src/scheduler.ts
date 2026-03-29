import { DAYS, type Category, type Day, type Grid, type Placed, type Task } from "./types";

type Cell = {
  day: Day;
  hour: number;
  cat: Category | undefined;
  catId: string | null;
};

/** Returns true if category `c` allows task `t` based on context rules. */
export function allowedForTask(t: Task, c?: Category): boolean {
  if (!c) return false;
  const nm = c.naam.toLowerCase();
  if (nm.includes("slaap")) return false;
  if (t.context === "thuis") return nm.includes("huiswerk");
  if (t.context === "stage") return nm.includes("stage");
  if (t.context === "school") return nm.includes("school") || nm.includes("les");
  // overig → vrij/overig
  return nm.includes("vrij") || c.context === "overig";
}

/** Sort comparator: priority desc, deadline asc, duration desc. */
export function taskSortComparator(a: Task, b: Task): number {
  if (b.prioriteit !== a.prioriteit) return b.prioriteit - a.prioriteit;
  const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
  const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
  if (da !== db) return da - db;
  return b.minuten - a.minuten;
}

function sortByWeekOrder(arr: Cell[]): Cell[] {
  return arr.slice().sort((a, b) => {
    const da = DAYS.indexOf(a.day),
      db = DAYS.indexOf(b.day);
    if (da !== db) return da - db;
    return a.hour - b.hour;
  });
}

/** Find available slots for a task, considering category context. */
export function slotsForTask(
  t: Task,
  cells: Cell[],
  cats: Category[],
): Cell[] {
  const primary = cells.filter((c) => allowedForTask(t, c.cat));
  if (t.context === "thuis" || t.context === "stage") {
    return sortByWeekOrder(primary);
  }
  const vrijCat = cats.find((c) => c.naam.toLowerCase().includes("vrij"));
  const secondary = vrijCat ? cells.filter((c) => c.catId === vrijCat.id) : [];
  const empty = cells.filter((c) => !c.catId);
  const seen = new Set<string>();
  const combined = [...primary, ...secondary, ...empty].filter((c) => {
    const kk = `${c.day}-${c.hour}`;
    if (seen.has(kk)) return false;
    seen.add(kk);
    return true;
  });
  return sortByWeekOrder(combined);
}

export interface ScheduleResult {
  placements: Placed[];
  updatedTasks: Task[];
}

/**
 * Core auto-scheduling algorithm.
 * Takes tasks, categories and grid as input and returns placements + updated task statuses.
 */
export function autoSchedule(
  tasks: Task[],
  cats: Category[],
  grid: Grid,
  hours: number[],
): ScheduleResult {
  const catById = (id: string | null | undefined) =>
    cats.find((c) => c.id === id);

  // Build flat cell list from grid
  const cells: Cell[] = [];
  DAYS.forEach((d) =>
    hours.forEach((h) => {
      const cid = grid[d]?.[h] ?? null;
      cells.push({ day: d, hour: h, catId: cid, cat: catById(cid || undefined) });
    }),
  );

  const used = new Set<string>();
  const k = (d: Day, h: number) => `${d}-${h}`;

  // Sort: priority desc, deadline asc, duration desc
  const open = tasks
    .filter((t) => t.status !== "klaar")
    .slice()
    .sort(taskSortComparator);

  const placements: Placed[] = [];

  for (const t of open) {
    const need = Math.ceil(t.minuten / 60);
    const slots = slotsForTask(t, cells, cats).filter(
      (c) => !used.has(k(c.day, c.hour)),
    );
    let remaining = need;
    let placedForThis = 0;
    let idx = 0;

    while (remaining > 0 && idx < slots.length) {
      const start = slots[idx];
      // Find contiguous block on the same day
      let span = 1;
      while (span < remaining) {
        const nextCell = slots.find(
          (c) =>
            c.day === start.day &&
            c.hour === start.hour + span &&
            !used.has(k(c.day, c.hour)),
        );
        if (!nextCell) break;
        span++;
      }
      for (let s = 0; s < span; s++) used.add(k(start.day, start.hour + s));
      placements.push({ taskId: t.id, day: start.day, hour: start.hour, span });
      placedForThis += span;
      remaining -= span;
      // Skip to the next unused slot
      while (idx < slots.length && used.has(k(slots[idx].day, slots[idx].hour)))
        idx++;
    }

    t.status =
      placedForThis >= need
        ? "gepland"
        : placedForThis > 0
          ? "gedeeltelijk"
          : t.status;
  }

  // Merge status updates back
  const updatedTasks = tasks.map((tt) => {
    const src = open.find((o) => o.id === tt.id);
    return src ? { ...tt, status: src.status } : tt;
  });

  return { placements, updatedTasks };
}

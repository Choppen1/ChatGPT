import { describe, expect, it } from "vitest";
import {
  allowedForTask,
  taskSortComparator,
  slotsForTask,
  autoSchedule,
} from "../scheduler";
import { DAYS, type Category, type Grid, type Task } from "../types";

// --- Helpers ---

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    titel: "Test taak",
    minuten: 60,
    context: "thuis",
    prioriteit: 2,
    status: "open",
    ...overrides,
  };
}

function makeCat(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat1",
    naam: "huiswerk",
    kleur: "#f59e0b",
    context: "thuis",
    ...overrides,
  };
}

const defaultCats: Category[] = [
  { id: "c_les", naam: "les op school", kleur: "#2563eb", context: "school" },
  { id: "c_stage", naam: "stage", kleur: "#16a34a", context: "stage" },
  { id: "c_hw", naam: "huiswerk", kleur: "#f59e0b", context: "thuis" },
  { id: "c_sport", naam: "sport", kleur: "#ef4444", context: "overig" },
  { id: "c_slaap", naam: "slaap", kleur: "#6b7280", context: "overig" },
  { id: "c_vrij", naam: "vrij", kleur: "#10b981", context: "overig" },
];

function makeGrid(hours: number[], fills: Record<string, string | null> = {}): Grid {
  const g: any = {};
  DAYS.forEach((d) => {
    g[d] = {};
    hours.forEach((h) => {
      const key = `${d}-${h}`;
      g[d][h] = fills[key] ?? null;
    });
  });
  return g;
}

// --- Tests ---

describe("allowedForTask", () => {
  it("returns false when category is undefined", () => {
    expect(allowedForTask(makeTask(), undefined)).toBe(false);
  });

  it("never allows 'slaap' categories", () => {
    const sleepCat = makeCat({ naam: "slaap", context: "overig" });
    expect(allowedForTask(makeTask({ context: "thuis" }), sleepCat)).toBe(false);
    expect(allowedForTask(makeTask({ context: "overig" }), sleepCat)).toBe(false);
  });

  it("'thuis' tasks only match 'huiswerk' categories", () => {
    const task = makeTask({ context: "thuis" });
    expect(allowedForTask(task, makeCat({ naam: "huiswerk" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "stage" }))).toBe(false);
    expect(allowedForTask(task, makeCat({ naam: "les op school" }))).toBe(false);
    expect(allowedForTask(task, makeCat({ naam: "vrij" }))).toBe(false);
  });

  it("'stage' tasks only match 'stage' categories", () => {
    const task = makeTask({ context: "stage" });
    expect(allowedForTask(task, makeCat({ naam: "stage" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "huiswerk" }))).toBe(false);
    expect(allowedForTask(task, makeCat({ naam: "les op school" }))).toBe(false);
  });

  it("'school' tasks match 'school' or 'les' categories", () => {
    const task = makeTask({ context: "school" });
    expect(allowedForTask(task, makeCat({ naam: "les op school" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "school" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "huiswerk" }))).toBe(false);
    expect(allowedForTask(task, makeCat({ naam: "stage" }))).toBe(false);
  });

  it("'overig' tasks match 'vrij' or context=overig categories", () => {
    const task = makeTask({ context: "overig" });
    expect(allowedForTask(task, makeCat({ naam: "vrij", context: "overig" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "sport", context: "overig" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "huiswerk", context: "thuis" }))).toBe(false);
  });

  it("matching is case-insensitive", () => {
    const task = makeTask({ context: "thuis" });
    expect(allowedForTask(task, makeCat({ naam: "Huiswerk" }))).toBe(true);
    expect(allowedForTask(task, makeCat({ naam: "HUISWERK" }))).toBe(true);
  });
});

describe("taskSortComparator", () => {
  it("sorts by priority descending (high first)", () => {
    const hi = makeTask({ prioriteit: 3 });
    const lo = makeTask({ prioriteit: 1 });
    // comparator(a, b) < 0 means a comes first in sorted order
    expect(taskSortComparator(hi, lo)).toBeLessThan(0);
    expect(taskSortComparator(lo, hi)).toBeGreaterThan(0);
  });

  it("sorts by deadline ascending when priorities are equal", () => {
    const early = makeTask({ prioriteit: 2, deadline: "2026-01-01" });
    const late = makeTask({ prioriteit: 2, deadline: "2026-12-31" });
    expect(taskSortComparator(early, late)).toBeLessThan(0);
  });

  it("tasks without deadline come after tasks with deadline", () => {
    const withDL = makeTask({ prioriteit: 2, deadline: "2026-06-01" });
    const noDL = makeTask({ prioriteit: 2 });
    expect(taskSortComparator(withDL, noDL)).toBeLessThan(0);
  });

  it("sorts by duration descending when priority and deadline are equal", () => {
    const long = makeTask({ prioriteit: 2, minuten: 120 });
    const short = makeTask({ prioriteit: 2, minuten: 30 });
    // longer tasks first: comparator(long, short) < 0
    expect(taskSortComparator(long, short)).toBeLessThan(0);
  });
});

describe("autoSchedule", () => {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15];

  it("places a 'thuis' task into 'huiswerk' slots", () => {
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
      "ma-9": "c_hw",
    });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 60 });
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.placements[0].taskId).toBe("t1");
    expect(result.placements[0].day).toBe("ma");
    expect(result.placements[0].hour).toBe(8);
  });

  it("sets task status to 'gepland' when fully placed", () => {
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
      "ma-9": "c_hw",
    });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 60 });
    const result = autoSchedule([task], defaultCats, grid, hours);

    const updated = result.updatedTasks.find((t) => t.id === "t1");
    expect(updated?.status).toBe("gepland");
  });

  it("sets task status to 'gedeeltelijk' when only partially placed", () => {
    // Only 1 huiswerk slot available, but task needs 2 hours
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
    });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 120 });
    const result = autoSchedule([task], defaultCats, grid, hours);

    const updated = result.updatedTasks.find((t) => t.id === "t1");
    expect(updated?.status).toBe("gedeeltelijk");
  });

  it("skips tasks with status 'klaar'", () => {
    const grid = makeGrid(hours, { "ma-8": "c_hw" });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 60, status: "klaar" });
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements).toHaveLength(0);
    expect(result.updatedTasks[0].status).toBe("klaar");
  });

  it("schedules higher-priority tasks first", () => {
    // Only 1 huiswerk slot for 2 tasks
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
    });
    const lowPrio = makeTask({ id: "low", context: "thuis", minuten: 60, prioriteit: 1 });
    const highPrio = makeTask({ id: "high", context: "thuis", minuten: 60, prioriteit: 3 });
    const result = autoSchedule([lowPrio, highPrio], defaultCats, grid, hours);

    // High-priority task should get the only slot
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].taskId).toBe("high");
  });

  it("creates contiguous blocks when consecutive hours are available", () => {
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
      "ma-9": "c_hw",
      "ma-10": "c_hw",
    });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 180 }); // 3 hours
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].span).toBe(3);
    expect(result.placements[0].hour).toBe(8);
  });

  it("splits across days when a single day has insufficient slots", () => {
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
      "di-8": "c_hw",
    });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 120 }); // 2 hours
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements).toHaveLength(2);
    expect(result.placements[0].day).toBe("ma");
    expect(result.placements[1].day).toBe("di");
  });

  it("'stage' tasks only go into 'stage' slots", () => {
    const grid = makeGrid(hours, {
      "ma-8": "c_hw",
      "ma-9": "c_stage",
    });
    const task = makeTask({ id: "t1", context: "stage", minuten: 60 });
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].hour).toBe(9); // the stage slot
  });

  it("returns empty placements when no matching slots exist", () => {
    const grid = makeGrid(hours, {
      "ma-8": "c_les",
    });
    const task = makeTask({ id: "t1", context: "thuis", minuten: 60 });
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements).toHaveLength(0);
    expect(result.updatedTasks[0].status).toBe("open"); // unchanged
  });

  it("'overig' tasks can use empty slots as fallback", () => {
    // No specific category set, all slots empty
    const grid = makeGrid(hours);
    const task = makeTask({ id: "t1", context: "overig", minuten: 60 });
    const result = autoSchedule([task], defaultCats, grid, hours);

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.updatedTasks.find((t) => t.id === "t1")?.status).toBe("gepland");
  });
});

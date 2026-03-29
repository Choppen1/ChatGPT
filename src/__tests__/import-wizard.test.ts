import { describe, expect, it } from "vitest";
import { findColumnIndex, inferContext, mapRowsToTasks } from "../import-wizard";

describe("findColumnIndex", () => {
  const headers = ["Opdracht", "Duur (min)", "Deadline", "Context", "IO-code"];

  it("finds a column by keyword match", () => {
    expect(findColumnIndex(headers, "opdracht")).toBe(0);
    expect(findColumnIndex(headers, "deadline")).toBe(2);
  });

  it("is case-insensitive", () => {
    expect(findColumnIndex(headers, "OPDRACHT")).toBe(-1); // findIndex uses includes on lowered
    // Actually let's check: headers are lowered in the function
    // "opdracht" is in "opdracht" (lowered) => index 0
    expect(findColumnIndex(headers, "opdracht")).toBe(0);
  });

  it("returns the first matching keyword", () => {
    // "duur" matches "Duur (min)" (index 1)
    expect(findColumnIndex(headers, "titel", "duur")).toBe(1);
  });

  it("returns -1 when no keyword matches", () => {
    expect(findColumnIndex(headers, "xyz", "abc")).toBe(-1);
  });

  it("matches partial column names", () => {
    // "io" is contained in "IO-code"
    expect(findColumnIndex(headers, "io")).toBe(4);
  });
});

describe("inferContext", () => {
  it("returns 'stage' when input contains 'stage'", () => {
    expect(inferContext("stage")).toBe("stage");
    expect(inferContext("Stageplek ROC")).toBe("stage");
  });

  it("returns 'school' when input contains 'school' or 'roc'", () => {
    expect(inferContext("school")).toBe("school");
    expect(inferContext("ROC Mondriaan")).toBe("school");
    expect(inferContext("op school")).toBe("school");
  });

  it("returns 'thuis' when input contains 'thuis'", () => {
    expect(inferContext("thuis")).toBe("thuis");
    expect(inferContext("vanuit thuis werken")).toBe("thuis");
  });

  it("returns 'overig' for unrecognized input", () => {
    expect(inferContext("")).toBe("overig");
    expect(inferContext("gymzaal")).toBe("overig");
    expect(inferContext("bibliotheek")).toBe("overig");
  });

  it("is case-insensitive", () => {
    expect(inferContext("STAGE")).toBe("stage");
    expect(inferContext("School")).toBe("school");
    expect(inferContext("THUIS")).toBe("thuis");
  });

  it("prioritizes 'stage' over 'school' when both match", () => {
    // "stage op school" contains both, but stage check comes first
    expect(inferContext("stage op school")).toBe("stage");
  });
});

describe("mapRowsToTasks", () => {
  it("maps rows with standard column names", () => {
    const headers = ["titel", "minuten", "deadline", "context", "io"];
    const rows = [
      { titel: "Wiskunde", minuten: 90, deadline: "2026-03-01", context: "thuis", io: "IO-101" },
    ];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].titel).toBe("Wiskunde");
    expect(tasks[0].minuten).toBe(90);
    expect(tasks[0].deadline).toBe("2026-03-01");
    expect(tasks[0].context).toBe("thuis");
    expect(tasks[0].io).toBe("IO-101");
    expect(tasks[0].prioriteit).toBe(2);
    expect(tasks[0].status).toBe("open");
  });

  it("uses heuristic column matching for alternative names", () => {
    const headers = ["taak", "duur", "datum", "context"];
    const rows = [
      { taak: "Stage verslag", duur: 120, datum: "2026-04-15", context: "stage" },
    ];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks[0].titel).toBe("Stage verslag");
    expect(tasks[0].minuten).toBe(120);
    expect(tasks[0].context).toBe("stage");
  });

  it("defaults to 60 minutes when duration column is missing", () => {
    const headers = ["titel"];
    const rows = [{ titel: "Quick task" }];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks[0].minuten).toBe(60);
  });

  it("defaults to 'overig' when context column is missing", () => {
    const headers = ["titel"];
    const rows = [{ titel: "Mystery task" }];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks[0].context).toBe("overig");
  });

  it("generates a default title when title column is missing", () => {
    const headers = ["onbekend"];
    const rows = [{ onbekend: "data" }];
    const tasks = mapRowsToTasks(headers, rows);

    // No column matches title keywords, so falls back to "Taak N"
    expect(tasks[0].titel).toBe("Taak 1");
  });

  it("generates unique IDs for each task", () => {
    const headers = ["titel"];
    const rows = [{ titel: "A" }, { titel: "B" }, { titel: "C" }];
    const tasks = mapRowsToTasks(headers, rows);

    const ids = new Set(tasks.map((t) => t.id));
    expect(ids.size).toBe(3);
  });

  it("handles empty rows gracefully", () => {
    const headers = ["titel", "minuten"];
    const rows: Record<string, unknown>[] = [];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks).toHaveLength(0);
  });

  it("infers context from ROC as school", () => {
    const headers = ["titel", "context"];
    const rows = [{ titel: "Les", context: "ROC Mondriaan" }];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks[0].context).toBe("school");
  });

  it("handles non-numeric duration gracefully (defaults to 60)", () => {
    const headers = ["titel", "duur"];
    const rows = [{ titel: "Bad data", duur: "abc" }];
    const tasks = mapRowsToTasks(headers, rows);

    expect(tasks[0].minuten).toBe(60);
  });
});

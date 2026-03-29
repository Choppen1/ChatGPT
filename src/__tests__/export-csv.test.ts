import { describe, expect, it } from "vitest";
import { escapeCSVField, generateTasksCSV } from "../export-csv";
import type { Task } from "../types";

describe("escapeCSVField", () => {
  it("returns plain text unchanged", () => {
    expect(escapeCSVField("hello")).toBe("hello");
  });

  it("wraps text with commas in quotes", () => {
    expect(escapeCSVField("hello, world")).toBe('"hello, world"');
  });

  it("wraps text with quotes and escapes inner quotes", () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps text with newlines in quotes", () => {
    expect(escapeCSVField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles empty string", () => {
    expect(escapeCSVField("")).toBe("");
  });
});

describe("generateTasksCSV", () => {
  const tasks: Task[] = [
    {
      id: "t1",
      titel: "Wiskunde",
      minuten: 60,
      deadline: "2026-03-01",
      context: "thuis",
      io: "IO-101",
      prioriteit: 3,
      status: "open",
    },
    {
      id: "t2",
      titel: "Stage verslag",
      minuten: 120,
      context: "stage",
      prioriteit: 2,
      status: "gepland",
    },
  ];

  it("starts with the correct header", () => {
    const csv = generateTasksCSV(tasks);
    const header = csv.split("\n")[0];
    expect(header).toBe("titel,minuten,deadline,context,io,prioriteit,status");
  });

  it("has correct number of data rows", () => {
    const csv = generateTasksCSV(tasks);
    const lines = csv.split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBe(3); // 1 header + 2 data rows
  });

  it("serializes task fields correctly", () => {
    const csv = generateTasksCSV(tasks);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("Wiskunde,60,2026-03-01,thuis,IO-101,3,open");
  });

  it("handles missing optional fields", () => {
    const csv = generateTasksCSV(tasks);
    const lines = csv.split("\n");
    // Stage verslag has no deadline and no io
    expect(lines[2]).toBe("Stage verslag,120,,stage,,2,gepland");
  });

  it("escapes titles containing commas", () => {
    const tricky: Task[] = [
      {
        id: "t3",
        titel: "Taak A, B en C",
        minuten: 30,
        context: "overig",
        prioriteit: 1,
        status: "open",
      },
    ];
    const csv = generateTasksCSV(tricky);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"Taak A, B en C"');
  });

  it("returns only header for empty task list", () => {
    const csv = generateTasksCSV([]);
    expect(csv).toBe("titel,minuten,deadline,context,io,prioriteit,status\n");
  });
});

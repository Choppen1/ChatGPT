import { describe, expect, it } from "vitest";
import {
  toUTCStamp,
  sanitizeICSText,
  dayToDate,
  generateICSContent,
} from "../export-ics";
import type { Placed, Task } from "../types";

describe("toUTCStamp", () => {
  it("formats a date as YYYYMMDDTHHMMSSZ", () => {
    const d = new Date("2026-03-15T10:30:00Z");
    expect(toUTCStamp(d)).toBe("20260315T103000Z");
  });

  it("handles midnight correctly", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(toUTCStamp(d)).toBe("20260101T000000Z");
  });

  it("handles end-of-day correctly", () => {
    const d = new Date("2026-12-31T23:59:59Z");
    expect(toUTCStamp(d)).toBe("20261231T235959Z");
  });
});

describe("sanitizeICSText", () => {
  it("removes newlines", () => {
    expect(sanitizeICSText("line1\nline2\r\nline3")).toBe("line1 line2 line3");
  });

  it("removes commas and semicolons", () => {
    expect(sanitizeICSText("a,b;c")).toBe("a b c");
  });

  it("collapses multiple special chars into one space", () => {
    expect(sanitizeICSText("a,,;;b")).toBe("a b");
  });

  it("leaves clean text unchanged", () => {
    expect(sanitizeICSText("Wiskunde hoofdstuk 3")).toBe("Wiskunde hoofdstuk 3");
  });
});

describe("dayToDate", () => {
  it("returns the same date when refDate's weekday matches the target day", () => {
    // 2026-02-16 is a Monday (ma)
    const ref = new Date(2026, 1, 16, 12, 0, 0);
    const result = dayToDate(ref, "ma", 9);
    expect(result.getDate()).toBe(16);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it("returns the next Wednesday when ref is Monday", () => {
    // 2026-02-16 is a Monday
    const ref = new Date(2026, 1, 16, 12, 0, 0);
    const result = dayToDate(ref, "wo", 14);
    expect(result.getDate()).toBe(18); // Wednesday
    expect(result.getHours()).toBe(14);
  });

  it("wraps to next week for days before ref in the week", () => {
    // 2026-02-18 is a Wednesday, asking for Monday wraps to next Monday
    const ref = new Date(2026, 1, 18, 12, 0, 0);
    const result = dayToDate(ref, "ma", 8);
    expect(result.getDate()).toBe(23); // next Monday
  });

  it("handles Sunday correctly", () => {
    // 2026-02-16 is Monday, Sunday is 6 days later
    const ref = new Date(2026, 1, 16, 12, 0, 0);
    const result = dayToDate(ref, "zo", 10);
    expect(result.getDate()).toBe(22);
  });
});

describe("generateICSContent", () => {
  const task: Task = {
    id: "t1",
    titel: "Wiskunde oefenen",
    minuten: 60,
    context: "thuis",
    prioriteit: 2,
    status: "gepland",
  };

  const placed: Placed = {
    taskId: "t1",
    day: "ma",
    hour: 9,
    span: 1,
  };

  it("generates valid VCALENDAR structure", () => {
    const ics = generateICSContent([placed], [task]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("METHOD:PUBLISH");
  });

  it("contains VEVENT for each placement", () => {
    const ics = generateICSContent([placed], [task]);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("SUMMARY:Wiskunde oefenen");
    expect(ics).toContain("DESCRIPTION:Context: thuis");
  });

  it("includes IO info in description when present", () => {
    const taskWithIO: Task = { ...task, io: "IO-123" };
    const ics = generateICSContent([placed], [taskWithIO]);
    expect(ics).toContain("IO/Opdracht: IO-123");
  });

  it("skips placements with no matching task", () => {
    const orphan: Placed = { taskId: "nonexistent", day: "di", hour: 10, span: 1 };
    const ics = generateICSContent([orphan], [task]);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("returns empty calendar when no placements", () => {
    const ics = generateICSContent([], [task]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("uses CRLF line endings", () => {
    const ics = generateICSContent([placed], [task]);
    expect(ics).toContain("\r\n");
    // Should not have bare LF without CR
    const withoutCRLF = ics.replace(/\r\n/g, "");
    expect(withoutCRLF).not.toContain("\n");
  });
});

import type { Task } from "./types";

/** Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines. */
export function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate CSV content string from tasks.
 * Returns the full CSV text (without triggering a download).
 */
export function generateTasksCSV(tasks: Task[]): string {
  const header = "titel,minuten,deadline,context,io,prioriteit,status\n";
  const rows = tasks.map((t) =>
    [
      escapeCSVField(t.titel),
      String(t.minuten),
      t.deadline || "",
      t.context,
      escapeCSVField(t.io || ""),
      String(t.prioriteit),
      t.status,
    ].join(","),
  );
  return header + rows.join("\n");
}

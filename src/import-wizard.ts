import type { Task } from "./types";
import { uid } from "./utils";

/**
 * Find the first matching column index from a list of header names.
 * Matches if the header contains the given keyword (case-insensitive).
 */
export function findColumnIndex(
  headers: string[],
  ...keywords: string[]
): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Infer task context from a string value. */
export function inferContext(value: string): Task["context"] {
  const v = value.toLowerCase();
  if (v.includes("stage")) return "stage";
  if (v.includes("school") || v.includes("roc")) return "school";
  if (v.includes("thuis")) return "thuis";
  return "overig";
}

/**
 * Map raw import rows (array of objects keyed by header name) to Task objects.
 * Uses heuristic column name matching.
 */
export function mapRowsToTasks(
  headers: string[],
  rows: Record<string, unknown>[],
): Task[] {
  const iTitel = findColumnIndex(headers, "titel", "taak", "opdracht", "io");
  const iMin = findColumnIndex(headers, "min", "duur", "uren");
  const iDDL = findColumnIndex(headers, "deadline", "datum", "oplever");
  const iCtx = findColumnIndex(headers, "context", "thuis", "roc", "stage");
  const iIO = findColumnIndex(headers, "io", "opdracht", "code");

  const titelKey = iTitel >= 0 ? headers[iTitel] : null;
  const minKey = iMin >= 0 ? headers[iMin] : null;
  const ddlKey = iDDL >= 0 ? headers[iDDL] : null;
  const ctxKey = iCtx >= 0 ? headers[iCtx] : null;
  const ioKey = iIO >= 0 ? headers[iIO] : null;

  return rows.map((r, rowIdx) => ({
    id: uid("t"),
    titel: String(titelKey && r[titelKey] != null ? r[titelKey] : `Taak ${rowIdx + 1}`),
    minuten: Math.round(Number(minKey && r[minKey] != null ? r[minKey] : 60)) || 60,
    deadline:
      ddlKey && r[ddlKey]
        ? new Date(String(r[ddlKey])).toISOString().slice(0, 10)
        : undefined,
    context: ctxKey ? inferContext(String(r[ctxKey] ?? "")) : "overig",
    io: ioKey ? String(r[ioKey] ?? "") : undefined,
    prioriteit: 2 as const,
    status: "open" as const,
  }));
}

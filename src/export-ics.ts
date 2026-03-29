import { DAYS, DAY_LABEL, type Day, type Placed, type Task } from "./types";
import { uid } from "./utils";

/** Convert a Date to ICS UTC timestamp format: YYYYMMDDTHHMMSSZ */
export function toUTCStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Sanitize text for ICS fields (remove newlines, commas, semicolons). */
export function sanitizeICSText(text: string): string {
  return text.replace(/[\r\n,;]+/g, " ");
}

/**
 * Compute the target Date for a given day-of-week relative to a reference date.
 * Returns a Date set to the given hour on the next occurrence of that weekday.
 */
export function dayToDate(
  refDate: Date,
  day: Day,
  hour: number,
): Date {
  const jsDow = refDate.getDay(); // 0=zo..6=za
  const todayMonIdx = jsDow === 0 ? 6 : jsDow - 1; // 0=ma..6=zo
  const targetIdx = DAYS.indexOf(day);
  const delta = ((targetIdx - todayMonIdx) + 7) % 7;
  const result = new Date(refDate);
  result.setDate(refDate.getDate() + delta);
  result.setHours(hour, 0, 0, 0);
  return result;
}

/**
 * Generate ICS calendar content string from placements and tasks.
 * Returns the full VCALENDAR text (without triggering a download).
 */
export function generateICSContent(
  placed: Placed[],
  tasks: Task[],
  refDate: Date = new Date(),
): string {
  const TZ = "Europe/Amsterdam";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//ROC Planner//NL",
    "X-WR-CALNAME:ROC Planner",
    `X-WR-TIMEZONE:${TZ}`,
  ];

  placed.forEach((p) => {
    const t = tasks.find((x) => x.id === p.taskId);
    if (!t) return;

    const start = dayToDate(refDate, p.day, p.hour);
    const end = new Date(start);
    end.setHours(start.getHours() + p.span);

    const summary = sanitizeICSText(t.titel || "Taak").slice(0, 120);
    const desc = sanitizeICSText(
      `Context: ${t.context}${t.io ? " | IO/Opdracht: " + t.io : ""}`,
    );

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid("evt")}`,
      `DTSTAMP:${toUTCStamp(refDate)}`,
      `DTSTART:${toUTCStamp(start)}`,
      `DTEND:${toUTCStamp(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

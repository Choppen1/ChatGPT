export const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABEL: Record<Day, string> = {
  ma: "maandag",
  di: "dinsdag",
  wo: "woensdag",
  do: "donderdag",
  vr: "vrijdag",
  za: "zaterdag",
  zo: "zondag",
};

export type Category = {
  id: string;
  naam: string;
  kleur: string;
  context: "thuis" | "stage" | "school" | "overig";
};

export type Task = {
  id: string;
  titel: string;
  minuten: number;
  deadline?: string; // ISO date
  context: "thuis" | "stage" | "school" | "overig";
  io?: string;
  prioriteit: 1 | 2 | 3;
  status: "open" | "gepland" | "gedeeltelijk" | "klaar";
};

export type Placed = {
  taskId: string;
  day: Day;
  hour: number;
  span: number;
};

export type Grid = Record<Day, Record<number, string | null>>;

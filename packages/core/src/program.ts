import { addDays, diffDays, startOfIsoWeek, weekday, type DateKey } from './dates';

/**
 * Día del programa (1 = día de inicio). Devuelve un número ≤ 0 antes del inicio.
 */
export function programDay(start: DateKey, today: DateKey): number {
  return diffDays(start, today) + 1;
}

/**
 * Semana del programa (1 = los primeros 7 días desde el inicio).
 * Antes del inicio se considera semana 1 para mostrar las metas que aplicarán.
 */
export function programWeek(start: DateKey, today: DateKey): number {
  const d = diffDays(start, today);
  return d < 0 ? 1 : Math.floor(d / 7) + 1;
}

/** Inicio (día 1) de la semana de programa que contiene la fecha. */
export function programWeekStart(start: DateKey, today: DateKey): DateKey {
  return addDays(start, (programWeek(start, today) - 1) * 7);
}

/**
 * Próxima revisión semanal: la primera fecha de revisión + múltiplos de 7 días
 * que sea igual o posterior a hoy.
 */
export function nextReviewDate(firstReview: DateKey, today: DateKey): DateKey {
  const d = diffDays(firstReview, today);
  if (d <= 0) return firstReview;
  return addDays(firstReview, Math.ceil(d / 7) * 7);
}

// ---------------------------------------------------------------------------
// Metas progresivas (agua / refresco)
// ---------------------------------------------------------------------------

export interface WeeklyHydrationGoal {
  weekNumber: number;
  waterMl: number;
  sodaMaxGlasses: number | null;
}

export const DEFAULT_HYDRATION_GOALS: WeeklyHydrationGoal[] = [
  { weekNumber: 1, waterMl: 1200, sodaMaxGlasses: 4 },
  { weekNumber: 2, waterMl: 1500, sodaMaxGlasses: 3 },
  { weekNumber: 3, waterMl: 1800, sodaMaxGlasses: 2 },
  { weekNumber: 4, waterMl: 2000, sodaMaxGlasses: 1 },
];

/**
 * Meta vigente para una semana: la definida con el mayor número de semana que
 * no supere la semana actual. Después de la última semana definida, la última
 * meta se mantiene.
 */
export function goalForWeek<T extends { weekNumber: number }>(goals: T[], week: number): T | null {
  if (goals.length === 0) return null;
  const sorted = [...goals].sort((a, b) => a.weekNumber - b.weekNumber);
  let current = sorted[0]!;
  for (const g of sorted) if (g.weekNumber <= week) current = g;
  return current;
}

// ---------------------------------------------------------------------------
// Calendario de entrenamiento y alternancia de rutinas
// ---------------------------------------------------------------------------

export type ActivityKind = 'STRENGTH' | 'WALK_MOBILITY' | 'ACTIVE_REST' | 'REST';
export type RoutineCode = 'A' | 'B';

/** Índice = día de la semana (0 = domingo). */
export const DEFAULT_WEEKLY_SCHEDULE: ActivityKind[] = [
  'REST', // domingo
  'STRENGTH', // lunes
  'WALK_MOBILITY', // martes
  'STRENGTH', // miércoles
  'WALK_MOBILITY', // jueves
  'STRENGTH', // viernes
  'ACTIVE_REST', // sábado
];

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  STRENGTH: 'Fuerza',
  WALK_MOBILITY: 'Caminata y movilidad',
  ACTIVE_REST: 'Descanso activo (opcional)',
  REST: 'Descanso',
};

/**
 * Índice de semana de entrenamiento (semanas lunes–domingo). La semana 0 es la
 * semana del inicio; si el programa inicia en domingo (día de descanso), la
 * semana 0 es la que comienza al día siguiente.
 */
export function trainingWeekIndex(programStart: DateKey, date: DateKey): number {
  let anchor = startOfIsoWeek(programStart);
  if (weekday(programStart) === 0) anchor = addDays(anchor, 7);
  return Math.max(0, Math.floor(diffDays(anchor, startOfIsoWeek(date)) / 7));
}

/**
 * Rutina de fuerza para una fecha. Semanas pares: A/B/A; impares: B/A/B.
 * Devuelve null si ese día no toca fuerza.
 */
export function routineForDate(
  programStart: DateKey,
  date: DateKey,
  schedule: ActivityKind[] = DEFAULT_WEEKLY_SCHEDULE,
): RoutineCode | null {
  const wd = weekday(date);
  if (schedule[wd] !== 'STRENGTH') return null;
  // Posición de esta sesión de fuerza dentro de la semana (lunes primero).
  const order = [1, 2, 3, 4, 5, 6, 0];
  const strengthDays = order.filter((d) => schedule[d] === 'STRENGTH');
  const position = strengthDays.indexOf(wd);
  const weekIdx = trainingWeekIndex(programStart, date);
  const startWithA = weekIdx % 2 === 0;
  const isA = position % 2 === 0 ? startWithA : !startWithA;
  return isA ? 'A' : 'B';
}

export interface PlannedActivity {
  date: DateKey;
  kind: ActivityKind;
  routine: RoutineCode | null;
  label: string;
}

export function plannedActivity(
  programStart: DateKey,
  date: DateKey,
  schedule: ActivityKind[] = DEFAULT_WEEKLY_SCHEDULE,
): PlannedActivity {
  const kind = schedule[weekday(date)] ?? 'REST';
  const routine = routineForDate(programStart, date, schedule);
  const label = routine ? `Fuerza ${routine}` : ACTIVITY_LABEL[kind];
  return { date, kind, routine, label };
}

// ---------------------------------------------------------------------------
// Progresión inicial
// ---------------------------------------------------------------------------

export interface ProgressionLevel {
  level: number;
  setsMin: number;
  setsMax: number;
  walkMinutesMin: number;
  walkMinutesMax: number;
}

export const DEFAULT_PROGRESSION: ProgressionLevel[] = [
  { level: 1, setsMin: 1, setsMax: 2, walkMinutesMin: 10, walkMinutesMax: 15 },
  { level: 2, setsMin: 2, setsMax: 2, walkMinutesMin: 15, walkMinutesMax: 20 },
  { level: 3, setsMin: 2, setsMax: 2, walkMinutesMin: 20, walkMinutesMax: 25 },
  { level: 4, setsMin: 2, setsMax: 2, walkMinutesMin: 25, walkMinutesMax: 30 },
];

export interface WeekRecoveryReport {
  week: number;
  /** Se reportó dolor, fatiga excesiva o mala recuperación esa semana. */
  adverse: boolean;
}

/**
 * Nivel de progresión para la semana actual. Cada semana completada sin
 * reportes adversos avanza un nivel; una semana con dolor, fatiga excesiva o
 * mala recuperación NO avanza (se mantiene el nivel, nunca se sube
 * automáticamente). Las semanas sin datos cuentan como sin reportes adversos.
 */
export function progressionLevel(
  currentWeek: number,
  reports: WeekRecoveryReport[],
  table: ProgressionLevel[] = DEFAULT_PROGRESSION,
): ProgressionLevel {
  const adverseWeeks = new Set(reports.filter((r) => r.adverse).map((r) => r.week));
  let level = 1;
  for (let w = 1; w < currentWeek; w++) if (!adverseWeeks.has(w)) level++;
  const idx = Math.min(level, table.length) - 1;
  return table[Math.max(0, idx)]!;
}

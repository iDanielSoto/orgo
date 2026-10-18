import type { ActivityKind } from './program';

export type HabitAutoRule =
  | 'NONE'
  | 'SCHEDULED_ACTIVITY'
  | 'SODA_LIMIT'
  | 'WATER_GOAL'
  | 'PROTEIN_MEALS'
  | 'SLEEP_WINDOW'
  | 'WEEKLY_WEIGH_IN';

export type HabitStatus = 'met' | 'not_met' | 'pending' | 'na' | 'no_data';

/** Resumen de un día usado para evaluar hábitos automáticos. */
export interface DayAggregate {
  date: string;
  isToday: boolean;
  /** Hubo al menos un registro de bebida ese día. */
  beveragesLogged: boolean;
  waterMl: number;
  waterGoalMl: number | null;
  sodaGlasses: number;
  sodaMaxGlasses: number | null;
  plannedKind: ActivityKind;
  activityDone: boolean;
  mainMealsLogged: number;
  mainMealsWithProtein: number;
  /** Sueño que terminó este día (al despertar), en minutos. */
  sleepMinutes: number | null;
  sleepTargetMinutes: number;
  /** Hay registro de peso en la semana de programa de este día. */
  weighedThisWeek: boolean;
}

export const MIN_MAIN_MEALS_WITH_PROTEIN = 2;

/**
 * Evalúa un hábito automático a partir de los registros reales de un día.
 * - 'pending': el día está en curso y aún no se cumple.
 * - 'na': no aplica (p. ej. día de descanso programado).
 * - 'no_data': día pasado sin registros suficientes para saberlo.
 */
export function evaluateAutoHabit(rule: HabitAutoRule, day: DayAggregate): HabitStatus {
  const missing: HabitStatus = day.isToday ? 'pending' : 'not_met';
  switch (rule) {
    case 'NONE':
      return day.isToday ? 'pending' : 'not_met';
    case 'SCHEDULED_ACTIVITY':
      if (day.plannedKind === 'REST' || day.plannedKind === 'ACTIVE_REST') return day.activityDone ? 'met' : 'na';
      return day.activityDone ? 'met' : missing;
    case 'SODA_LIMIT':
      if (day.sodaMaxGlasses === null) return 'na';
      if (day.sodaGlasses > day.sodaMaxGlasses) return 'not_met';
      // Sin ningún registro de bebidas no se puede afirmar que se cumplió.
      if (!day.beveragesLogged) return day.isToday ? 'pending' : 'no_data';
      return 'met';
    case 'WATER_GOAL':
      if (day.waterGoalMl === null) return 'na';
      if (day.waterMl >= day.waterGoalMl) return 'met';
      if (!day.isToday && !day.beveragesLogged) return 'no_data';
      return missing;
    case 'PROTEIN_MEALS':
      if (day.mainMealsWithProtein >= MIN_MAIN_MEALS_WITH_PROTEIN) return 'met';
      if (!day.isToday && day.mainMealsLogged === 0) return 'no_data';
      return missing;
    case 'SLEEP_WINDOW':
      if (day.sleepMinutes === null) return day.isToday ? 'pending' : 'no_data';
      return day.sleepMinutes >= day.sleepTargetMinutes ? 'met' : 'not_met';
    case 'WEEKLY_WEIGH_IN':
      return day.weighedThisWeek ? 'met' : missing;
  }
}

/** El registro manual siempre prevalece sobre la evaluación automática. */
export function resolveHabitStatus(
  rule: HabitAutoRule,
  day: DayAggregate,
  manuallyCompleted: boolean,
): HabitStatus {
  if (manuallyCompleted) return 'met';
  return evaluateAutoHabit(rule, day);
}

export interface ConsistencyStats {
  met: number;
  notMet: number;
  noData: number;
  applicable: number;
  /** met / (met + notMet); null si no hay días evaluables. */
  rate: number | null;
}

/**
 * Consistencia sin castigo: los días sin datos o que no aplican no cuentan
 * como fallos; el día en curso tampoco cuenta hasta que se cumple.
 */
export function consistency(statuses: HabitStatus[]): ConsistencyStats {
  let met = 0;
  let notMet = 0;
  let noData = 0;
  for (const s of statuses) {
    if (s === 'met') met++;
    else if (s === 'not_met') notMet++;
    else if (s === 'no_data') noData++;
  }
  const applicable = met + notMet;
  return { met, notMet, noData, applicable, rate: applicable ? met / applicable : null };
}

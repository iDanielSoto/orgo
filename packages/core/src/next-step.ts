import type { ActivityKind } from './program';

export type NextStepAction =
  | 'LOG_SLEEP'
  | 'LOG_WEIGHT'
  | 'DO_ACTIVITY'
  | 'LOG_WATER'
  | 'LOG_MEAL'
  | 'PREPARE_SLEEP'
  | 'PROGRAM_NOT_STARTED'
  | 'ALL_DONE';

export interface NextStepInput {
  /** Minutos desde la medianoche local. */
  nowMinutes: number;
  programDay: number;
  sleepLoggedLastNight: boolean;
  isWeighInDay: boolean;
  weighedThisWeek: boolean;
  plannedKind: ActivityKind;
  plannedLabel: string;
  activityDone: boolean;
  /** Minutos desde medianoche de la hora preferida de entrenamiento. */
  trainingMinutes: number;
  waterMl: number;
  waterGoalMl: number | null;
  /** Minutos desde medianoche de despertar y dormir objetivo. */
  wakeMinutes: number;
  bedMinutes: number;
  mealsLogged: { breakfast: boolean; lunch: boolean; dinner: boolean };
}

export interface NextStep {
  action: NextStepAction;
  title: string;
  detail: string;
}

/**
 * Minutos "despierto" transcurridos en el día lógico del usuario, que va de la
 * hora de despertar a la hora de dormir (aunque ésta sea después de medianoche).
 */
function awakeProgress(now: number, wake: number, bed: number): { elapsed: number; total: number } {
  const total = bed > wake ? bed - wake : bed + 1440 - wake;
  let elapsed = now >= wake ? now - wake : now + 1440 - wake;
  if (elapsed > total) elapsed = now >= wake ? 0 : total; // antes de despertar
  return { elapsed, total };
}

/**
 * Elige UNA acción pendiente relevante con reglas explícitas y en orden de
 * prioridad. Si nada está pendiente, lo dice; no inventa tareas.
 */
export function computeNextStep(i: NextStepInput): NextStep {
  if (i.programDay <= 0) {
    const days = 1 - i.programDay;
    return {
      action: 'PROGRAM_NOT_STARTED',
      title: days === 1 ? 'Tu programa empieza mañana' : `Tu programa empieza en ${days} días`,
      detail: 'Mientras tanto puedes registrar tu peso inicial y revisar tus metas de la primera semana.',
    };
  }

  const { elapsed, total } = awakeProgress(i.nowMinutes, i.wakeMinutes, i.bedMinutes);
  const minutesToBed = total - elapsed;
  const isMorning = elapsed <= 5 * 60;

  if (!i.sleepLoggedLastNight && isMorning) {
    return {
      action: 'LOG_SLEEP',
      title: 'Registra cómo dormiste',
      detail: 'Toma unos segundos y ayuda a ajustar la intensidad del día.',
    };
  }

  if (i.isWeighInDay && !i.weighedThisWeek) {
    return {
      action: 'LOG_WEIGHT',
      title: 'Registra tu peso semanal',
      detail: 'Idealmente en ayunas, después de ir al baño y con ropa ligera.',
    };
  }

  const activityPending =
    !i.activityDone && (i.plannedKind === 'STRENGTH' || i.plannedKind === 'WALK_MOBILITY');
  if (activityPending && i.nowMinutes >= i.trainingMinutes - 60 && minutesToBed > 90) {
    return {
      action: 'DO_ACTIVITY',
      title: `Hoy toca: ${i.plannedLabel}`,
      detail: 'Cuando la termines, regístrala para llevar tu progreso.',
    };
  }

  if (minutesToBed <= 60 && minutesToBed >= 0 && elapsed > 0) {
    return {
      action: 'PREPARE_SLEEP',
      title: 'Prepárate para dormir',
      detail: 'Baja la intensidad de las pantallas y deja lista tu siguiente mañana.',
    };
  }

  if (i.waterGoalMl) {
    const expected = i.waterGoalMl * Math.min(1, elapsed / Math.max(1, total - 60));
    if (i.waterMl + 250 <= expected) {
      return {
        action: 'LOG_WATER',
        title: 'Toma un vaso de agua',
        detail: `Llevas ${(i.waterMl / 1000).toFixed(1)} L de ${(i.waterGoalMl / 1000).toFixed(1)} L.`,
      };
    }
  }

  // Ventanas aproximadas relativas al despertar.
  const mealWindows: { key: keyof NextStepInput['mealsLogged']; after: number; label: string }[] = [
    { key: 'breakfast', after: 60, label: 'desayuno' },
    { key: 'lunch', after: 6 * 60, label: 'comida' },
    { key: 'dinner', after: 11 * 60, label: 'cena' },
  ];
  const dueMeal = [...mealWindows].reverse().find((w) => elapsed >= w.after);
  if (dueMeal && !i.mealsLogged[dueMeal.key]) {
    return {
      action: 'LOG_MEAL',
      title: `Registra tu ${dueMeal.label}`,
      detail: 'Una descripción breve basta; no necesitas contar calorías.',
    };
  }

  return {
    action: 'ALL_DONE',
    title: 'Vas al día',
    detail: 'No hay nada pendiente por ahora. Lo constante importa más que lo perfecto.',
  };
}

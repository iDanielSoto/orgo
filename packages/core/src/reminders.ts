import type { ActivityKind } from './program';

/**
 * Recordatorios push: sólo los necesarios y sólo cuando aplican con los datos reales.
 * El servidor revisa cada minuto; un recordatorio está "pendiente" durante los
 * 15 minutos posteriores a su hora y se envía una sola vez por turno (slot).
 */

export type ReminderKind = 'TRAINING' | 'HYDRATION' | 'BEDTIME' | 'WEIGH_IN';

export const REMINDER_LABEL: Record<ReminderKind, string> = {
  TRAINING: 'Entrenamiento',
  HYDRATION: 'Agua',
  BEDTIME: 'Hora de dormir',
  WEIGH_IN: 'Peso semanal',
};

export interface ReminderInput {
  nowMinutes: number;
  programDay: number;
  enabled: Partial<Record<ReminderKind, boolean>>;
  plannedKind: ActivityKind;
  plannedLabel: string;
  activityDone: boolean;
  trainingMinutes: number;
  wakeMinutes: number;
  bedMinutes: number;
  waterMl: number;
  waterGoalMl: number | null;
  isWeighInDay: boolean;
  weighedThisWeek: boolean;
}

export interface Reminder {
  kind: ReminderKind;
  slot: string;
  title: string;
  body: string;
  url: string;
}

export const REMINDER_WINDOW = 15;
/** Antelación del aviso para dormir, en minutos. */
export const BEDTIME_LEAD = 45;
/** Avisos de agua: horas después de despertar (como máximo cuatro al día). */
export const HYDRATION_SLOTS = [3, 6, 9, 12];

const norm = (m: number) => ((m % 1440) + 1440) % 1440;
/** ¿`now` cae en [target, target + ventana)? Funciona cruzando medianoche. */
export const inWindow = (now: number, target: number, window = REMINDER_WINDOW) => norm(now - target) < window;

export function dueReminders(i: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  if (i.programDay < 1) return out;
  const awakeTotal = norm(i.bedMinutes - i.wakeMinutes) || 1440;

  if (i.enabled.TRAINING && (i.plannedKind === 'STRENGTH' || i.plannedKind === 'WALK_MOBILITY') && !i.activityDone && inWindow(i.nowMinutes, i.trainingMinutes)) {
    out.push({ kind: 'TRAINING', slot: 'main', title: `Hoy toca ${i.plannedLabel}`, body: 'Unos 30 minutos. Cuando termines, regístralo.', url: '/salud/ejercicio' });
  }

  if (i.enabled.HYDRATION && i.waterGoalMl) {
    for (const h of HYDRATION_SLOTS) {
      const offset = h * 60;
      if (offset > awakeTotal - 120) break; // nada en las dos horas antes de dormir
      if (!inWindow(i.nowMinutes, norm(i.wakeMinutes + offset))) continue;
      const expected = i.waterGoalMl * Math.min(1, offset / Math.max(1, awakeTotal - 60));
      if (i.waterMl < expected) {
        out.push({
          kind: 'HYDRATION',
          slot: `h${h}`,
          title: 'Un vaso de agua',
          body: `Llevas ${(i.waterMl / 1000).toFixed(1)} de ${(i.waterGoalMl / 1000).toFixed(1)} L.`,
          url: '/salud',
        });
      }
    }
  }

  if (i.enabled.BEDTIME && inWindow(i.nowMinutes, norm(i.bedMinutes - BEDTIME_LEAD))) {
    out.push({ kind: 'BEDTIME', slot: 'main', title: 'Prepárate para dormir', body: `En ${BEDTIME_LEAD} minutos es tu hora. Baja las pantallas.`, url: '/salud' });
  }

  if (i.enabled.WEIGH_IN && i.isWeighInDay && !i.weighedThisWeek && inWindow(i.nowMinutes, norm(i.wakeMinutes + 30))) {
    out.push({ kind: 'WEIGH_IN', slot: 'main', title: 'Peso semanal', body: 'En ayunas y después de ir al baño.', url: '/salud/cuerpo' });
  }

  return out;
}

import { parseClock } from './dates';

/**
 * Duración de sueño en minutos entre dos instantes. Si la hora de despertar es
 * anterior a la de acostarse (en reloj), se asume que el periodo cruza medianoche.
 */
export function sleepDurationMinutes(bedtime: Date, wakeTime: Date): number {
  const diff = (wakeTime.getTime() - bedtime.getTime()) / 60_000;
  if (diff <= 0) throw new Error('La hora de despertar debe ser posterior a la de acostarse');
  if (diff > 24 * 60) throw new Error('Un periodo de sueño no puede durar más de 24 horas');
  return Math.round(diff);
}

/** Igual que la anterior pero con horas de reloj "HH:mm" (cruza medianoche si wake ≤ bed). */
export function clockSleepMinutes(bed: string, wake: string): number {
  const b = parseClock(bed);
  const w = parseClock(wake);
  return w > b ? w - b : w + 1440 - b;
}

/**
 * Punto medio del sueño en minutos "continuos" respecto a las 12:00 del día
 * anterior (rango 0–1440), para que dormir 23:30 y 01:30 sean comparables.
 */
export function sleepMidpoint(bed: string, wake: string): number {
  const b = parseClock(bed);
  const shifted = (b + 720) % 1440; // 12:00 → 0
  return shifted + clockSleepMinutes(bed, wake) / 2;
}

/**
 * Regularidad: desviación estándar (min) del punto medio del sueño.
 * Menor = más regular. Requiere al menos 2 registros.
 */
export function sleepRegularity(entries: { bed: string; wake: string }[]): number | null {
  if (entries.length < 2) return null;
  const mids = entries.map((e) => sleepMidpoint(e.bed, e.wake));
  const mean = mids.reduce((a, b) => a + b, 0) / mids.length;
  const variance = mids.reduce((a, m) => a + (m - mean) ** 2, 0) / mids.length;
  return Math.sqrt(variance);
}

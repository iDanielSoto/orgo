/**
 * Utilidades de fechas basadas en "claves de día" (YYYY-MM-DD) en la zona
 * horaria del usuario. Todos los registros guardan el instante exacto (UTC) y
 * además su día local, que es lo que se usa para agrupar y comparar.
 */

export type DateKey = string; // YYYY-MM-DD

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): value is DateKey {
  return DATE_KEY_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Día local (YYYY-MM-DD) de un instante en la zona horaria indicada. */
export function toDateKey(instant: Date, timeZone: string): DateKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Minutos transcurridos desde la medianoche local (0–1439). */
export function localMinutesOfDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Convierte una clave a Date a medianoche UTC (formato usado por columnas DATE). */
export function dateKeyToUtc(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function utcToDateKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = dateKeyToUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToDateKey(d);
}

/** Diferencia en días calendario (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((dateKeyToUtc(b).getTime() - dateKeyToUtc(a).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(key: DateKey): number {
  return dateKeyToUtc(key).getUTCDay();
}

/** Lunes de la semana (ISO) que contiene la fecha. */
export function startOfIsoWeek(key: DateKey): DateKey {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** "HH:mm" → minutos desde medianoche. */
export function parseClock(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Hora inválida: ${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Hora inválida: ${hhmm}`);
  return h * 60 + min;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

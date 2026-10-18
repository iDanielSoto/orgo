import { addDays, diffDays, type DateKey } from './dates';

export interface WeightPoint {
  date: DateKey;
  weightKg: number;
}

/** Un valor por día (promedio si hay varios registros el mismo día), ordenado. */
export function dailyWeights(points: WeightPoint[]): WeightPoint[] {
  const byDay = new Map<DateKey, number[]>();
  for (const p of points) {
    const arr = byDay.get(p.date) ?? [];
    arr.push(p.weightKg);
    byDay.set(p.date, arr);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, ws]) => ({ date, weightKg: ws.reduce((a, b) => a + b, 0) / ws.length }));
}

/**
 * Promedio móvil temporal: para cada día con registro, media de los registros
 * de los últimos `windowDays` días naturales (incluido ese día). No interpola
 * días sin datos.
 */
export function movingAverage(points: WeightPoint[], windowDays = 7): WeightPoint[] {
  const daily = dailyWeights(points);
  return daily.map((p) => {
    const from = addDays(p.date, -(windowDays - 1));
    const inWindow = daily.filter((q) => q.date >= from && q.date <= p.date);
    return { date: p.date, weightKg: inWindow.reduce((a, q) => a + q.weightKg, 0) / inWindow.length };
  });
}

export interface WeightTrend {
  /** Cambio estimado en kg por semana (negativo = bajando). */
  kgPerWeek: number;
  /** Días que abarcan los datos usados. */
  spanDays: number;
  points: number;
}

/**
 * Tendencia por regresión lineal (mínimos cuadrados) sobre los registros de los
 * últimos `lookbackDays` días. Requiere ≥ 3 días con registro que abarquen
 * ≥ 7 días; de lo contrario no hay datos suficientes y devuelve null.
 */
export function weightTrend(points: WeightPoint[], lookbackDays = 28): WeightTrend | null {
  const daily = dailyWeights(points);
  const last = daily.at(-1);
  if (!last) return null;
  const from = addDays(last.date, -(lookbackDays - 1));
  const sample = daily.filter((p) => p.date >= from);
  const first = sample[0];
  if (!first || sample.length < 3) return null;
  const spanDays = diffDays(first.date, last.date);
  if (spanDays < 7) return null;
  const xs = sample.map((p) => diffDays(first.date, p.date));
  const ys = sample.map((p) => p.weightKg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return { kgPerWeek: (num / den) * 7, spanDays, points: n };
}

/**
 * Compara el promedio de los últimos `days` días (terminando en `end`) contra
 * el de los `days` días previos. null si algún periodo no tiene registros.
 */
export function comparePeriods(
  points: WeightPoint[],
  end: DateKey,
  days: number,
): { current: number; previous: number; delta: number } | null {
  const daily = dailyWeights(points);
  const avg = (from: DateKey, to: DateKey) => {
    const s = daily.filter((p) => p.date >= from && p.date <= to);
    return s.length ? s.reduce((a, p) => a + p.weightKg, 0) / s.length : null;
  };
  const current = avg(addDays(end, -(days - 1)), end);
  const previous = avg(addDays(end, -(2 * days - 1)), addDays(end, -days));
  if (current === null || previous === null) return null;
  return { current, previous, delta: current - previous };
}

export interface Projection {
  weeks: number;
  date: DateKey;
}

/**
 * Proyección condicionada: SI la tendencia observada se mantuviera, cuántas
 * semanas tomaría llegar a la meta. No es una promesa: la pérdida de peso real
 * no es lineal. Devuelve null si la tendencia no se dirige a la meta o si el
 * resultado excede 3 años (poco informativo).
 */
export function projectToTarget(
  currentKg: number,
  targetKg: number,
  trend: WeightTrend | null,
  from: DateKey,
): Projection | null {
  if (!trend || trend.kgPerWeek === 0) return null;
  const remaining = targetKg - currentKg;
  if (remaining === 0) return { weeks: 0, date: from };
  if (Math.sign(remaining) !== Math.sign(trend.kgPerWeek)) return null;
  const weeks = remaining / trend.kgPerWeek;
  if (weeks > 156) return null;
  return { weeks, date: addDays(from, Math.round(weeks * 7)) };
}

export interface MilestoneStatus {
  targetKg: number;
  achievedOn: DateKey | null;
}

/** Un hito de pérdida se considera alcanzado en el primer día con registro ≤ objetivo. */
export function milestoneStatus(points: WeightPoint[], milestones: number[]): MilestoneStatus[] {
  const daily = dailyWeights(points);
  return [...milestones]
    .sort((a, b) => b - a)
    .map((targetKg) => ({
      targetKg,
      achievedOn: daily.find((p) => p.weightKg <= targetKg)?.date ?? null,
    }));
}

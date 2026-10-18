import {
  addDays,
  dateKeyToUtc,
  goalForWeek,
  plannedActivity,
  programWeek,
  programWeekStart,
  rangeKeys,
  type DateKey,
  type DayAggregate,
} from '@forma/core';
import { prisma } from '../db';
import { dateKey } from '../lib/serialize';
import type { UserContext } from './context';

const between = (from: DateKey, to: DateKey) => ({ gte: dateKeyToUtc(from), lte: dateKeyToUtc(to) });

export async function hydrationGoals(userId: string) {
  return prisma.hydrationGoal.findMany({ where: { userId }, orderBy: { weekNumber: 'asc' } });
}

/**
 * Construye el resumen diario (DayAggregate) a partir de registros reales para
 * un rango de días. Base para hábitos automáticos, tablero y estadísticas.
 */
export async function buildDayAggregates(ctx: UserContext, from: DateKey, to: DateKey): Promise<DayAggregate[]> {
  const { userId, settings } = ctx;
  const start = ctx.programStart ?? from;
  // Para "pesó esta semana" se necesitan pesos desde el inicio de la semana de programa.
  const weightFrom = programWeekStart(start, from) < from ? programWeekStart(start, from) : from;
  const weightTo = addDays(programWeekStart(start, to), 6);

  const [bev, meals, workouts, walks, sleeps, weights, goals] = await Promise.all([
    prisma.beverageLog.groupBy({
      by: ['localDate', 'type'],
      where: { userId, localDate: between(from, to) },
      _sum: { volumeMl: true },
    }),
    prisma.meal.findMany({
      where: { userId, localDate: between(from, to), type: { in: ['BREAKFAST', 'LUNCH', 'DINNER'] } },
      select: { localDate: true, proteinSource: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, localDate: between(from, to), status: 'COMPLETED' },
      select: { localDate: true },
    }),
    prisma.walkingSession.findMany({ where: { userId, localDate: between(from, to) }, select: { localDate: true } }),
    prisma.sleepLog.findMany({
      where: { userId, localDate: between(from, to) },
      select: { localDate: true, durationMinutes: true },
      orderBy: { wakeTime: 'asc' },
    }),
    prisma.bodyMeasurement.findMany({
      where: { userId, localDate: between(weightFrom, weightTo), weightKg: { not: null } },
      select: { localDate: true },
    }),
    hydrationGoals(userId),
  ]);

  const weightDays = weights.map((w) => dateKey(w.localDate));
  const sleepTargetMinutes = Number(settings.sleepTargetMinHours) * 60;

  return rangeKeys(from, to).map((date) => {
    const sum = (type: string) =>
      bev.find((b) => dateKey(b.localDate) === date && b.type === type)?._sum.volumeMl ?? 0;
    const week = programWeek(start, date);
    const goal = goalForWeek(goals, week);
    const dayMeals = meals.filter((m) => dateKey(m.localDate) === date);
    const daySleeps = sleeps.filter((s) => dateKey(s.localDate) === date);
    const ws = programWeekStart(start, date);
    const we = addDays(ws, 6);
    const planned = plannedActivity(start, date);
    return {
      date,
      isToday: date === ctx.today,
      beveragesLogged: bev.some((b) => dateKey(b.localDate) === date),
      waterMl: sum('WATER'),
      waterGoalMl: goal?.waterMl ?? null,
      sodaGlasses: sum('SODA_REGULAR') / settings.glassSizeMl,
      sodaMaxGlasses: goal?.sodaMaxGlasses ?? null,
      plannedKind: planned.kind,
      activityDone:
        workouts.some((w) => dateKey(w.localDate) === date) || walks.some((w) => dateKey(w.localDate) === date),
      mainMealsLogged: dayMeals.length,
      mainMealsWithProtein: dayMeals.filter((m) => m.proteinSource).length,
      sleepMinutes: daySleeps.length ? daySleeps.reduce((a, s) => a + s.durationMinutes, 0) : null,
      sleepTargetMinutes,
      weighedThisWeek: weightDays.some((d) => d >= ws && d <= we),
    };
  });
}

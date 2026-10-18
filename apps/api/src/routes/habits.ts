import { Router } from 'express';
import { z } from 'zod';
import {
  addDays,
  consistency,
  dateKeySchema,
  dateKeyToUtc,
  habitCompletionSchema,
  habitCreateSchema,
  habitUpdateSchema,
  programWeekStart,
  resolveHabitStatus,
  toDateKey,
  type DateKey,
  type DayAggregate,
  type HabitStatus,
} from '@forma/core';
import type { Habit } from '@prisma/client';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, notFound, parse } from '../lib/http';
import { dateKey } from '../lib/serialize';
import { loadContext, type UserContext } from '../services/context';
import { buildDayAggregates } from '../services/days';

export const habitsRouter = Router();

/** Clave del periodo: el día para hábitos diarios; el día 1 de la semana de programa para semanales. */
export function periodKey(ctx: UserContext, habit: Pick<Habit, 'frequency'>, date: DateKey): DateKey {
  return habit.frequency === 'WEEKLY' ? programWeekStart(ctx.programStart ?? date, date) : date;
}

/** Estado de cada hábito activo para un rango de días, combinando registros manuales y automáticos. */
export async function habitStatuses(ctx: UserContext, from: DateKey, to: DateKey) {
  const habits = await prisma.habit.findMany({
    where: { userId: ctx.userId, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const weeklyFrom = programWeekStart(ctx.programStart ?? from, from);
  const [completions, days] = await Promise.all([
    prisma.habitCompletion.findMany({
      where: { userId: ctx.userId, periodDate: { gte: dateKeyToUtc(weeklyFrom < from ? weeklyFrom : from), lte: dateKeyToUtc(to) } },
      select: { habitId: true, periodDate: true },
    }),
    buildDayAggregates(ctx, from, to),
  ]);
  const done = new Set(completions.map((c) => `${c.habitId}|${dateKey(c.periodDate)}`));
  return habits.map((habit) => {
    // Los días anteriores a la creación del hábito no se evalúan.
    const createdOn = toDateKey(habit.createdAt, ctx.tz);
    return {
      habit,
      days: days.map((day: DayAggregate) => {
        const manual = done.has(`${habit.id}|${periodKey(ctx, habit, day.date)}`);
        const status: HabitStatus = day.date < createdOn && !manual ? 'na' : resolveHabitStatus(habit.autoRule, day, manual);
        return { date: day.date, manual, status };
      }),
    };
  });
}

const serializeHabit = (h: Habit) => ({
  id: h.id,
  name: h.name,
  description: h.description,
  frequency: h.frequency,
  autoRule: h.autoRule,
  sortOrder: h.sortOrder,
  archivedAt: h.archivedAt?.toISOString() ?? null,
});

/** Hábitos activos con su estado en la fecha indicada y la última semana. */
habitsRouter.get('/habits', async (req, res) => {
  const ctx = await loadContext(uid(req));
  const date = parse(z.object({ date: dateKeySchema.optional() }), req.query).date ?? ctx.today;
  const rows = await habitStatuses(ctx, addDays(date, -6), date);
  res.json(
    rows.map(({ habit, days }) => {
      const today = days.at(-1)!;
      return { ...serializeHabit(habit), today: { status: today.status, manual: today.manual }, week: days };
    }),
  );
});

habitsRouter.get('/habits/archived', async (req, res) => {
  const rows = await prisma.habit.findMany({ where: { userId: uid(req), archivedAt: { not: null } }, orderBy: { archivedAt: 'desc' } });
  res.json(rows.map(serializeHabit));
});

/** Consistencia por hábito en los últimos N días (sin castigar días sin datos). */
habitsRouter.get('/habits/stats', async (req, res) => {
  const ctx = await loadContext(uid(req));
  const { days } = parse(z.object({ days: z.coerce.number().int().min(7).max(366).default(30) }), req.query);
  const from = addDays(ctx.today, -(days - 1));
  const rows = await habitStatuses(ctx, from, ctx.today);
  res.json(
    rows.map(({ habit, days: d }) => {
      let statuses: HabitStatus[] = d.map((x) => x.status);
      if (habit.frequency === 'WEEKLY') {
        // Una evaluación por semana: la del último día observado de cada semana.
        const byWeek = new Map<string, HabitStatus>();
        for (const x of d.filter((x) => x.status !== 'na')) byWeek.set(periodKey(ctx, habit, x.date), x.status);
        statuses = [...byWeek.values()];
      }
      return { id: habit.id, name: habit.name, frequency: habit.frequency, ...consistency(statuses) };
    }),
  );
});

habitsRouter.post('/habits', async (req, res) => {
  const userId = uid(req);
  const data = parse(habitCreateSchema, req.body);
  const max = await prisma.habit.aggregate({ where: { userId }, _max: { sortOrder: true } });
  const habit = await prisma.habit.create({ data: { ...data, userId, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  res.status(201).json(serializeHabit(habit));
});

async function ownHabit(userId: string, id: string) {
  const habit = await prisma.habit.findFirst({ where: { id, userId } });
  if (!habit) throw notFound('Hábito');
  return habit;
}

habitsRouter.patch('/habits/:id', async (req, res) => {
  const userId = uid(req);
  const data = parse(habitUpdateSchema, req.body);
  const habit = await ownHabit(userId, req.params.id);
  res.json(serializeHabit(await prisma.habit.update({ where: { id: habit.id }, data })));
});

habitsRouter.post('/habits/:id/archive', async (req, res) => {
  const habit = await ownHabit(uid(req), req.params.id);
  res.json(serializeHabit(await prisma.habit.update({ where: { id: habit.id }, data: { archivedAt: new Date() } })));
});

habitsRouter.post('/habits/:id/restore', async (req, res) => {
  const habit = await ownHabit(uid(req), req.params.id);
  res.json(serializeHabit(await prisma.habit.update({ where: { id: habit.id }, data: { archivedAt: null } })));
});

/** Eliminar definitivamente un hábito y su historial. */
habitsRouter.delete('/habits/:id', async (req, res) => {
  const habit = await ownHabit(uid(req), req.params.id);
  await prisma.habit.delete({ where: { id: habit.id } });
  res.status(204).end();
});

habitsRouter.post('/habits/:id/complete', async (req, res) => {
  const userId = uid(req);
  const { date } = parse(habitCompletionSchema, req.body);
  const habit = await ownHabit(userId, req.params.id);
  const ctx = await loadContext(userId);
  if (date > ctx.today) throw new HttpError(400, 'No puedes completar días futuros');
  const periodDate = dateKeyToUtc(periodKey(ctx, habit, date));
  await prisma.habitCompletion.upsert({
    where: { habitId_periodDate: { habitId: habit.id, periodDate } },
    update: {},
    create: { habitId: habit.id, userId, periodDate },
  });
  res.json({ ok: true });
});

habitsRouter.delete('/habits/:id/complete', async (req, res) => {
  const userId = uid(req);
  const { date } = parse(habitCompletionSchema, req.query);
  const ctx = await loadContext(userId);
  const habit = await ownHabit(userId, req.params.id);
  await prisma.habitCompletion.deleteMany({
    where: { habitId: habit.id, userId, periodDate: dateKeyToUtc(periodKey(ctx, habit, date)) },
  });
  res.json({ ok: true });
});

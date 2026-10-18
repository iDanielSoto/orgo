import { Router } from 'express';
import { z } from 'zod';
import {
  addDays,
  beverageCreateSchema,
  beverageUpdateSchema,
  dateKeySchema,
  dateKeyToUtc,
  goalForWeek,
  programWeek,
} from '@forma/core';
import type { BeverageLog } from '@prisma/client';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { notFound, parse } from '../lib/http';
import { createIdempotent } from '../lib/idempotent';
import { dateKey, num } from '../lib/serialize';
import { loadContext, localDateOf } from '../services/context';
import { buildDayAggregates, hydrationGoals } from '../services/days';

export const hydrationRouter = Router();

const serialize = (b: BeverageLog) => ({
  id: b.id,
  type: b.type,
  volumeMl: b.volumeMl,
  loggedAt: b.loggedAt.toISOString(),
  date: dateKey(b.localDate),
  note: b.note,
});

/** Registros y totales de un día. */
hydrationRouter.get('/hydration/day', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const date = parse(z.object({ date: dateKeySchema.optional() }), req.query).date ?? ctx.today;
  const [logs, goals] = await Promise.all([
    prisma.beverageLog.findMany({ where: { userId, localDate: dateKeyToUtc(date) }, orderBy: { loggedAt: 'desc' } }),
    hydrationGoals(userId),
  ]);
  const week = programWeek(ctx.programStart ?? date, date);
  const goal = goalForWeek(goals, week);
  const total = (t: string) => logs.filter((l) => l.type === t).reduce((a, l) => a + l.volumeMl, 0);
  const sodaMl = total('SODA_REGULAR');
  res.json({
    date,
    week,
    glassSizeMl: ctx.settings.glassSizeMl,
    sodaBaselineGlasses: num(ctx.settings.sodaBaselineGlasses),
    waterMl: total('WATER'),
    waterGoalMl: goal?.waterMl ?? null,
    sodaMl,
    sodaGlasses: sodaMl / ctx.settings.glassSizeMl,
    sodaMaxGlasses: goal?.sodaMaxGlasses ?? null,
    otherMl: logs.filter((l) => l.type !== 'WATER' && l.type !== 'SODA_REGULAR').reduce((a, l) => a + l.volumeMl, 0),
    logs: logs.map(serialize),
  });
});

/** Serie diaria de agua y refresco con su meta vigente. */
hydrationRouter.get('/hydration/history', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(366).default(7) }), req.query);
  const from = addDays(ctx.today, -(days - 1));
  const agg = await buildDayAggregates(ctx, from, ctx.today);
  res.json(
    agg.map((d) => ({
      date: d.date,
      waterMl: d.waterMl,
      waterGoalMl: d.waterGoalMl,
      sodaGlasses: Math.round(d.sodaGlasses * 10) / 10,
      sodaMaxGlasses: d.sodaMaxGlasses,
    })),
  );
});

hydrationRouter.post('/beverages', async (req, res) => {
  const userId = uid(req);
  const data = parse(beverageCreateSchema, req.body);
  const ctx = await loadContext(userId);
  const { record, created } = await createIdempotent(
    () =>
      prisma.beverageLog.create({
        data: { ...data, userId, loggedAt: new Date(data.loggedAt), localDate: dateKeyToUtc(localDateOf(ctx, data.loggedAt)) },
      }),
    () => prisma.beverageLog.findUnique({ where: { id: data.id } }),
    userId,
  );
  res.status(created ? 201 : 200).json(serialize(record));
});

hydrationRouter.patch('/beverages/:id', async (req, res) => {
  const userId = uid(req);
  const data = parse(beverageUpdateSchema, req.body);
  const existing = await prisma.beverageLog.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw notFound('Registro de bebida');
  const ctx = await loadContext(userId);
  const updated = await prisma.beverageLog.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(data.loggedAt ? { loggedAt: new Date(data.loggedAt), localDate: dateKeyToUtc(localDateOf(ctx, data.loggedAt)) } : {}),
    },
  });
  res.json(serialize(updated));
});

hydrationRouter.delete('/beverages/:id', async (req, res) => {
  const { count } = await prisma.beverageLog.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!count) throw notFound('Registro de bebida');
  res.status(204).end();
});

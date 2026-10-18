import { Router } from 'express';
import { z } from 'zod';
import {
  addDays,
  dateKeySchema,
  dateKeyToUtc,
  mealCreateSchema,
  mealUpdateSchema,
  sleepCreateSchema,
  sleepDurationMinutes,
  sleepUpdateSchema,
} from '@forma/core';
import type { Meal, SleepLog } from '@prisma/client';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, notFound, parse } from '../lib/http';
import { createIdempotent } from '../lib/idempotent';
import { dateKey } from '../lib/serialize';
import { loadContext, localDateOf } from '../services/context';

/** Comidas (modo sencillo) y sueño. */
export const logsRouter = Router();

// --- Comidas -------------------------------------------------------------------

const serializeMeal = (m: Meal) => ({
  id: m.id,
  type: m.type,
  eatenAt: m.eatenAt.toISOString(),
  date: dateKey(m.localDate),
  description: m.description,
  portion: m.portion,
  proteinSource: m.proteinSource,
  hasFruit: m.hasFruit,
  hasVegetables: m.hasVegetables,
  hungerBefore: m.hungerBefore,
  note: m.note,
});

logsRouter.get('/meals', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const q = parse(z.object({ date: dateKeySchema.optional(), days: z.coerce.number().int().min(1).max(90).optional() }), req.query);
  const to = q.date ?? ctx.today;
  const from = addDays(to, -((q.days ?? 1) - 1));
  const rows = await prisma.meal.findMany({
    where: { userId, localDate: { gte: dateKeyToUtc(from), lte: dateKeyToUtc(to) } },
    orderBy: { eatenAt: 'desc' },
  });
  res.json(rows.map(serializeMeal));
});

logsRouter.post('/meals', async (req, res) => {
  const userId = uid(req);
  const data = parse(mealCreateSchema, req.body);
  const ctx = await loadContext(userId);
  const { record, created } = await createIdempotent(
    () =>
      prisma.meal.create({
        data: { ...data, userId, eatenAt: new Date(data.eatenAt), localDate: dateKeyToUtc(localDateOf(ctx, data.eatenAt)) },
      }),
    () => prisma.meal.findUnique({ where: { id: data.id } }),
    userId,
  );
  res.status(created ? 201 : 200).json(serializeMeal(record));
});

logsRouter.patch('/meals/:id', async (req, res) => {
  const userId = uid(req);
  const data = parse(mealUpdateSchema, req.body);
  const existing = await prisma.meal.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw notFound('Comida');
  const ctx = await loadContext(userId);
  const updated = await prisma.meal.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(data.eatenAt ? { eatenAt: new Date(data.eatenAt), localDate: dateKeyToUtc(localDateOf(ctx, data.eatenAt)) } : {}),
    },
  });
  res.json(serializeMeal(updated));
});

logsRouter.delete('/meals/:id', async (req, res) => {
  const { count } = await prisma.meal.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!count) throw notFound('Comida');
  res.status(204).end();
});

// --- Sueño ---------------------------------------------------------------------

const serializeSleep = (s: SleepLog) => ({
  id: s.id,
  bedtime: s.bedtime.toISOString(),
  wakeTime: s.wakeTime.toISOString(),
  date: dateKey(s.localDate),
  durationMinutes: s.durationMinutes,
  quality: s.quality,
  energy: s.energy,
  note: s.note,
});

logsRouter.get('/sleep', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(366).default(14) }), req.query);
  const rows = await prisma.sleepLog.findMany({
    where: { userId, localDate: { gte: dateKeyToUtc(addDays(ctx.today, -(days - 1))) } },
    orderBy: { wakeTime: 'desc' },
  });
  res.json(rows.map(serializeSleep));
});

logsRouter.post('/sleep', async (req, res) => {
  const userId = uid(req);
  const data = parse(sleepCreateSchema, req.body);
  const ctx = await loadContext(userId);
  const bedtime = new Date(data.bedtime);
  const wakeTime = new Date(data.wakeTime);
  const { record, created } = await createIdempotent(
    () =>
      prisma.sleepLog.create({
        data: {
          ...data,
          userId,
          bedtime,
          wakeTime,
          durationMinutes: sleepDurationMinutes(bedtime, wakeTime),
          localDate: dateKeyToUtc(localDateOf(ctx, wakeTime)),
        },
      }),
    () => prisma.sleepLog.findUnique({ where: { id: data.id } }),
    userId,
  );
  res.status(created ? 201 : 200).json(serializeSleep(record));
});

logsRouter.patch('/sleep/:id', async (req, res) => {
  const userId = uid(req);
  const data = parse(sleepUpdateSchema, req.body);
  const existing = await prisma.sleepLog.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw notFound('Registro de sueño');
  const ctx = await loadContext(userId);
  const bedtime = data.bedtime ? new Date(data.bedtime) : existing.bedtime;
  const wakeTime = data.wakeTime ? new Date(data.wakeTime) : existing.wakeTime;
  if (wakeTime <= bedtime) throw new HttpError(400, 'La hora de despertar debe ser posterior');
  const updated = await prisma.sleepLog.update({
    where: { id: existing.id },
    data: {
      ...data,
      bedtime,
      wakeTime,
      durationMinutes: sleepDurationMinutes(bedtime, wakeTime),
      localDate: dateKeyToUtc(localDateOf(ctx, wakeTime)),
    },
  });
  res.json(serializeSleep(updated));
});

logsRouter.delete('/sleep/:id', async (req, res) => {
  const { count } = await prisma.sleepLog.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!count) throw notFound('Registro de sueño');
  res.status(204).end();
});

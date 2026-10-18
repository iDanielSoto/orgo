import { Router } from 'express';
import {
  addDays,
  bmi,
  comparePeriods,
  dateKeyToUtc,
  measurementCreateSchema,
  measurementUpdateSchema,
  milestoneStatus,
  movingAverage,
  projectToTarget,
  round,
  weightTrend,
  type WeightPoint,
} from '@forma/core';
import type { BodyMeasurement } from '@prisma/client';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, notFound, parse } from '../lib/http';
import { createIdempotent } from '../lib/idempotent';
import { dateKey, num, numReq } from '../lib/serialize';
import { loadContext, localDateOf, requireProfile } from '../services/context';

export const bodyRouter = Router();

const MEASURE_KEYS = ['weightKg', 'waistCm', 'hipCm', 'chestCm', 'armCm', 'thighCm', 'neckCm'] as const;

export const serializeMeasurement = (m: BodyMeasurement) => ({
  id: m.id,
  measuredAt: m.measuredAt.toISOString(),
  date: dateKey(m.localDate),
  weightKg: num(m.weightKg),
  waistCm: num(m.waistCm),
  hipCm: num(m.hipCm),
  chestCm: num(m.chestCm),
  armCm: num(m.armCm),
  thighCm: num(m.thighCm),
  neckCm: num(m.neckCm),
  note: m.note,
});

bodyRouter.get('/measurements', async (req, res) => {
  const rows = await prisma.bodyMeasurement.findMany({
    where: { userId: uid(req) },
    orderBy: { measuredAt: 'desc' },
    take: 500,
  });
  res.json(rows.map(serializeMeasurement));
});

bodyRouter.post('/measurements', async (req, res) => {
  const userId = uid(req);
  const data = parse(measurementCreateSchema, req.body);
  const ctx = await loadContext(userId);
  const { record, created } = await createIdempotent(
    () =>
      prisma.bodyMeasurement.create({
        data: { ...data, userId, measuredAt: new Date(data.measuredAt), localDate: dateKeyToUtc(localDateOf(ctx, data.measuredAt)) },
      }),
    () => prisma.bodyMeasurement.findUnique({ where: { id: data.id } }),
    userId,
  );
  res.status(created ? 201 : 200).json(serializeMeasurement(record));
});

bodyRouter.patch('/measurements/:id', async (req, res) => {
  const userId = uid(req);
  const data = parse(measurementUpdateSchema, req.body);
  const existing = await prisma.bodyMeasurement.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw notFound('Medición');
  const merged = { ...existing, ...data };
  if (!MEASURE_KEYS.some((k) => merged[k] !== null && merged[k] !== undefined)) {
    throw new HttpError(400, 'Registra al menos una medida');
  }
  const ctx = await loadContext(userId);
  const updated = await prisma.bodyMeasurement.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(data.measuredAt
        ? { measuredAt: new Date(data.measuredAt), localDate: dateKeyToUtc(localDateOf(ctx, data.measuredAt)) }
        : {}),
    },
  });
  res.json(serializeMeasurement(updated));
});

bodyRouter.delete('/measurements/:id', async (req, res) => {
  const { count } = await prisma.bodyMeasurement.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!count) throw notFound('Medición');
  res.status(204).end();
});

/** Resumen de composición corporal: series, tendencias, comparaciones e hitos. */
bodyRouter.get('/body/summary', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const profile = requireProfile(ctx);
  const [rows, milestones] = await Promise.all([
    prisma.bodyMeasurement.findMany({
      where: { userId, weightKg: { not: null } },
      orderBy: { measuredAt: 'asc' },
      select: { localDate: true, weightKg: true },
    }),
    prisma.goal.findMany({ where: { userId, category: 'WEIGHT', isMilestone: true }, orderBy: { targetValue: 'desc' } }),
  ]);
  const points: WeightPoint[] = rows.map((r) => ({ date: dateKey(r.localDate), weightKg: numReq(r.weightKg!) }));
  const startKg = numReq(profile.startWeightKg);
  const targetKg = numReq(profile.targetWeightKg);
  const heightCm = numReq(profile.heightCm);
  const latest = points.at(-1) ?? null;
  const current = latest?.weightKg ?? null;
  const trend = weightTrend(points);
  const ma = movingAverage(points, 7);
  const trendBase = ma.at(-1)?.weightKg ?? current;

  const lastWithWaist = await prisma.bodyMeasurement.findFirst({
    where: { userId, waistCm: { not: null } },
    orderBy: { measuredAt: 'desc' },
  });

  res.json({
    startKg,
    targetKg,
    heightCm,
    programStart: profile.programStart,
    latest,
    changeFromStartKg: current !== null ? round(current - startKg, 2) : null,
    remainingKg: current !== null ? round(current - targetKg, 2) : null,
    progressPct: current !== null && startKg !== targetKg ? Math.max(0, Math.min(1, (startKg - current) / (startKg - targetKg))) : 0,
    bmi: current !== null ? round(bmi(current, heightCm), 1) : round(bmi(startKg, heightCm), 1),
    series: points.map((p, i) => ({ ...p, avg7: round(ma.find((m) => m.date === p.date)?.weightKg ?? p.weightKg, 2), i })),
    trend: trend && { kgPerWeek: round(trend.kgPerWeek, 2), spanDays: trend.spanDays, points: trend.points },
    projection: trendBase !== null ? projectToTarget(trendBase, targetKg, trend, latest?.date ?? ctx.today) : null,
    weekly: latest ? comparePeriods(points, latest.date, 7) : null,
    monthly: latest ? comparePeriods(points, latest.date, 30) : null,
    milestones: milestoneStatus(points, milestones.map((m) => numReq(m.targetValue!))),
    latestWaist: lastWithWaist ? { date: dateKey(lastWithWaist.localDate), waistCm: num(lastWithWaist.waistCm) } : null,
    window: { from: addDays(ctx.today, -89), to: ctx.today },
  });
});

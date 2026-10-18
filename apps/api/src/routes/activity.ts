import { Router } from 'express';
import { z } from 'zod';
import {
  activityLogSchema,
  addDays,
  dateKeySchema,
  dateKeyToUtc,
  plannedActivity,
  programWeek,
  progressionLevel,
  startOfIsoWeek,
  weekday,
  type DateKey,
} from '@forma/core';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { notFound, parse } from '../lib/http';
import { createIdempotent } from '../lib/idempotent';
import { dateKey } from '../lib/serialize';
import { loadContext, localDateOf, requireProfile, type UserContext } from '../services/context';

export const activityRouter = Router();

/** Semanas de programa con reportes de dolor, fatiga excesiva o mala recuperación. */
export async function recoveryReports(ctx: UserContext, programStart: DateKey) {
  const flags = { OR: [{ pain: true }, { excessiveFatigue: true }, { poorRecovery: true }] };
  const [w, k] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId: ctx.userId, ...flags }, select: { localDate: true } }),
    prisma.walkingSession.findMany({ where: { userId: ctx.userId, ...flags }, select: { localDate: true } }),
  ]);
  const weeks = new Set([...w, ...k].map((r) => programWeek(programStart, dateKey(r.localDate))));
  return [...weeks].map((week) => ({ week, adverse: true }));
}

/** Plan del día y de la semana (lunes–domingo) con la progresión vigente. */
activityRouter.get('/activity/plan', async (req, res) => {
  const ctx = await loadContext(uid(req));
  const profile = requireProfile(ctx);
  const date = parse(z.object({ date: dateKeySchema.optional() }), req.query).date ?? ctx.today;
  const week = programWeek(profile.programStart, date);
  const level = progressionLevel(week, await recoveryReports(ctx, profile.programStart));
  // Antes del inicio se muestra la primera semana real de entrenamiento.
  const firstTrainingDay = weekday(profile.programStart) === 0 ? addDays(profile.programStart, 1) : profile.programStart;
  const monday = startOfIsoWeek(date < profile.programStart ? firstTrainingDay : date);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const [templates, workouts, walks] = await Promise.all([
    prisma.workoutTemplate.findMany({
      where: { userId: ctx.userId },
      include: { exercises: { include: { exercise: true }, orderBy: { position: 'asc' } } },
    }),
    prisma.workoutSession.findMany({
      where: { userId: ctx.userId, localDate: { gte: dateKeyToUtc(monday), lte: dateKeyToUtc(addDays(monday, 6)) } },
      select: { localDate: true },
    }),
    prisma.walkingSession.findMany({
      where: { userId: ctx.userId, localDate: { gte: dateKeyToUtc(monday), lte: dateKeyToUtc(addDays(monday, 6)) } },
      select: { localDate: true },
    }),
  ]);
  const doneDays = new Set([...workouts, ...walks].map((r) => dateKey(r.localDate)));

  res.json({
    date,
    programWeek: week,
    beforeStart: date < profile.programStart,
    level,
    today: plannedActivity(profile.programStart, date),
    week: weekDates.map((d) => ({
      ...plannedActivity(profile.programStart, d),
      done: doneDays.has(d),
      beforeStart: d < profile.programStart,
    })),
    templates: templates.map((t) => ({
      code: t.code,
      name: t.name,
      warmup: t.warmup,
      exercises: t.exercises.map((x) => ({
        name: x.exercise.name,
        perSide: x.exercise.perSide,
        equipment: x.exercise.equipment,
        instructions: x.exercise.instructions,
        cues: x.exercise.cues,
        sets: x.sets,
        repsMin: x.repsMin,
        repsMax: x.repsMax,
        restSeconds: x.restSeconds,
      })),
    })),
  });
});

/** Historial combinado de sesiones de fuerza y caminatas. */
activityRouter.get('/activity', async (req, res) => {
  const ctx = await loadContext(uid(req));
  const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }), req.query);
  const since = dateKeyToUtc(addDays(ctx.today, -(days - 1)));
  const [workouts, walks] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId: ctx.userId, localDate: { gte: since } } }),
    prisma.walkingSession.findMany({ where: { userId: ctx.userId, localDate: { gte: since } } }),
  ]);
  const items = [
    ...workouts.map((w) => ({
      id: w.id,
      kind: 'STRENGTH' as const,
      routineCode: w.routineCode,
      performedAt: w.startedAt.toISOString(),
      date: dateKey(w.localDate),
      durationMinutes: w.durationMinutes,
      perceivedEffort: w.perceivedEffort,
      pain: w.pain,
      excessiveFatigue: w.excessiveFatigue,
      poorRecovery: w.poorRecovery,
      note: w.note,
    })),
    ...walks.map((w) => ({
      id: w.id,
      kind: 'WALK' as const,
      routineCode: null,
      performedAt: w.startedAt.toISOString(),
      date: dateKey(w.localDate),
      durationMinutes: w.durationMinutes,
      perceivedEffort: w.perceivedEffort,
      pain: w.pain,
      excessiveFatigue: w.excessiveFatigue,
      poorRecovery: w.poorRecovery,
      note: w.note,
    })),
  ].sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1));
  res.json(items);
});

/** Registro rápido de una sesión ya realizada (el modo de entrenamiento guiado llega en la fase 3). */
activityRouter.post('/activity', async (req, res) => {
  const userId = uid(req);
  const data = parse(activityLogSchema, req.body);
  const ctx = await loadContext(userId);
  const startedAt = new Date(data.performedAt);
  const localDate = dateKeyToUtc(localDateOf(ctx, startedAt));
  const common = {
    id: data.id,
    userId,
    startedAt,
    localDate,
    durationMinutes: data.durationMinutes,
    perceivedEffort: data.perceivedEffort ?? null,
    pain: data.pain,
    excessiveFatigue: data.excessiveFatigue,
    poorRecovery: data.poorRecovery,
    note: data.note,
  };
  if (data.kind === 'STRENGTH') {
    const template = data.routineCode
      ? await prisma.workoutTemplate.findUnique({ where: { userId_code: { userId, code: data.routineCode } } })
      : null;
    const { created } = await createIdempotent(
      () =>
        prisma.workoutSession.create({
          data: {
            ...common,
            routineCode: data.routineCode ?? null,
            templateId: template?.id ?? null,
            status: 'COMPLETED',
            endedAt: new Date(startedAt.getTime() + data.durationMinutes * 60_000),
          },
        }),
      () => prisma.workoutSession.findUnique({ where: { id: data.id } }),
      userId,
    );
    res.status(created ? 201 : 200).json({ ok: true });
  } else {
    const { created } = await createIdempotent(
      () => prisma.walkingSession.create({ data: common }),
      () => prisma.walkingSession.findUnique({ where: { id: data.id } }),
      userId,
    );
    res.status(created ? 201 : 200).json({ ok: true });
  }
});

activityRouter.delete('/activity/:kind/:id', async (req, res) => {
  const userId = uid(req);
  const kind = parse(z.enum(['STRENGTH', 'WALK']), req.params.kind);
  const where = { id: req.params.id, userId };
  const { count } =
    kind === 'STRENGTH' ? await prisma.workoutSession.deleteMany({ where }) : await prisma.walkingSession.deleteMany({ where });
  if (!count) throw notFound('Sesión');
  res.status(204).end();
});

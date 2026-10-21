import { Router } from 'express';
import { z } from 'zod';
import {
  ACTIVITY_LABEL,
  addDays,
  computeNextStep,
  dateKeySchema,
  dateKeyToUtc,
  nextReviewDate,
  parseClock,
  plannedActivity,
  programDay,
  programWeek,
  progressionLevel,
  round,
  weekday,
} from '@forma/core';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, parse } from '../lib/http';
import { dateKey, num, numReq } from '../lib/serialize';
import { loadContext, requireProfile } from '../services/context';
import { buildDayAggregates } from '../services/days';
import { recoveryReports } from './activity';
import { habitStatuses } from './habits';

export const todayRouter = Router();

/**
 * Todo lo que necesita la pantalla "Mi día" en una sola petición. Con ?date= arma el mismo
 * resumen para un día pasado (el historial del calendario).
 */
todayRouter.get('/today', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const profile = requireProfile(ctx);
  const { settings } = ctx;
  const q = parse(z.object({ date: dateKeySchema.optional() }), req.query);
  if (q.date && q.date > ctx.today) throw new HttpError(400, 'Ese día aún no llega');
  const today = q.date ?? ctx.today;
  const start = profile.programStart;
  const firstReview = dateKey(profile.firstReviewDate);

  const [[day], latestWeight, meals, sleep, habits, reports] = await Promise.all([
    buildDayAggregates(ctx, today, today),
    prisma.bodyMeasurement.findFirst({
      where: { userId, weightKg: { not: null } },
      orderBy: { measuredAt: 'desc' },
      select: { weightKg: true, localDate: true },
    }),
    prisma.meal.findMany({ where: { userId, localDate: dateKeyToUtc(today) }, orderBy: { eatenAt: 'asc' } }),
    prisma.sleepLog.findFirst({ where: { userId, localDate: dateKeyToUtc(today) }, orderBy: { wakeTime: 'desc' } }),
    habitStatuses(ctx, today, today),
    recoveryReports(ctx, start),
  ]);

  const pDay = programDay(start, today);
  const week = programWeek(start, today);
  const planned = plannedActivity(start, today);
  const level = progressionLevel(week, reports);
  const startKg = numReq(profile.startWeightKg);
  const latestKg = num(latestWeight?.weightKg);
  const mealsLogged = {
    breakfast: meals.some((m) => m.type === 'BREAKFAST'),
    lunch: meals.some((m) => m.type === 'LUNCH'),
    dinner: meals.some((m) => m.type === 'DINNER'),
  };

  const nextStep = computeNextStep({
    nowMinutes: ctx.nowMinutes,
    programDay: pDay,
    sleepLoggedLastNight: Boolean(sleep),
    isWeighInDay: weekday(today) === weekday(firstReview),
    weighedThisWeek: day!.weighedThisWeek,
    plannedKind: planned.kind,
    plannedLabel: planned.label,
    activityDone: day!.activityDone,
    trainingMinutes: parseClock(settings.trainingTime),
    waterMl: day!.waterMl,
    waterGoalMl: day!.waterGoalMl,
    wakeMinutes: parseClock(settings.targetWakeTime),
    bedMinutes: parseClock(settings.targetBedtime),
    mealsLogged,
  });

  res.json({
    date: today,
    nowMinutes: ctx.nowMinutes,
    displayName: profile.displayName,
    program: {
      start,
      day: pDay,
      week,
      nextReview: nextReviewDate(firstReview, today),
      fourWeekReview: nextReviewDate(firstReview, today) === today ? today : null,
    },
    weight: {
      startKg,
      targetKg: numReq(profile.targetWeightKg),
      latestKg,
      latestDate: latestWeight ? dateKey(latestWeight.localDate) : null,
      changeKg: latestKg !== null ? round(latestKg - startKg, 2) : null,
    },
    activity: {
      ...planned,
      kindLabel: ACTIVITY_LABEL[planned.kind],
      done: day!.activityDone,
      level,
    },
    hydration: {
      waterMl: day!.waterMl,
      waterGoalMl: day!.waterGoalMl,
      sodaGlasses: round(day!.sodaGlasses, 1),
      sodaMaxGlasses: day!.sodaMaxGlasses,
      glassSizeMl: settings.glassSizeMl,
    },
    meals: meals.map((m) => ({ id: m.id, type: m.type, description: m.description, proteinSource: m.proteinSource, eatenAt: m.eatenAt.toISOString() })),
    schedule: { wake: settings.targetWakeTime, training: settings.trainingTime, bed: settings.targetBedtime, dayStart: ctx.dayStart },
    sleep: sleep && {
      id: sleep.id,
      durationMinutes: sleep.durationMinutes,
      quality: sleep.quality,
      energy: sleep.energy,
      bedtime: sleep.bedtime.toISOString(),
      wakeTime: sleep.wakeTime.toISOString(),
    },
    sleepTargetMinHours: Number(settings.sleepTargetMinHours),
    habits: habits.map(({ habit, days }) => ({
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      status: days[0]!.status,
      manual: days[0]!.manual,
    })),
    nextStep,
  });
});

/**
 * Cumplimiento por día para el calendario: promedio de agua, comidas, sueño y actividad
 * (la actividad sólo cuenta en días de fuerza o caminata). null = antes del programa o sin llegar.
 */
todayRouter.get('/days', async (req, res) => {
  const ctx = await loadContext(uid(req));
  const profile = requireProfile(ctx);
  const q = parse(z.object({ from: dateKeySchema, to: dateKeySchema }), req.query);
  const from = q.from < profile.programStart ? profile.programStart : q.from;
  const to = q.to > ctx.today ? ctx.today : q.to;
  if (from > to) return void res.json([]);
  if (addDays(from, 400) < to) throw new HttpError(400, 'Rango demasiado largo');
  const agg = await buildDayAggregates(ctx, from, to);
  res.json(
    agg.map((d) => {
      const parts = [
        d.waterGoalMl ? Math.min(1, d.waterMl / d.waterGoalMl) : d.waterMl > 0 ? 1 : 0,
        Math.min(1, d.mainMealsLogged / 3),
        d.sleepMinutes === null ? 0 : Math.min(1, d.sleepMinutes / d.sleepTargetMinutes),
      ];
      if (d.plannedKind === 'STRENGTH' || d.plannedKind === 'WALK_MOBILITY') parts.push(d.activityDone ? 1 : 0);
      return {
        date: d.date,
        score: round(parts.reduce((a, b) => a + b, 0) / parts.length, 2),
        waterMl: d.waterMl,
        meals: d.mainMealsLogged,
        sleepMinutes: d.sleepMinutes,
        activityDone: d.activityDone,
      };
    }),
  );
});

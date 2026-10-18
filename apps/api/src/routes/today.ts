import { Router } from 'express';
import {
  ACTIVITY_LABEL,
  computeNextStep,
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
import { dateKey, num, numReq } from '../lib/serialize';
import { loadContext, requireProfile } from '../services/context';
import { buildDayAggregates } from '../services/days';
import { recoveryReports } from './activity';
import { habitStatuses } from './habits';

export const todayRouter = Router();

/** Todo lo que necesita la pantalla "Mi día" en una sola petición. */
todayRouter.get('/today', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const profile = requireProfile(ctx);
  const { today, settings } = ctx;
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
    meals: meals.map((m) => ({ id: m.id, type: m.type, description: m.description, proteinSource: m.proteinSource })),
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

import { Router } from 'express';
import { z } from 'zod';
import {
  BMI_CATEGORY_LABEL,
  bmi,
  bmiCategory,
  currentAge,
  dateKeyToUtc,
  estimateTdee,
  hydrationGoalsSchema,
  profileCreateSchema,
  profileUpdateSchema,
  round,
  settingsUpdateSchema,
} from '@forma/core';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, parse } from '../lib/http';
import { dateKey, num, numReq } from '../lib/serialize';
import { loadContext } from '../services/context';

export const profileRouter = Router();

async function latestWeight(userId: string) {
  return prisma.bodyMeasurement.findFirst({
    where: { userId, weightKg: { not: null } },
    orderBy: { measuredAt: 'desc' },
    select: { weightKg: true, localDate: true },
  });
}

profileRouter.get('/profile', async (req, res) => {
  const userId = uid(req);
  const ctx = await loadContext(userId);
  const [health, latest] = await Promise.all([
    prisma.healthProfile.findUnique({ where: { userId } }),
    latestWeight(userId),
  ]);
  const p = ctx.profile;
  const s = ctx.settings;

  let estimates = null;
  if (p) {
    const height = numReq(p.heightCm);
    const weight = latest?.weightKg ? numReq(latest.weightKg) : numReq(p.startWeightKg);
    const age = currentAge(p.ageYears, dateKey(p.ageRecordedOn), ctx.today);
    const bmiValue = bmi(weight, height);
    const energy = estimateTdee({ weightKg: weight, heightCm: height, age, sex: p.sexForEstimates, activity: p.activityLevel });
    estimates = {
      weightUsedKg: weight,
      age,
      bmi: round(bmiValue, 1),
      bmiCategory: BMI_CATEGORY_LABEL[bmiCategory(bmiValue)],
      startBmi: round(bmi(numReq(p.startWeightKg), height), 1),
      bmrKcal: Math.round(energy.bmr),
      tdeeKcal: Math.round(energy.tdee),
      activityFactor: energy.factor,
    };
  }

  res.json({
    profile: p && {
      displayName: p.displayName,
      ageYears: p.ageYears,
      sexForEstimates: p.sexForEstimates,
      heightCm: numReq(p.heightCm),
      startWeightKg: numReq(p.startWeightKg),
      targetWeightKg: numReq(p.targetWeightKg),
      activityLevel: p.activityLevel,
      primaryGoal: p.primaryGoal,
      secondaryGoals: p.secondaryGoals,
      trainingLocation: p.trainingLocation,
      equipment: p.equipment,
      trainingDaysPerWeek: p.trainingDaysPerWeek,
      sessionMinutes: p.sessionMinutes,
      preferredTrainingTime: p.preferredTrainingTime,
      programStartDate: dateKey(p.programStartDate),
      firstReviewDate: dateKey(p.firstReviewDate),
      obstacles: p.obstacles,
      avatarVersion: p.avatarUpdatedAt ? p.avatarUpdatedAt.getTime() : null,
    },
    health: health && {
      conditions: health.conditions,
      medications: health.medications,
      physicalLimitations: health.physicalLimitations,
      symptoms: health.symptoms,
      dailyActivity: health.dailyActivity,
      currentExercise: health.currentExercise,
      physicalCapacity: health.physicalCapacity,
      dietSummary: health.dietSummary,
      foodPreferences: health.foodPreferences,
      weeklyExtraBudgetMxn: num(health.weeklyExtraBudgetMxn),
      usualBedtime: health.usualBedtime,
      usualWakeTime: health.usualWakeTime,
      usualSleepHours: num(health.usualSleepHours),
      sleepQuality: health.sleepQuality,
      stressLevel: health.stressLevel,
      lifestyleNotes: health.lifestyleNotes,
    },
    settings: {
      timezone: s.timezone,
      theme: s.theme,
      nutritionMode: s.nutritionMode,
      glassSizeMl: s.glassSizeMl,
      sodaBaselineGlasses: num(s.sodaBaselineGlasses),
      energyTargetMinKcal: s.energyTargetMinKcal,
      energyTargetMaxKcal: s.energyTargetMaxKcal,
      proteinTargetMinG: s.proteinTargetMinG,
      proteinTargetMaxG: s.proteinTargetMaxG,
      sleepTargetMinHours: numReq(s.sleepTargetMinHours),
      sleepTargetMaxHours: numReq(s.sleepTargetMaxHours),
      targetBedtime: s.targetBedtime,
      targetWakeTime: s.targetWakeTime,
      trainingTime: s.trainingTime,
      weatherLatitude: numReq(s.weatherLatitude),
      weatherLongitude: numReq(s.weatherLongitude),
      weatherPlace: s.weatherPlace,
    },
    estimates,
  });
});

const toProfileData = (d: z.infer<typeof profileUpdateSchema>) => ({
  ...d,
  programStartDate: d.programStartDate ? dateKeyToUtc(d.programStartDate) : undefined,
  firstReviewDate: d.firstReviewDate ? dateKeyToUtc(d.firstReviewDate) : undefined,
});

/** Crea el perfil (primer uso) o lo reemplaza completo. */
profileRouter.put('/profile', async (req, res) => {
  const userId = uid(req);
  const data = parse(profileCreateSchema, req.body);
  const ctx = await loadContext(userId);
  const fields = {
    ...data,
    programStartDate: dateKeyToUtc(data.programStartDate),
    firstReviewDate: dateKeyToUtc(data.firstReviewDate),
    ageRecordedOn: dateKeyToUtc(ctx.today),
  };
  await prisma.userProfile.upsert({
    where: { userId },
    update: fields,
    create: { ...fields, userId, onboardingCompletedAt: new Date() },
  });
  res.json({ ok: true });
});

profileRouter.patch('/profile', async (req, res) => {
  const userId = uid(req);
  const data = parse(profileUpdateSchema, req.body);
  const ctx = await loadContext(userId);
  if (!ctx.profile) throw new HttpError(409, 'Primero crea tu perfil');
  await prisma.userProfile.update({
    where: { userId },
    data: {
      ...toProfileData(data),
      ...(data.ageYears !== undefined ? { ageRecordedOn: dateKeyToUtc(ctx.today) } : {}),
    },
  });
  res.json({ ok: true });
});

profileRouter.patch('/settings', async (req, res) => {
  const userId = uid(req);
  const data = parse(settingsUpdateSchema, req.body);
  if (data.timezone) {
    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: data.timezone });
    } catch {
      throw new HttpError(400, 'Zona horaria inválida');
    }
  }
  const current = await prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });
  const minK = data.energyTargetMinKcal ?? current.energyTargetMinKcal;
  const maxK = data.energyTargetMaxKcal ?? current.energyTargetMaxKcal;
  const minP = data.proteinTargetMinG ?? current.proteinTargetMinG;
  const maxP = data.proteinTargetMaxG ?? current.proteinTargetMaxG;
  const minS = data.sleepTargetMinHours ?? Number(current.sleepTargetMinHours);
  const maxS = data.sleepTargetMaxHours ?? Number(current.sleepTargetMaxHours);
  if (minK > maxK || minP > maxP || minS > maxS) throw new HttpError(400, 'El mínimo no puede ser mayor que el máximo');
  await prisma.userSettings.update({ where: { userId }, data });
  res.json({ ok: true });
});

// --- Metas progresivas de hidratación ----------------------------------------

profileRouter.get('/hydration/goals', async (req, res) => {
  const goals = await prisma.hydrationGoal.findMany({ where: { userId: uid(req) }, orderBy: { weekNumber: 'asc' } });
  res.json(goals.map(({ weekNumber, waterMl, sodaMaxGlasses }) => ({ weekNumber, waterMl, sodaMaxGlasses })));
});

profileRouter.put('/hydration/goals', async (req, res) => {
  const userId = uid(req);
  const { goals } = parse(hydrationGoalsSchema, req.body);
  await prisma.$transaction([
    prisma.hydrationGoal.deleteMany({ where: { userId } }),
    prisma.hydrationGoal.createMany({ data: goals.map((g) => ({ ...g, userId })) }),
  ]);
  res.json({ ok: true });
});

// --- Hitos de peso -------------------------------------------------------------

const milestonesSchema = z.object({
  values: z.array(z.number().min(30).max(350)).max(20),
});

profileRouter.put('/goals/milestones', async (req, res) => {
  const userId = uid(req);
  const { values } = parse(milestonesSchema, req.body);
  const unique = [...new Set(values)].sort((a, b) => b - a);
  await prisma.$transaction([
    prisma.goal.deleteMany({ where: { userId, category: 'WEIGHT', isMilestone: true } }),
    prisma.goal.createMany({
      data: unique.map((kg, i) => ({
        userId,
        category: 'WEIGHT' as const,
        isMilestone: true,
        title: `${kg} kg`,
        targetValue: kg,
        unit: 'kg',
        sortOrder: i,
      })),
    }),
  ]);
  res.json({ ok: true });
});

// --- Foto de perfil ------------------------------------------------------------

const AVATAR_MAX_BYTES = 300 * 1024;
const avatarSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Formato de imagen no admitido'),
});

/** Sólo el dueño ve su foto: se sirve con sesión y nunca desde una URL pública. */
profileRouter.get('/profile/avatar', async (req, res) => {
  const p = await prisma.userProfile.findUnique({ where: { userId: uid(req) }, select: { avatar: true, avatarMime: true, avatarUpdatedAt: true } });
  if (!p?.avatar || !p.avatarMime) throw new HttpError(404, 'Sin foto de perfil');
  const etag = `"${p.avatarUpdatedAt?.getTime() ?? 0}"`;
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('ETag', etag);
  if (req.get('if-none-match') === etag) {
    res.status(304).end();
    return;
  }
  res.type(p.avatarMime).send(Buffer.from(p.avatar));
});

profileRouter.put('/profile/avatar', async (req, res) => {
  const userId = uid(req);
  const { dataUrl } = parse(avatarSchema, req.body);
  const [head, b64] = dataUrl.split(',') as [string, string];
  const mime = head.slice(5, head.indexOf(';'));
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length > AVATAR_MAX_BYTES) throw new HttpError(413, 'La imagen es demasiado grande');
  await prisma.userProfile.update({ where: { userId }, data: { avatar: bytes, avatarMime: mime, avatarUpdatedAt: new Date() } });
  res.json({ ok: true });
});

profileRouter.delete('/profile/avatar', async (req, res) => {
  await prisma.userProfile.update({ where: { userId: uid(req) }, data: { avatar: null, avatarMime: null, avatarUpdatedAt: null } });
  res.status(204).end();
});

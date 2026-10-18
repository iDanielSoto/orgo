/**
 * Seed inicial: crea la cuenta del usuario principal con su evaluación real.
 * NO crea historiales (peso, agua, sueño…): esos quedan vacíos hasta que se registren.
 *
 * Uso: SEED_USER_EMAIL, SEED_USER_PASSWORD y SEED_USER_NAME en apps/api/.env
 *      pnpm db:seed
 * Es idempotente: si el usuario ya existe, no sobrescribe sus datos.
 */
import { PrismaClient } from '@prisma/client';
import { dateKeyToUtc, toDateKey } from '@forma/core';
import { hashPassword } from '../src/lib/auth';
import { provisionUserDefaults } from '../src/services/defaults';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;
  const displayName = process.env.SEED_USER_NAME?.trim() || 'Usuario';
  if (process.argv.includes('--if-configured') && (!email || !password)) {
    console.log('Seed omitido: no hay SEED_USER_EMAIL / SEED_USER_PASSWORD.');
    return;
  }
  if (!email || !password || password.length < 10) {
    throw new Error('Define SEED_USER_EMAIL y SEED_USER_PASSWORD (mín. 10 caracteres) en apps/api/.env');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.$transaction((tx) => provisionUserDefaults(tx, existing.id));
    console.log(`El usuario ${email} ya existe; sólo se completaron valores por defecto faltantes.`);
    return;
  }

  const timezone = 'America/Mexico_City';
  const today = toDateKey(new Date(), timezone);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, passwordHash: await hashPassword(password) } });
    await provisionUserDefaults(tx, user.id);

    await tx.userProfile.create({
      data: {
        userId: user.id,
        displayName,
        ageYears: 21,
        ageRecordedOn: dateKeyToUtc(today),
        sexForEstimates: 'MALE',
        heightCm: 169,
        startWeightKg: 95,
        targetWeightKg: 75,
        activityLevel: 'SEDENTARY',
        primaryGoal: 'Recomposición corporal',
        secondaryGoals: ['Ganar músculo', 'Desarrollar fuerza', 'Mejorar energía', 'Resistencia', 'Apariencia', 'Salud', 'Disciplina'],
        trainingLocation: 'Casa',
        equipment: [],
        trainingDaysPerWeek: 5,
        sessionMinutes: 30,
        preferredTrainingTime: 'Mañana',
        programStartDate: dateKeyToUtc('2026-10-18'),
        firstReviewDate: dateKeyToUtc('2026-10-24'),
        obstacles: ['Antojos', 'Falta de motivación'],
        onboardingCompletedAt: new Date(),
      },
    });

    await tx.healthProfile.create({
      data: {
        userId: user.id,
        conditions: [],
        medications: [],
        physicalLimitations: [],
        symptoms: ['Cansancio, principalmente por las mañanas cuando duerme mal'],
        dailyActivity: 'Sedentaria; camina menos de 15 minutos al día',
        currentExercise: 'Ocasional',
        physicalCapacity: 'Puede caminar; correr le cuesta',
        dietSummary:
          'Desayuno irregular (a veces nada, tacos, tortillas con guiso, tortas). Comida variable: carnes rojas, comida casera y chatarra. ' +
          'Cena frecuente: tacos. Snacks: Sabritas, Cheetos y frituras. Refresco: 5 o más vasos/latas al día. Agua natural: menos de 1 L. ' +
          'Horarios irregulares; a veces omite comidas.',
        foodPreferences:
          'No le gusta el jitomate crudo solo, sí combinado. Come principalmente lo disponible en casa; prefiere adaptar sus comidas existentes.',
        weeklyExtraBudgetMxn: 250,
        usualBedtime: '02:00',
        usualWakeTime: '08:30',
        usualSleepHours: 6.5,
        sleepQuality: 'Variable; frecuentemente despierta con sueño',
        stressLevel: 'Moderado',
        lifestyleNotes:
          'Muchas horas frente a la computadora. Llega a casa ~00:30, pasa tiempo con su pareja antes de dormir y usa pantallas antes de acostarse. ' +
          'Mayor cansancio en la noche y las mañanas posteriores a dormir mal.',
        snoringReported: false,
        breathingPausesReported: false,
      },
    });

    await tx.userSettings.update({
      where: { userId: user.id },
      data: {
        timezone,
        glassSizeMl: 355,
        sodaBaselineGlasses: 5,
        targetBedtime: '02:00',
        targetWakeTime: '09:30',
        trainingTime: '10:00',
      },
    });
  });

  console.log(`Usuario ${email} creado con su perfil inicial.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

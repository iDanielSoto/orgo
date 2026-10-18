import type { Prisma } from '@prisma/client';
import { DEFAULT_HYDRATION_GOALS } from '@forma/core';

/**
 * Datos iniciales configurables para cualquier usuario nuevo. Todo se guarda en
 * la base de datos y es editable; nada queda fijo en componentes.
 */

export const DEFAULT_HABITS: Omit<Prisma.HabitCreateManyInput, 'userId'>[] = [
  { name: 'Cumplir la actividad programada', frequency: 'DAILY', autoRule: 'SCHEDULED_ACTIVITY', sortOrder: 0 },
  { name: 'Respetar el objetivo de refresco', frequency: 'DAILY', autoRule: 'SODA_LIMIT', sortOrder: 1 },
  { name: 'Alcanzar la meta de agua', frequency: 'DAILY', autoRule: 'WATER_GOAL', sortOrder: 2 },
  {
    name: 'Incluir proteína en comidas principales',
    description: 'Al menos dos comidas principales con una fuente de proteína.',
    frequency: 'DAILY',
    autoRule: 'PROTEIN_MEALS',
    sortOrder: 3,
  },
  {
    name: 'Reservar suficiente tiempo para dormir',
    description: 'Dormir al menos el mínimo de horas que definiste.',
    frequency: 'DAILY',
    autoRule: 'SLEEP_WINDOW',
    sortOrder: 4,
  },
  { name: 'Registrar peso semanal', frequency: 'WEEKLY', autoRule: 'WEEKLY_WEIGH_IN', sortOrder: 5 },
];

export const DEFAULT_WEIGHT_MILESTONES = [92.5, 90, 85, 80, 75];

interface ExerciseSeed {
  slug: string;
  name: string;
  perSide?: boolean;
  equipment?: string;
  instructions: string[];
  cues: string[];
}

export const DEFAULT_EXERCISES: ExerciseSeed[] = [
  {
    slug: 'sentadilla-silla',
    name: 'Sentadilla a silla',
    equipment: 'Silla estable',
    instructions: [
      'Párate frente a una silla con los pies al ancho de la cadera.',
      'Lleva la cadera hacia atrás y baja controlado hasta rozar el asiento.',
      'Empuja el piso con todo el pie para volver a subir.',
    ],
    cues: ['Rodillas en la dirección de las puntas de los pies', 'Pecho alto', 'Baja en 2–3 segundos'],
  },
  {
    slug: 'flexion-inclinada',
    name: 'Flexión inclinada',
    equipment: 'Mesa, barra de cocina o pared',
    instructions: [
      'Apoya las manos en una superficie firme a la altura de la cadera o del pecho.',
      'Camina los pies hacia atrás hasta formar una línea recta de cabeza a talones.',
      'Baja el pecho hacia la superficie y empuja para regresar.',
    ],
    cues: ['Abdomen firme', 'Codos a unos 45° del cuerpo', 'Más alta la superficie = más fácil'],
  },
  {
    slug: 'puente-gluteos',
    name: 'Puente de glúteos',
    instructions: [
      'Acuéstate boca arriba con rodillas flexionadas y pies apoyados.',
      'Empuja con los talones y eleva la cadera hasta alinear rodillas, cadera y hombros.',
      'Sostén un segundo arriba y baja controlado.',
    ],
    cues: ['Aprieta glúteos arriba', 'No arquees la zona lumbar'],
  },
  {
    slug: 'bird-dog',
    name: 'Bird dog',
    perSide: true,
    instructions: [
      'Colócate en cuatro apoyos: manos bajo hombros y rodillas bajo cadera.',
      'Extiende un brazo al frente y la pierna contraria hacia atrás.',
      'Sostén 2 segundos, regresa y alterna.',
    ],
    cues: ['Cadera nivelada', 'Movimiento lento', 'Mirada al piso'],
  },
  {
    slug: 'zancada-asistida',
    name: 'Zancada asistida',
    perSide: true,
    equipment: 'Pared o silla para apoyo',
    instructions: [
      'Apóyate ligeramente en una pared o respaldo.',
      'Da un paso largo hacia atrás y baja la rodilla trasera hacia el piso.',
      'Empuja con la pierna delantera para regresar.',
    ],
    cues: ['Torso erguido', 'Rango cómodo y sin dolor', 'Usa el apoyo lo necesario'],
  },
  {
    slug: 'remo-mochila',
    name: 'Remo con mochila',
    equipment: 'Mochila con libros o botellas',
    instructions: [
      'Sostén la mochila con ambas manos e inclina el torso hacia delante con la espalda recta.',
      'Jala la mochila hacia el abdomen llevando los codos hacia atrás.',
      'Baja controlado.',
    ],
    cues: ['Junta los omóplatos', 'Espalda neutra', 'Ajusta el peso de la mochila'],
  },
  {
    slug: 'bisagra-cadera',
    name: 'Bisagra de cadera',
    instructions: [
      'De pie, pies al ancho de la cadera y rodillas ligeramente flexionadas.',
      'Lleva la cadera hacia atrás inclinando el torso con la espalda recta.',
      'Regresa empujando la cadera hacia delante.',
    ],
    cues: ['Siente el estiramiento en la parte posterior del muslo', 'Columna larga'],
  },
  {
    slug: 'dead-bug',
    name: 'Dead bug',
    perSide: true,
    instructions: [
      'Boca arriba, brazos hacia el techo y rodillas a 90°.',
      'Extiende un brazo hacia atrás y la pierna contraria hacia delante sin despegar la espalda baja.',
      'Regresa y alterna.',
    ],
    cues: ['Exhala al extender', 'Espalda baja en contacto con el piso'],
  },
];

export const DEFAULT_TEMPLATES = [
  {
    code: 'A',
    name: 'Fuerza A',
    warmup: ['Marcha en el lugar 2 min', 'Círculos de brazos 30 s', 'Sentadillas parciales lentas ×8'],
    exercises: [
      { slug: 'sentadilla-silla', sets: 2, repsMin: 8, repsMax: 12, restSeconds: 60 },
      { slug: 'flexion-inclinada', sets: 2, repsMin: 6, repsMax: 10, restSeconds: 60 },
      { slug: 'puente-gluteos', sets: 2, repsMin: 10, repsMax: 15, restSeconds: 45 },
      { slug: 'bird-dog', sets: 2, repsMin: 6, repsMax: 8, restSeconds: 45 },
    ],
  },
  {
    code: 'B',
    name: 'Fuerza B',
    warmup: ['Marcha en el lugar 2 min', 'Movilidad de cadera 30 s por lado', 'Bisagras sin carga ×8'],
    exercises: [
      { slug: 'zancada-asistida', sets: 2, repsMin: 6, repsMax: 8, restSeconds: 60 },
      { slug: 'remo-mochila', sets: 2, repsMin: 8, repsMax: 12, restSeconds: 60 },
      { slug: 'bisagra-cadera', sets: 2, repsMin: 10, repsMax: 10, restSeconds: 45 },
      { slug: 'dead-bug', sets: 2, repsMin: 6, repsMax: 8, restSeconds: 45 },
    ],
  },
];

/** Crea configuración, metas, hábitos, ejercicios y rutinas por defecto. Idempotente. */
export async function provisionUserDefaults(tx: Prisma.TransactionClient, userId: string) {
  await tx.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });

  await tx.hydrationGoal.createMany({
    data: DEFAULT_HYDRATION_GOALS.map((g) => ({ userId, ...g })),
    skipDuplicates: true,
  });

  if ((await tx.habit.count({ where: { userId } })) === 0) {
    await tx.habit.createMany({ data: DEFAULT_HABITS.map((h) => ({ ...h, userId })) });
  }

  if ((await tx.goal.count({ where: { userId, category: 'WEIGHT', isMilestone: true } })) === 0) {
    await tx.goal.createMany({
      data: DEFAULT_WEIGHT_MILESTONES.map((kg, i) => ({
        userId,
        category: 'WEIGHT' as const,
        isMilestone: true,
        title: `${kg} kg`,
        targetValue: kg,
        unit: 'kg',
        sortOrder: i,
      })),
    });
  }

  for (const kind of ['TRAINING', 'WEEKLY_REVIEW', 'WEIGH_IN', 'BEDTIME', 'HYDRATION'] as const) {
    await tx.notificationPreference.upsert({
      where: { userId_kind: { userId, kind } },
      update: {},
      create: { userId, kind, enabled: false, weekdays: [] },
    });
  }

  const exerciseIds = new Map<string, string>();
  for (const e of DEFAULT_EXERCISES) {
    const row = await tx.exercise.upsert({
      where: { userId_slug: { userId, slug: e.slug } },
      update: {},
      create: { userId, slug: e.slug, name: e.name, perSide: e.perSide ?? false, equipment: e.equipment, instructions: e.instructions, cues: e.cues },
    });
    exerciseIds.set(e.slug, row.id);
  }
  for (const t of DEFAULT_TEMPLATES) {
    const exists = await tx.workoutTemplate.findUnique({ where: { userId_code: { userId, code: t.code } } });
    if (exists) continue;
    await tx.workoutTemplate.create({
      data: {
        userId,
        code: t.code,
        name: t.name,
        warmup: t.warmup,
        exercises: {
          create: t.exercises.map((x, position) => ({
            exerciseId: exerciseIds.get(x.slug)!,
            position,
            sets: x.sets,
            repsMin: x.repsMin,
            repsMax: x.repsMax,
            restSeconds: x.restSeconds,
          })),
        },
      },
    });
  }
}

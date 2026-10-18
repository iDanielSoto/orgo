import { z } from 'zod';
import { isDateKey } from './dates';

/** Esquemas compartidos entre cliente y servidor. Unidades canónicas: kg, cm, ml, minutos. */

export const dateKeySchema = z.string().refine(isDateKey, 'Fecha inválida (AAAA-MM-DD)');
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');
export const isoInstantSchema = z.iso.datetime({ offset: true });
export const uuidSchema = z.uuid();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

// --- Auth -------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.email('Correo inválido').trim().toLowerCase(),
  password: z.string().min(1, 'Ingresa tu contraseña').max(200),
});

export const registerSchema = z.object({
  email: z.email('Correo inválido').trim().toLowerCase(),
  password: z.string().min(10, 'Usa al menos 10 caracteres').max(200),
});

// --- Perfil y ajustes -------------------------------------------------------

export const sexSchema = z.enum(['MALE', 'FEMALE']);
export const activityLevelSchema = z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']);

export const profileFieldsSchema = z.object({
    displayName: z.string().trim().min(1).max(60),
    ageYears: z.number().int().min(14).max(100),
    sexForEstimates: sexSchema,
    heightCm: z.number().min(100).max(250),
    startWeightKg: z.number().min(30).max(350),
    targetWeightKg: z.number().min(30).max(350),
    activityLevel: activityLevelSchema,
    primaryGoal: z.string().trim().max(120),
    secondaryGoals: z.array(z.string().trim().min(1).max(80)).max(12),
    programStartDate: dateKeySchema,
    firstReviewDate: dateKeySchema,
    trainingDaysPerWeek: z.number().int().min(0).max(7),
    sessionMinutes: z.number().int().min(5).max(240),
});

export const profileCreateSchema = profileFieldsSchema;
export const profileUpdateSchema = profileFieldsSchema.partial();

export const settingsUpdateSchema = z
  .object({
    timezone: z.string().min(1).max(64),
    theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']),
    nutritionMode: z.enum(['SIMPLE', 'DETAILED']),
    glassSizeMl: z.number().int().min(50).max(1000),
    sodaBaselineGlasses: z.number().min(0).max(40).nullable(),
    energyTargetMinKcal: z.number().int().min(800).max(6000),
    energyTargetMaxKcal: z.number().int().min(800).max(6000),
    proteinTargetMinG: z.number().int().min(0).max(400),
    proteinTargetMaxG: z.number().int().min(0).max(400),
    sleepTargetMinHours: z.number().min(4).max(12),
    sleepTargetMaxHours: z.number().min(4).max(14),
    targetBedtime: clockSchema,
    targetWakeTime: clockSchema,
    trainingTime: clockSchema,
  })
  .partial();

export const hydrationGoalsSchema = z.object({
  goals: z
    .array(
      z.object({
        weekNumber: z.number().int().min(1).max(520),
        waterMl: z.number().int().min(0).max(8000),
        sodaMaxGlasses: z.number().int().min(0).max(40).nullable(),
      }),
    )
    .min(1)
    .max(52)
    .refine((g) => new Set(g.map((x) => x.weekNumber)).size === g.length, 'Semanas repetidas'),
});

// --- Mediciones corporales --------------------------------------------------

const measurementFields = {
  measuredAt: isoInstantSchema,
  weightKg: z.number().min(30).max(350).nullable().optional(),
  waistCm: z.number().min(30).max(250).nullable().optional(),
  hipCm: z.number().min(30).max(250).nullable().optional(),
  chestCm: z.number().min(30).max(250).nullable().optional(),
  armCm: z.number().min(10).max(100).nullable().optional(),
  thighCm: z.number().min(20).max(150).nullable().optional(),
  neckCm: z.number().min(20).max(80).nullable().optional(),
  note: optionalText(500),
};

const hasSomeMeasurement = (m: Record<string, unknown>) =>
  ['weightKg', 'waistCm', 'hipCm', 'chestCm', 'armCm', 'thighCm', 'neckCm'].some(
    (k) => m[k] !== null && m[k] !== undefined,
  );

export const measurementCreateSchema = z
  .object({ id: uuidSchema, ...measurementFields })
  .refine(hasSomeMeasurement, 'Registra al menos una medida');

export const measurementUpdateSchema = z.object(measurementFields).partial();

// --- Bebidas ----------------------------------------------------------------

export const beverageTypeSchema = z.enum(['WATER', 'SODA_REGULAR', 'SODA_ZERO', 'JUICE', 'COFFEE', 'TEA', 'OTHER']);
export type BeverageType = z.infer<typeof beverageTypeSchema>;

export const BEVERAGE_LABEL: Record<BeverageType, string> = {
  WATER: 'Agua natural',
  SODA_REGULAR: 'Refresco',
  SODA_ZERO: 'Refresco sin azúcar',
  JUICE: 'Jugo',
  COFFEE: 'Café',
  TEA: 'Té',
  OTHER: 'Otra bebida',
};

export const beverageCreateSchema = z.object({
  id: uuidSchema,
  type: beverageTypeSchema,
  volumeMl: z.number().int().min(10).max(5000),
  loggedAt: isoInstantSchema,
  note: optionalText(200),
});

export const beverageUpdateSchema = beverageCreateSchema.omit({ id: true }).partial();

// --- Comidas (modo sencillo) ------------------------------------------------

export const mealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);
export type MealType = z.infer<typeof mealTypeSchema>;
export const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Desayuno',
  LUNCH: 'Comida',
  DINNER: 'Cena',
  SNACK: 'Snack',
};

const mealFields = {
  type: mealTypeSchema,
  eatenAt: isoInstantSchema,
  description: z.string().trim().min(1, 'Describe brevemente qué comiste').max(300),
  portion: z.enum(['SMALL', 'MEDIUM', 'LARGE']).nullable().optional(),
  proteinSource: optionalText(120),
  hasFruit: z.boolean().default(false),
  hasVegetables: z.boolean().default(false),
  hungerBefore: z.number().int().min(1).max(5).nullable().optional(),
  note: optionalText(500),
};

export const mealCreateSchema = z.object({ id: uuidSchema, ...mealFields });
export const mealUpdateSchema = z.object(mealFields).partial();

// --- Sueño ------------------------------------------------------------------

const sleepFields = {
  bedtime: isoInstantSchema,
  wakeTime: isoInstantSchema,
  quality: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  note: optionalText(500),
};

const wakeAfterBed = (s: { bedtime?: string; wakeTime?: string }) =>
  !s.bedtime || !s.wakeTime || Date.parse(s.wakeTime) > Date.parse(s.bedtime);

export const sleepCreateSchema = z
  .object({ id: uuidSchema, ...sleepFields })
  .refine(wakeAfterBed, { message: 'La hora de despertar debe ser posterior', path: ['wakeTime'] })
  .refine((s) => Date.parse(s.wakeTime) - Date.parse(s.bedtime) <= 20 * 3600_000, {
    message: 'El periodo de sueño no puede exceder 20 horas',
    path: ['wakeTime'],
  });
export const sleepUpdateSchema = z.object(sleepFields).partial().refine(wakeAfterBed, {
  message: 'La hora de despertar debe ser posterior',
  path: ['wakeTime'],
});

// --- Actividad --------------------------------------------------------------

export const activityLogSchema = z.object({
  id: uuidSchema,
  kind: z.enum(['STRENGTH', 'WALK']),
  routineCode: z.enum(['A', 'B']).nullable().optional(),
  performedAt: isoInstantSchema,
  durationMinutes: z.number().int().min(1).max(300),
  perceivedEffort: z.number().int().min(1).max(10).nullable().optional(),
  pain: z.boolean().default(false),
  excessiveFatigue: z.boolean().default(false),
  poorRecovery: z.boolean().default(false),
  note: optionalText(500),
});

// --- Hábitos ----------------------------------------------------------------

export const habitAutoRuleSchema = z.enum([
  'NONE',
  'SCHEDULED_ACTIVITY',
  'SODA_LIMIT',
  'WATER_GOAL',
  'PROTEIN_MEALS',
  'SLEEP_WINDOW',
  'WEEKLY_WEIGH_IN',
]);

export const habitCreateSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(80),
  description: optionalText(300),
  frequency: z.enum(['DAILY', 'WEEKLY']),
  autoRule: habitAutoRuleSchema.default('NONE'),
});
export const habitUpdateSchema = habitCreateSchema.partial().extend({ sortOrder: z.number().int().optional() });

export const habitCompletionSchema = z.object({ date: dateKeySchema });

// --- Cuenta -----------------------------------------------------------------

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal('ELIMINAR'),
});

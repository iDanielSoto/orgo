import { describe, expect, it } from 'vitest';
import {
  addDays,
  bmi,
  bmiCategory,
  clockSleepMinutes,
  comparePeriods,
  computeNextStep,
  consistency,
  currentAge,
  diffDays,
  estimateTdee,
  evaluateAutoHabit,
  goalForWeek,
  DEFAULT_HYDRATION_GOALS,
  milestoneStatus,
  mifflinStJeor,
  movingAverage,
  nextReviewDate,
  plannedActivity,
  programDay,
  programWeek,
  progressionLevel,
  projectToTarget,
  routineForDate,
  sleepDurationMinutes,
  sleepRegularity,
  startOfIsoWeek,
  toDateKey,
  weekday,
  weightTrend,
  type DayAggregate,
  type NextStepInput,
} from './index';
import { sleepCreateSchema } from './schemas';

const START = '2026-10-18'; // domingo

describe('fechas', () => {
  it('calcula el día local en America/Mexico_City (UTC−6)', () => {
    expect(toDateKey(new Date('2026-10-19T05:30:00Z'), 'America/Mexico_City')).toBe('2026-10-18');
    expect(toDateKey(new Date('2026-10-19T06:30:00Z'), 'America/Mexico_City')).toBe('2026-10-19');
  });
  it('suma días y reconoce semanas ISO', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(diffDays('2026-10-18', '2026-11-14')).toBe(27);
    expect(weekday(START)).toBe(0);
    expect(startOfIsoWeek(START)).toBe('2026-10-12');
    expect(startOfIsoWeek('2026-10-19')).toBe('2026-10-19');
  });
});

describe('IMC y energía', () => {
  it('IMC inicial ≈ 33.3 (obesidad grado I)', () => {
    const v = bmi(95, 169);
    expect(v).toBeCloseTo(33.26, 2);
    expect(bmiCategory(v)).toBe('obesidad-1');
    expect(bmiCategory(24.9)).toBe('normal');
    expect(bmiCategory(40)).toBe('obesidad-3');
  });
  it('rechaza valores no positivos', () => {
    expect(() => bmi(0, 169)).toThrow();
  });
  it('Mifflin-St Jeor y factor sedentario', () => {
    expect(mifflinStJeor({ weightKg: 95, heightCm: 169, age: 21, sex: 'MALE' })).toBeCloseTo(1906.25);
    expect(mifflinStJeor({ weightKg: 95, heightCm: 169, age: 21, sex: 'FEMALE' })).toBeCloseTo(1740.25);
    const { tdee, factor } = estimateTdee({ weightKg: 95, heightCm: 169, age: 21, sex: 'MALE', activity: 'SEDENTARY' });
    expect(factor).toBe(1.2);
    expect(tdee).toBeCloseTo(2287.5);
  });
  it('edad actual a partir de la registrada', () => {
    expect(currentAge(21, '2026-10-17', '2027-10-16')).toBe(21);
    expect(currentAge(21, '2026-10-17', '2027-10-17')).toBe(22);
  });
});

describe('programa', () => {
  it('día y semana del programa', () => {
    expect(programDay(START, '2026-10-17')).toBe(0);
    expect(programDay(START, START)).toBe(1);
    expect(programWeek(START, '2026-10-17')).toBe(1);
    expect(programWeek(START, '2026-10-24')).toBe(1);
    expect(programWeek(START, '2026-10-25')).toBe(2);
    expect(programWeek(START, '2026-11-14')).toBe(4);
  });
  it('próxima revisión semanal', () => {
    expect(nextReviewDate('2026-10-24', '2026-10-17')).toBe('2026-10-24');
    expect(nextReviewDate('2026-10-24', '2026-10-24')).toBe('2026-10-24');
    expect(nextReviewDate('2026-10-24', '2026-10-25')).toBe('2026-10-31');
  });
  it('metas progresivas de agua y refresco', () => {
    expect(goalForWeek(DEFAULT_HYDRATION_GOALS, 1)).toMatchObject({ waterMl: 1200, sodaMaxGlasses: 4 });
    expect(goalForWeek(DEFAULT_HYDRATION_GOALS, 3)).toMatchObject({ waterMl: 1800, sodaMaxGlasses: 2 });
    expect(goalForWeek(DEFAULT_HYDRATION_GOALS, 10)).toMatchObject({ waterMl: 2000, sodaMaxGlasses: 1 });
    expect(goalForWeek([], 1)).toBeNull();
  });
  it('alterna A/B/A y B/A/B entre semanas', () => {
    // Semana del 19 oct: L A, Mi B, V A
    expect(routineForDate(START, '2026-10-19')).toBe('A');
    expect(routineForDate(START, '2026-10-21')).toBe('B');
    expect(routineForDate(START, '2026-10-23')).toBe('A');
    // Semana del 26 oct: L B, Mi A, V B
    expect(routineForDate(START, '2026-10-26')).toBe('B');
    expect(routineForDate(START, '2026-10-28')).toBe('A');
    expect(routineForDate(START, '2026-10-30')).toBe('B');
    // Tercera semana vuelve a A/B/A
    expect(routineForDate(START, '2026-11-02')).toBe('A');
    // Días sin fuerza
    expect(routineForDate(START, '2026-10-20')).toBeNull();
    expect(plannedActivity(START, START).kind).toBe('REST');
    expect(plannedActivity(START, '2026-10-24').kind).toBe('ACTIVE_REST');
    expect(plannedActivity(START, '2026-10-20').label).toBe('Caminata y movilidad');
  });
  it('si el programa inicia en lunes la primera semana es A/B/A', () => {
    expect(routineForDate('2026-10-19', '2026-10-19')).toBe('A');
    expect(routineForDate('2026-10-19', '2026-10-26')).toBe('B');
  });
  it('la progresión no sube si hubo dolor, fatiga o mala recuperación', () => {
    expect(progressionLevel(1, []).level).toBe(1);
    expect(progressionLevel(3, []).level).toBe(3);
    expect(progressionLevel(3, [{ week: 2, adverse: true }]).level).toBe(2);
    expect(progressionLevel(3, [{ week: 1, adverse: true }, { week: 2, adverse: true }]).level).toBe(1);
    expect(progressionLevel(10, []).level).toBe(4);
    expect(progressionLevel(4, []).walkMinutesMax).toBe(30);
  });
});

describe('sueño', () => {
  it('calcula periodos que cruzan medianoche', () => {
    expect(clockSleepMinutes('02:00', '09:30')).toBe(450);
    expect(clockSleepMinutes('23:30', '07:00')).toBe(450);
    expect(clockSleepMinutes('22:00', '22:00')).toBe(1440);
    const bed = new Date('2026-10-19T07:00:00Z'); // 01:00 CDMX
    const wake = new Date('2026-10-19T14:30:00Z'); // 08:30 CDMX
    expect(sleepDurationMinutes(bed, wake)).toBe(450);
    expect(() => sleepDurationMinutes(wake, bed)).toThrow();
  });
  it('valida que despertar sea posterior a acostarse', () => {
    const base = { id: crypto.randomUUID(), bedtime: '2026-10-19T07:00:00Z', wakeTime: '2026-10-19T06:00:00Z' };
    expect(sleepCreateSchema.safeParse(base).success).toBe(false);
    expect(sleepCreateSchema.safeParse({ ...base, wakeTime: '2026-10-19T14:00:00Z' }).success).toBe(true);
  });
  it('regularidad compara correctamente horarios a ambos lados de medianoche', () => {
    expect(sleepRegularity([{ bed: '23:30', wake: '07:00' }])).toBeNull();
    expect(sleepRegularity([
      { bed: '23:30', wake: '07:30' },
      { bed: '00:30', wake: '08:30' },
    ])).toBeCloseTo(30);
  });
});

describe('peso', () => {
  const pts = [
    { date: '2026-10-18', weightKg: 95 },
    { date: '2026-10-21', weightKg: 94.6 },
    { date: '2026-10-25', weightKg: 94.2 },
    { date: '2026-10-25', weightKg: 94.4 },
    { date: '2026-11-01', weightKg: 93.5 },
  ];
  it('promedio móvil temporal de 7 días', () => {
    const ma = movingAverage(pts, 7);
    expect(ma).toHaveLength(4);
    expect(ma[0]!.weightKg).toBe(95);
    expect(ma[2]!.weightKg).toBeCloseTo((94.6 + 94.3) / 2);
  });
  it('tendencia requiere datos suficientes', () => {
    expect(weightTrend(pts.slice(0, 2))).toBeNull();
    const t = weightTrend(pts)!;
    expect(t.kgPerWeek).toBeLessThan(0);
    expect(t.spanDays).toBe(14);
  });
  it('proyección sólo si la tendencia va hacia la meta', () => {
    const t = { kgPerWeek: -0.5, spanDays: 14, points: 4 };
    expect(projectToTarget(85, 75, t, '2026-11-01')).toMatchObject({ weeks: 20 });
    expect(projectToTarget(85, 75, { ...t, kgPerWeek: 0.2 }, '2026-11-01')).toBeNull();
    expect(projectToTarget(85, 75, null, '2026-11-01')).toBeNull();
  });
  it('compara periodos e hitos', () => {
    const c = comparePeriods(pts, '2026-11-01', 7)!;
    expect(c.current).toBeCloseTo(93.5);
    expect(c.previous).toBeCloseTo((94.6 + 94.3) / 2);
    const ms = milestoneStatus(pts, [90, 92.5, 94.5]);
    expect(ms.map((m) => m.targetKg)).toEqual([94.5, 92.5, 90]);
    expect(ms[0]!.achievedOn).toBe('2026-10-25');
    expect(ms[1]!.achievedOn).toBeNull();
  });
});

describe('hábitos', () => {
  const day: DayAggregate = {
    date: '2026-10-19',
    isToday: false,
    beveragesLogged: true,
    waterMl: 1300,
    waterGoalMl: 1200,
    sodaGlasses: 5,
    sodaMaxGlasses: 4,
    plannedKind: 'STRENGTH',
    activityDone: false,
    mainMealsLogged: 0,
    mainMealsWithProtein: 0,
    sleepMinutes: null,
    sleepTargetMinutes: 420,
    weighedThisWeek: true,
  };
  it('evalúa reglas automáticas con datos reales', () => {
    expect(evaluateAutoHabit('WATER_GOAL', day)).toBe('met');
    expect(evaluateAutoHabit('SODA_LIMIT', day)).toBe('not_met');
    expect(evaluateAutoHabit('SCHEDULED_ACTIVITY', day)).toBe('not_met');
    expect(evaluateAutoHabit('SCHEDULED_ACTIVITY', { ...day, isToday: true })).toBe('pending');
    expect(evaluateAutoHabit('SCHEDULED_ACTIVITY', { ...day, plannedKind: 'REST' })).toBe('na');
    expect(evaluateAutoHabit('PROTEIN_MEALS', day)).toBe('no_data');
    expect(evaluateAutoHabit('SLEEP_WINDOW', day)).toBe('no_data');
    expect(evaluateAutoHabit('SLEEP_WINDOW', { ...day, sleepMinutes: 450 })).toBe('met');
    expect(evaluateAutoHabit('WEEKLY_WEIGH_IN', day)).toBe('met');
  });
  it('sin registros de bebidas no afirma que se cumplió', () => {
    const empty = { ...day, beveragesLogged: false, waterMl: 0, sodaGlasses: 0 };
    expect(evaluateAutoHabit('SODA_LIMIT', empty)).toBe('no_data');
    expect(evaluateAutoHabit('WATER_GOAL', empty)).toBe('no_data');
    expect(evaluateAutoHabit('SODA_LIMIT', { ...empty, isToday: true })).toBe('pending');
  });
  it('la consistencia no cuenta días sin datos como fallos', () => {
    const c = consistency(['met', 'met', 'not_met', 'no_data', 'na', 'pending']);
    expect(c.rate).toBeCloseTo(2 / 3);
    expect(c.noData).toBe(1);
    expect(consistency(['na', 'no_data']).rate).toBeNull();
  });
});

describe('siguiente paso', () => {
  const base: NextStepInput = {
    nowMinutes: 10 * 60,
    programDay: 2,
    sleepLoggedLastNight: true,
    isWeighInDay: false,
    weighedThisWeek: false,
    plannedKind: 'STRENGTH',
    plannedLabel: 'Fuerza A',
    activityDone: false,
    trainingMinutes: 10 * 60,
    waterMl: 0,
    waterGoalMl: 1200,
    wakeMinutes: 9 * 60 + 30,
    bedMinutes: 2 * 60,
    mealsLogged: { breakfast: false, lunch: false, dinner: false },
  };
  it('antes del inicio informa cuándo empieza', () => {
    expect(computeNextStep({ ...base, programDay: 0 }).action).toBe('PROGRAM_NOT_STARTED');
  });
  it('por la mañana pide registrar el sueño primero', () => {
    expect(computeNextStep({ ...base, sleepLoggedLastNight: false }).action).toBe('LOG_SLEEP');
  });
  it('sugiere la actividad programada a su hora', () => {
    expect(computeNextStep(base).action).toBe('DO_ACTIVITY');
  });
  it('pide agua si va atrasado y prepara para dormir cerca de la hora', () => {
    expect(computeNextStep({ ...base, activityDone: true, nowMinutes: 16 * 60 }).action).toBe('LOG_WATER');
    expect(computeNextStep({ ...base, activityDone: true, nowMinutes: 60 + 15, waterMl: 1200 }).action).toBe(
      'PREPARE_SLEEP',
    );
  });
  it('dice que va al día cuando no hay nada pendiente', () => {
    expect(
      computeNextStep({
        ...base,
        activityDone: true,
        waterMl: 400,
        nowMinutes: 11 * 60,
        mealsLogged: { breakfast: true, lunch: false, dinner: false },
      }).action,
    ).toBe('ALL_DONE');
  });
});

import { dueReminders, inWindow, type ReminderInput } from './reminders';

describe('recordatorios push', () => {
  const base: ReminderInput = {
    nowMinutes: 10 * 60,
    programDay: 3,
    enabled: { TRAINING: true, HYDRATION: true, BEDTIME: true, WEIGH_IN: true },
    plannedKind: 'STRENGTH',
    plannedLabel: 'Fuerza A',
    activityDone: false,
    trainingMinutes: 10 * 60,
    wakeMinutes: 9 * 60 + 30,
    bedMinutes: 2 * 60,
    waterMl: 0,
    waterGoalMl: 1200,
    isWeighInDay: false,
    weighedThisWeek: false,
  };
  const kinds = (i: ReminderInput) => dueReminders(i).map((r) => r.kind);

  it('la ventana funciona cruzando medianoche', () => {
    expect(inWindow(1, 1435)).toBe(true);
    expect(inWindow(20, 1435)).toBe(false);
  });
  it('avisa del entrenamiento sólo si toca y no está hecho', () => {
    expect(kinds(base)).toContain('TRAINING');
    expect(kinds({ ...base, activityDone: true })).not.toContain('TRAINING');
    expect(kinds({ ...base, plannedKind: 'REST' })).not.toContain('TRAINING');
    expect(kinds({ ...base, enabled: {} })).toEqual([]);
    expect(kinds({ ...base, programDay: 0 })).toEqual([]);
  });
  it('agua sólo si va atrasado', () => {
    const at = { ...base, nowMinutes: 12 * 60 + 30, plannedKind: 'REST' as const };
    expect(kinds(at)).toEqual(['HYDRATION']);
    expect(kinds({ ...at, waterMl: 1000 })).toEqual([]);
  });
  it('aviso para dormir 45 min antes, aunque sea pasada la medianoche', () => {
    expect(kinds({ ...base, nowMinutes: 75, plannedKind: 'REST' })).toEqual(['BEDTIME']);
  });
  it('peso semanal el día de revisión si falta', () => {
    const at = { ...base, nowMinutes: 10 * 60, plannedKind: 'REST' as const, isWeighInDay: true };
    expect(kinds(at)).toEqual(['WEIGH_IN']);
    expect(kinds({ ...at, weighedThisWeek: true })).toEqual([]);
  });
});

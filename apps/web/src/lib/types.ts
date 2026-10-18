import type { ActivityKind, BeverageType, HabitStatus, MealType, NextStep, ProgressionLevel, RoutineCode } from '@forma/core';

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  hasProfile: boolean;
  theme: Theme;
}

export type Theme = 'SYSTEM' | 'LIGHT' | 'DARK';

export interface Today {
  date: string;
  nowMinutes: number;
  displayName: string;
  program: { start: string; day: number; week: number; nextReview: string };
  weight: { startKg: number; targetKg: number; latestKg: number | null; latestDate: string | null; changeKg: number | null };
  activity: {
    date: string;
    kind: ActivityKind;
    routine: RoutineCode | null;
    label: string;
    kindLabel: string;
    done: boolean;
    level: ProgressionLevel;
  };
  hydration: {
    waterMl: number;
    waterGoalMl: number | null;
    sodaGlasses: number;
    sodaMaxGlasses: number | null;
    glassSizeMl: number;
  };
  meals: { id: string; type: MealType; description: string; proteinSource: string | null; eatenAt: string }[];
  schedule: { wake: string; training: string; bed: string };
  sleep: {
    id: string;
    durationMinutes: number;
    quality: number | null;
    energy: number | null;
    bedtime: string;
    wakeTime: string;
  } | null;
  sleepTargetMinHours: number;
  habits: { id: string; name: string; frequency: 'DAILY' | 'WEEKLY'; status: HabitStatus; manual: boolean }[];
  nextStep: NextStep;
}

export interface Profile {
  profile: {
    displayName: string;
    ageYears: number;
    sexForEstimates: 'MALE' | 'FEMALE';
    heightCm: number;
    startWeightKg: number;
    targetWeightKg: number;
    activityLevel: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
    primaryGoal: string;
    secondaryGoals: string[];
    trainingLocation: string | null;
    equipment: string[];
    trainingDaysPerWeek: number;
    sessionMinutes: number;
    preferredTrainingTime: string | null;
    programStartDate: string;
    firstReviewDate: string;
    obstacles: string[];
    avatarVersion: number | null;
  } | null;
  health: {
    conditions: string[];
    medications: string[];
    physicalLimitations: string[];
    symptoms: string[];
    dailyActivity: string | null;
    currentExercise: string | null;
    physicalCapacity: string | null;
    sleepQuality: string | null;
    dietSummary: string | null;
    foodPreferences: string | null;
    weeklyExtraBudgetMxn: number | null;
    usualBedtime: string | null;
    usualWakeTime: string | null;
    usualSleepHours: number | null;
    stressLevel: string | null;
    lifestyleNotes: string | null;
  } | null;
  settings: Settings;
  estimates: {
    weightUsedKg: number;
    age: number;
    bmi: number;
    bmiCategory: string;
    startBmi: number;
    bmrKcal: number;
    tdeeKcal: number;
    activityFactor: number;
  } | null;
}

export interface Settings {
  timezone: string;
  theme: Theme;
  nutritionMode: 'SIMPLE' | 'DETAILED';
  glassSizeMl: number;
  sodaBaselineGlasses: number | null;
  energyTargetMinKcal: number;
  energyTargetMaxKcal: number;
  proteinTargetMinG: number;
  proteinTargetMaxG: number;
  sleepTargetMinHours: number;
  sleepTargetMaxHours: number;
  targetBedtime: string;
  targetWakeTime: string;
  trainingTime: string;
  weatherLatitude: number;
  weatherLongitude: number;
  weatherPlace: string;
}

export interface Measurement {
  id: string;
  measuredAt: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  neckCm: number | null;
  note: string | null;
}

export interface BodySummary {
  startKg: number;
  targetKg: number;
  heightCm: number;
  programStart: string;
  latest: { date: string; weightKg: number } | null;
  changeFromStartKg: number | null;
  remainingKg: number | null;
  progressPct: number;
  bmi: number;
  series: { date: string; weightKg: number; avg7: number }[];
  trend: { kgPerWeek: number; spanDays: number; points: number } | null;
  projection: { weeks: number; date: string } | null;
  weekly: { current: number; previous: number; delta: number } | null;
  monthly: { current: number; previous: number; delta: number } | null;
  milestones: { targetKg: number; achievedOn: string | null }[];
  latestWaist: { date: string; waistCm: number | null } | null;
}

export interface BeverageLog {
  id: string;
  type: BeverageType;
  volumeMl: number;
  loggedAt: string;
  date: string;
  note: string | null;
}

export interface HydrationDay {
  date: string;
  week: number;
  glassSizeMl: number;
  sodaBaselineGlasses: number | null;
  waterMl: number;
  waterGoalMl: number | null;
  sodaMl: number;
  sodaGlasses: number;
  sodaMaxGlasses: number | null;
  otherMl: number;
  logs: BeverageLog[];
}

export interface HydrationHistoryDay {
  date: string;
  waterMl: number;
  waterGoalMl: number | null;
  sodaGlasses: number;
  sodaMaxGlasses: number | null;
}

export interface HydrationGoal {
  weekNumber: number;
  waterMl: number;
  sodaMaxGlasses: number | null;
}

export type HabitAutoRule =
  | 'NONE'
  | 'SCHEDULED_ACTIVITY'
  | 'SODA_LIMIT'
  | 'WATER_GOAL'
  | 'PROTEIN_MEALS'
  | 'SLEEP_WINDOW'
  | 'WEEKLY_WEIGH_IN';

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: 'DAILY' | 'WEEKLY';
  autoRule: HabitAutoRule;
  sortOrder: number;
  archivedAt: string | null;
  today: { status: HabitStatus; manual: boolean };
  week: { date: string; status: HabitStatus; manual: boolean }[];
}

export interface HabitStat {
  id: string;
  name: string;
  frequency: 'DAILY' | 'WEEKLY';
  met: number;
  notMet: number;
  noData: number;
  applicable: number;
  rate: number | null;
}

export interface Meal {
  id: string;
  type: MealType;
  eatenAt: string;
  date: string;
  description: string;
  portion: 'SMALL' | 'MEDIUM' | 'LARGE' | null;
  proteinSource: string | null;
  hasFruit: boolean;
  hasVegetables: boolean;
  hungerBefore: number | null;
  note: string | null;
}

export interface SleepEntry {
  id: string;
  bedtime: string;
  wakeTime: string;
  date: string;
  durationMinutes: number;
  quality: number | null;
  energy: number | null;
  note: string | null;
}

export interface ActivityPlan {
  date: string;
  programWeek: number;
  beforeStart: boolean;
  level: ProgressionLevel;
  today: { date: string; kind: ActivityKind; routine: RoutineCode | null; label: string };
  week: { date: string; kind: ActivityKind; routine: RoutineCode | null; label: string; done: boolean; beforeStart: boolean }[];
  templates: {
    code: string;
    name: string;
    warmup: string[];
    exercises: {
      name: string;
      perSide: boolean;
      equipment: string | null;
      instructions: string[];
      cues: string[];
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
    }[];
  }[];
}

export interface ActivityEntry {
  id: string;
  kind: 'STRENGTH' | 'WALK';
  routineCode: string | null;
  performedAt: string;
  date: string;
  durationMinutes: number | null;
  perceivedEffort: number | null;
  pain: boolean;
  excessiveFatigue: boolean;
  poorRecovery: boolean;
  note: string | null;
}

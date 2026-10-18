/**
 * Métricas corporales y estimaciones energéticas.
 *
 * Todas son ESTIMACIONES poblacionales, no mediciones clínicas.
 */

/**
 * Índice de masa corporal = peso (kg) / estatura (m)².
 * Limitación: no distingue masa muscular de grasa ni su distribución.
 */
export function bmi(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) throw new Error('Peso y estatura deben ser positivos');
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiCategory = 'bajo' | 'normal' | 'sobrepeso' | 'obesidad-1' | 'obesidad-2' | 'obesidad-3';

/** Clasificación de la OMS para adultos. */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'bajo';
  if (value < 25) return 'normal';
  if (value < 30) return 'sobrepeso';
  if (value < 35) return 'obesidad-1';
  if (value < 40) return 'obesidad-2';
  return 'obesidad-3';
}

export const BMI_CATEGORY_LABEL: Record<BmiCategory, string> = {
  bajo: 'Bajo peso',
  normal: 'Rango saludable',
  sobrepeso: 'Sobrepeso',
  'obesidad-1': 'Obesidad grado I',
  'obesidad-2': 'Obesidad grado II',
  'obesidad-3': 'Obesidad grado III',
};

export type Sex = 'MALE' | 'FEMALE';

/**
 * Metabolismo basal (kcal/día) por Mifflin-St Jeor (1990):
 *   hombres: 10·kg + 6.25·cm − 5·edad + 5
 *   mujeres: 10·kg + 6.25·cm − 5·edad − 161
 * Error típico individual ±10 %; tiende a sobreestimar en personas con más masa grasa.
 */
export function mifflinStJeor(params: { weightKg: number; heightCm: number; age: number; sex: Sex }): number {
  const { weightKg, heightCm, age, sex } = params;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'MALE' ? 5 : -161);
}

export const ACTIVITY_FACTORS = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

/** Gasto energético diario estimado = basal × factor de actividad. */
export function estimateTdee(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
}): { bmr: number; tdee: number; factor: number } {
  const bmr = mifflinStJeor(params);
  const factor = ACTIVITY_FACTORS[params.activity];
  return { bmr, tdee: bmr * factor, factor };
}

/** Edad actual a partir de una edad registrada en una fecha. */
export function currentAge(ageYears: number, recordedOn: string, today: string): number {
  const [ry, rm, rd] = recordedOn.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let years = ty - ry;
  if (tm < rm || (tm === rm && td < rd)) years -= 1;
  return ageYears + Math.max(0, years);
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

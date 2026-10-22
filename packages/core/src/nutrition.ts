/**
 * Porciones con la mano (estilo Precision Nutrition): una forma de estimar sin báscula.
 * Valores aproximados para un adulto; sirven de referencia, no de medición exacta.
 */
export type PortionKind = 'PROTEIN' | 'CARBS' | 'VEG' | 'FAT';

export interface PortionInfo {
  label: string;
  /** La parte de la mano que la mide. */
  hand: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  examples: string[];
}

export const PORTIONS: Record<PortionKind, PortionInfo> = {
  PROTEIN: {
    label: 'Proteína',
    hand: 'palma',
    kcal: 130,
    proteinG: 24,
    carbsG: 2,
    fatG: 4,
    examples: ['Pechuga o bistec del tamaño de tu palma', '2 huevos', '1 lata de atún', '1 taza de frijoles con queso'],
  },
  CARBS: {
    label: 'Carbohidrato',
    hand: 'puño',
    kcal: 120,
    proteinG: 3,
    carbsG: 25,
    fatG: 1,
    examples: ['2 tortillas de maíz', '1 taza de arroz o pasta', '1 bolillo chico', '1 papa mediana', '1 fruta grande'],
  },
  VEG: {
    label: 'Verdura',
    hand: 'puño',
    kcal: 25,
    proteinG: 2,
    carbsG: 5,
    fatG: 0,
    examples: ['1 taza de ensalada', 'Calabacita, brócoli o ejotes', 'Nopales', 'Jitomate y cebolla'],
  },
  FAT: {
    label: 'Grasa',
    hand: 'pulgar',
    kcal: 100,
    proteinG: 1,
    carbsG: 2,
    fatG: 10,
    examples: ['¼ de aguacate', '1 cucharada de aceite', 'Un puño chico de cacahuates', '1 rebanada de queso'],
  },
};

export const PORTION_KINDS: PortionKind[] = ['PROTEIN', 'CARBS', 'VEG', 'FAT'];

export type Portions = Record<PortionKind, number>;
export const NO_PORTIONS: Portions = { PROTEIN: 0, CARBS: 0, VEG: 0, FAT: 0 };

/** Energía y macros de un plato a partir de sus porciones. */
export function portionTotals(p: Partial<Portions>) {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  for (const k of PORTION_KINDS) {
    const n = p[k] ?? 0;
    kcal += PORTIONS[k].kcal * n;
    proteinG += PORTIONS[k].proteinG * n;
    carbsG += PORTIONS[k].carbsG * n;
    fatG += PORTIONS[k].fatG * n;
  }
  return { kcal: Math.round(kcal), proteinG: Math.round(proteinG), carbsG: Math.round(carbsG), fatG: Math.round(fatG) };
}

/**
 * Meta diaria aproximada para bajar grasa sin perder músculo: un déficit moderado (15 %) sobre
 * el gasto estimado, redondeado a 50 kcal y nunca por debajo del metabolismo basal.
 */
export function dailyKcalGoal(tdeeKcal: number, bmrKcal: number) {
  return Math.max(Math.round(bmrKcal / 50) * 50, Math.round((tdeeKcal * 0.85) / 50) * 50);
}

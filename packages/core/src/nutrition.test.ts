import { describe, expect, it } from 'vitest';
import { dailyKcalGoal, portionTotals } from './nutrition';

describe('porciones con la mano', () => {
  it('suma energía y macros, con medias porciones', () => {
    expect(portionTotals({ PROTEIN: 2, CARBS: 2, VEG: 1, FAT: 1 })).toEqual({ kcal: 625, proteinG: 57, carbsG: 61, fatG: 20 });
    expect(portionTotals({ PROTEIN: 0.5 }).kcal).toBe(65);
    expect(portionTotals({}).kcal).toBe(0);
  });

  it('propone un déficit moderado sin bajar del basal', () => {
    expect(dailyKcalGoal(2500, 1800)).toBe(2150);
    expect(dailyKcalGoal(1900, 1750)).toBe(1750);
  });
});

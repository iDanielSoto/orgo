import { describe, expect, it } from 'vitest';
import { financeWorkbook } from './finance-import.fixture';
import { parseWorkbook, suggestCategory } from './finance-import';

const TODAY = '2026-10-18';

describe('lectura del Excel de finanzas', () => {
  it('sólo toma celdas capturadas: ninguna fórmula se vuelve movimiento', async () => {
    const { rows, sheets } = await parseWorkbook(await financeWorkbook(TODAY), TODAY);
    expect(rows.map((r) => r.name).sort()).toEqual(
      ['Beca Santander', 'Comida de mi noviecita', 'Deudas', 'Hamburguesas', 'Internet', 'Premio Hacka', 'Sueldo 1 oct', 'Sueldo 28 oct'].sort(),
    );
    // Columnas E:G, totales, "Gasto disponible" y el total de ahorros de Hoja 2 son fórmulas.
    expect(rows.some((r) => /^[EFGL]\d+$|^B25$/.test(r.cellRef))).toBe(false);
    expect(rows.some((r) => r.sheet === 'Hoja 2')).toBe(false);
    expect(sheets.find((s) => s.name === 'Hoja 2')!.formulas).toBe(1);
    expect(sheets.find((s) => s.name === 'OCTUBRE')!.rule).toEqual({ savingsBp: 7000, fixedBp: 2000, funBp: 1000 });
  });

  it('importes en centavos, fechas de la celda o del nombre y huecos sin inventar', async () => {
    const { rows } = await parseWorkbook(await financeWorkbook(TODAY), TODAY);
    const by = (n: string) => rows.find((r) => r.name === n)!;
    expect(by('Premio Hacka')).toMatchObject({ kind: 'INCOME', amountCents: 433333, date: null, month: '2026-10' });
    expect(by('Sueldo 1 oct')).toMatchObject({ amountCents: 210000, date: '2026-10-01' });
    expect(by('Sueldo 28 oct')).toMatchObject({ amountCents: null, date: '2026-10-28' });
    expect(by('Hamburguesas')).toMatchObject({ kind: 'EXPENSE', amountCents: 40000, date: '2026-10-01' });
    expect(by('Deudas')).toMatchObject({ amountCents: 208000, date: null });
    expect(by('Beca Santander')).toMatchObject({ month: '2026-11', date: null });
  });

  it('la huella es estable entre lecturas', async () => {
    const a = await parseWorkbook(await financeWorkbook(TODAY), TODAY);
    const b = await parseWorkbook(await financeWorkbook(TODAY), TODAY);
    expect(a.rows.map((r) => r.rowHash)).toEqual(b.rows.map((r) => r.rowHash));
    expect(new Set(a.rows.map((r) => r.rowHash)).size).toBe(a.rows.length);
  });

  it('sugiere categoría por el concepto', () => {
    const cats = ['Alimentación', 'Pareja', 'Internet', 'Deudas', 'Otros'].map((name, i) => ({ id: String(i), name, defaultBucket: 'FIXED' as const }));
    expect(suggestCategory('Comida de mi noviecita', cats)?.name).toBe('Pareja');
    expect(suggestCategory('Tacos', cats)?.name).toBe('Alimentación');
    expect(suggestCategory('Gasto imbecil', cats)?.name).toBe('Otros');
  });

  it('rechaza archivos que no son .xlsx', async () => {
    await expect(parseWorkbook(Buffer.from('hola'), TODAY)).rejects.toThrow('.xlsx');
  });
});

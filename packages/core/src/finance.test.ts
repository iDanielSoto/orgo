import { describe, expect, it } from 'vitest';
import { accountBalance, allocate, DEFAULT_SPLIT, formatMXN, monthSummary, ruleAt, toCents, type Movement } from './finance';

describe('dinero en centavos', () => {
  it('convierte importes sin errores de punto flotante', () => {
    expect(toCents('4333.33')).toBe(433333);
    expect(toCents('2,100')).toBe(210000);
    expect(toCents('$1,706.5')).toBe(170650);
    expect(toCents(0.1)).toBe(10);
    expect(() => toCents('1.234')).toThrow();
    expect(formatMXN(433333).replace(/\s/g, ' ')).toContain('4,333.33');
  });
});

describe('distribución 70/20/10', () => {
  it('ejemplo del Excel: $2,100 → 1,470 / 420 / 210', () => {
    expect(allocate(210000, DEFAULT_SPLIT)).toEqual({ SAVINGS: 147000, FIXED: 42000, FUN: 21000 });
  });
  it('la suma es exacta aunque haya residuos (Premio Hacka $4,333.33)', () => {
    const a = allocate(433333, DEFAULT_SPLIT);
    expect(a.SAVINGS + a.FIXED + a.FUN).toBe(433333);
    expect(a).toEqual({ SAVINGS: 303333, FIXED: 86667, FUN: 43333 });
  });
  it('suma exacta para muchos importes y repartos', () => {
    for (let c = 0; c < 5000; c += 7) {
      const a = allocate(c, { savingsBp: 3333, fixedBp: 3333, funBp: 3334 });
      expect(a.SAVINGS + a.FIXED + a.FUN).toBe(c);
    }
  });
  it('rechaza porcentajes que no suman 100 % e importes no enteros', () => {
    expect(() => allocate(1000, { savingsBp: 7000, fixedBp: 2000, funBp: 900 })).toThrow();
    expect(() => allocate(10.5, DEFAULT_SPLIT)).toThrow();
  });
  it('los cambios de porcentaje aplican desde su fecha y preservan lo anterior', () => {
    const rules = [
      { effectiveFrom: '2026-10-01', savingsBp: 7000, fixedBp: 2000, funBp: 1000 },
      { effectiveFrom: '2026-11-01', savingsBp: 6000, fixedBp: 3000, funBp: 1000 },
    ];
    expect(ruleAt(rules, '2026-10-30').savingsBp).toBe(7000);
    expect(ruleAt(rules, '2026-11-02').savingsBp).toBe(6000);
    expect(ruleAt([], '2026-11-02')).toEqual(DEFAULT_SPLIT);
  });
});

describe('saldos y resumen mensual', () => {
  const accounts = [
    { id: 'bbva', name: 'BBVA', type: 'DEBIT' as const, openingCents: 100000 },
    { id: 'ahorro', name: 'Ahorro', type: 'SAVINGS' as const, openingCents: 0 },
    { id: 'tdc', name: 'Tarjeta', type: 'CREDIT' as const, openingCents: 0 },
  ];
  const mv = (m: Partial<Movement> & Pick<Movement, 'id' | 'kind' | 'amountCents'>): Movement => ({ date: '2026-10-12', accountId: null, toAccountId: null, bucket: 'NONE', ...m });
  const movements: Movement[] = [
    mv({ id: 'i1', kind: 'INCOME', amountCents: 210000, toAccountId: 'bbva', date: '2026-10-09' }),
    mv({ id: 'g1', kind: 'EXPENSE', amountCents: 12000, accountId: 'bbva', bucket: 'FUN', concept: 'Tacos' }),
    mv({ id: 'g2', kind: 'EXPENSE', amountCents: 40000, accountId: 'tdc', bucket: 'FUN', concept: 'Hamburguesas' }),
    mv({ id: 't1', kind: 'TRANSFER', amountCents: 147000, accountId: 'bbva', toAccountId: 'ahorro' }),
    // pagar la tarjeta: transferencia, no un segundo gasto
    mv({ id: 'p1', kind: 'TRANSFER', amountCents: 40000, accountId: 'bbva', toAccountId: 'tdc' }),
  ];
  const incomes = [
    { id: 'i1', name: 'Sueldo 9 oct', amountCents: 210000, status: 'RECEIVED' as const, receivedOn: '2026-10-09', expectedOn: '2026-10-09', alloc: allocate(210000, DEFAULT_SPLIT) },
    { id: 'i2', name: 'Sueldo 23 oct', amountCents: null, status: 'PLANNED' as const, receivedOn: null, expectedOn: '2026-10-23', alloc: null },
    { id: 'i3', name: 'Beca', amountCents: 450000, status: 'PLANNED' as const, receivedOn: null, expectedOn: '2026-10-30', alloc: null },
  ];

  it('las transferencias mueven dinero sin crear ni gastar', () => {
    expect(accountBalance('bbva', 100000, movements)).toBe(100000 + 210000 - 12000 - 147000 - 40000);
    expect(accountBalance('ahorro', 0, movements)).toBe(147000);
    expect(accountBalance('tdc', 0, movements)).toBe(0); // compra −400 y pago +400
  });

  it('resumen: presupuestos, excedentes, previstos y ahorro separado', () => {
    const s = monthSummary({ month: '2026-10', incomes, movements, budgetMoves: [], accounts });
    expect(s.receivedCents).toBe(210000);
    expect(s.expectedCents).toBe(450000); // los previstos no cuentan como recibidos
    expect(s.expectedUnknown).toBe(1);
    expect(s.spentCents).toBe(52000); // la compra con tarjeta cuenta una sola vez
    expect(s.buckets.FUN).toMatchObject({ assigned: 21000, used: 52000, remaining: -31000, over: 31000 });
    expect(s.buckets.FUN.overCauses[0]).toMatchObject({ concept: 'Hamburguesas', amountCents: 40000 });
    expect(s.buckets.FIXED).toMatchObject({ assigned: 42000, used: 0, remaining: 42000, over: 0 });
    expect(s.savingsSeparatedCents).toBe(147000);
    expect(s.availableRealCents).toBe(accountBalance('bbva', 100000, movements) + 147000);
    expect(s.creditDebtCents).toBe(0);
  });

  it('una transferencia de presupuesto no es dinero nuevo', () => {
    const s = monthSummary({ month: '2026-10', incomes, movements, budgetMoves: [{ month: '2026-10', from: 'FIXED', to: 'FUN', amountCents: 31000 }], accounts });
    expect(s.buckets.FUN.remaining).toBe(0);
    expect(s.buckets.FIXED.assigned).toBe(11000);
    expect(s.receivedCents).toBe(210000);
  });

  it('otro mes no mezcla datos', () => {
    const s = monthSummary({ month: '2026-11', incomes, movements, budgetMoves: [], accounts });
    expect(s.receivedCents).toBe(0);
    expect(s.spentCents).toBe(0);
  });
});

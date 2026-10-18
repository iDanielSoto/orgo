/**
 * Motor financiero de Ordo. Reglas:
 * - Todo el dinero en CENTAVOS enteros; nunca se opera con pesos en punto flotante.
 * - Porcentajes en puntos base (bp): 10000 = 100 %.
 * - La distribución de un ingreso suma EXACTAMENTE su importe (método del mayor residuo).
 * - Presupuesto ≠ dinero real: los presupuestos salen de ingresos recibidos; los saldos, del
 *   libro de movimientos de cada cuenta.
 */
import type { DateKey } from './dates';

export type Bucket = 'SAVINGS' | 'FIXED' | 'FUN';
export const BUCKETS: Bucket[] = ['SAVINGS', 'FIXED', 'FUN'];
export const BUCKET_LABEL: Record<Bucket | 'NONE', string> = {
  SAVINGS: 'Ahorro',
  FIXED: 'Gastos fijos',
  FUN: 'Gustos',
  NONE: 'Sin presupuesto',
};

export interface Split {
  savingsBp: number;
  fixedBp: number;
  funBp: number;
}

export const DEFAULT_SPLIT: Split = { savingsBp: 7000, fixedBp: 2000, funBp: 1000 };

// --- Dinero --------------------------------------------------------------------

/** "2,100.50" | "4333.33" | 2100 → centavos enteros. Rechaza más de 2 decimales. */
export function toCents(value: string | number): number {
  const s = String(value).trim().replace(/[$\s,]/g, '');
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`Importe inválido: ${value}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || 0);
  return m[1] ? -cents : cents;
}

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
export const formatMXN = (cents: number) => mxn.format(cents / 100);

// --- Distribución ---------------------------------------------------------------

export function validSplit(s: Split): boolean {
  return [s.savingsBp, s.fixedBp, s.funBp].every((x) => Number.isInteger(x) && x >= 0) && s.savingsBp + s.fixedBp + s.funBp === 10000;
}

export interface Allocation {
  SAVINGS: number;
  FIXED: number;
  FUN: number;
}

/**
 * Reparte un ingreso según los porcentajes. Se toma la parte entera de cada porción y los
 * centavos sobrantes se dan a las porciones con mayor residuo (empate: en orden ahorro, fijos,
 * gustos). Así la suma es exacta: 433333 → 303333 + 86667 + 43333.
 */
export function allocate(amountCents: number, split: Split): Allocation {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error('El importe debe ser un entero de centavos ≥ 0');
  if (!validSplit(split)) throw new Error('Los porcentajes deben sumar exactamente 100 %');
  const parts = [split.savingsBp, split.fixedBp, split.funBp].map((bp, i) => {
    const exact = amountCents * bp; // en centavos × 10000
    return { i, base: Math.floor(exact / 10000), rem: exact % 10000 };
  });
  let left = amountCents - parts.reduce((a, p) => a + p.base, 0);
  for (const p of [...parts].sort((a, b) => b.rem - a.rem || a.i - b.i)) {
    if (left <= 0) break;
    p.base += 1;
    left -= 1;
  }
  return { SAVINGS: parts[0]!.base, FIXED: parts[1]!.base, FUN: parts[2]!.base };
}

export interface DatedRule extends Split {
  effectiveFrom: DateKey;
}

/** Regla vigente en una fecha: la más reciente con effectiveFrom ≤ fecha (o la distribución por defecto). */
export function ruleAt(rules: DatedRule[], date: DateKey): Split {
  let best: DatedRule | null = null;
  for (const r of rules) if (r.effectiveFrom <= date && (!best || r.effectiveFrom > best.effectiveFrom)) best = r;
  return best ?? DEFAULT_SPLIT;
}

// --- Saldos (libro mayor) ------------------------------------------------------------

export type MovementKind = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT';

export interface Movement {
  id: string;
  kind: MovementKind;
  amountCents: number;
  date: DateKey;
  accountId: string | null;
  toAccountId: string | null;
  bucket: Bucket | 'NONE';
  concept?: string;
}

/**
 * Saldo de una cuenta = saldo inicial + entradas − salidas. Una transferencia entre cuentas
 * resta en una y suma en otra (el total no cambia). Una compra con tarjeta de crédito resta a
 * la tarjeta (crece la deuda); pagar la tarjeta es una transferencia, no otro gasto.
 */
export function accountBalance(accountId: string, openingCents: number, movements: Movement[], upTo?: DateKey): number {
  let bal = openingCents;
  for (const m of movements) {
    if (upTo && m.date > upTo) continue;
    if (m.toAccountId === accountId) bal += m.amountCents;
    if (m.accountId === accountId) bal -= m.amountCents;
  }
  return bal;
}

// --- Resumen mensual -------------------------------------------------------------

export const monthOf = (date: DateKey) => date.slice(0, 7); // YYYY-MM

export interface IncomeLike {
  id: string;
  name: string;
  amountCents: number | null;
  status: 'PLANNED' | 'RECEIVED' | 'CANCELLED';
  receivedOn: DateKey | null;
  expectedOn: DateKey | null;
  alloc: Allocation | null;
}

export interface BudgetMove {
  month: string; // YYYY-MM
  from: Bucket | 'NONE';
  to: Bucket | 'NONE';
  amountCents: number;
}

export interface AccountLike {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'DEBIT' | 'SAVINGS' | 'WALLET' | 'CREDIT';
  openingCents: number;
  archived?: boolean;
}

export interface BucketState {
  assigned: number;
  used: number;
  remaining: number;
  /** used / assigned (0–∞); null si no hay asignación. */
  usage: number | null;
  /** Excedente (> 0 si se gastó más de lo asignado) y los gastos más grandes que lo causaron. */
  over: number;
  overCauses: { concept: string; amountCents: number; date: DateKey }[];
}

export interface MonthSummary {
  month: string;
  receivedCents: number;
  /** Ingresos previstos del mes con importe conocido / cuántos sin importe todavía. */
  expectedCents: number;
  expectedUnknown: number;
  spentCents: number;
  buckets: Record<Bucket, BucketState>;
  /** Dinero efectivamente apartado: transferencias a cuentas de ahorro en el mes. */
  savingsSeparatedCents: number;
  /** Suma de saldos de cuentas que no son crédito (dinero que existe). */
  availableRealCents: number;
  /** Deuda en tarjetas de crédito (saldo negativo, en positivo). */
  creditDebtCents: number;
  balances: { id: string; name: string; type: AccountLike['type']; balanceCents: number }[];
}

export function monthSummary(input: {
  month: string;
  incomes: IncomeLike[];
  movements: Movement[];
  budgetMoves: BudgetMove[];
  accounts: AccountLike[];
}): MonthSummary {
  const { month } = input;
  const inMonth = (d: DateKey | null) => !!d && monthOf(d) === month;

  const assigned: Record<Bucket, number> = { SAVINGS: 0, FIXED: 0, FUN: 0 };
  let receivedCents = 0;
  let expectedCents = 0;
  let expectedUnknown = 0;
  for (const inc of input.incomes) {
    if (inc.status === 'RECEIVED' && inMonth(inc.receivedOn) && inc.amountCents !== null) {
      receivedCents += inc.amountCents;
      if (inc.alloc) for (const b of BUCKETS) assigned[b] += inc.alloc[b];
    } else if (inc.status === 'PLANNED' && inMonth(inc.expectedOn)) {
      if (inc.amountCents === null) expectedUnknown++;
      else expectedCents += inc.amountCents;
    }
  }
  for (const t of input.budgetMoves) {
    if (t.month !== month) continue;
    if (t.from !== 'NONE') assigned[t.from] -= t.amountCents;
    if (t.to !== 'NONE') assigned[t.to] += t.amountCents;
  }

  const used: Record<Bucket, number> = { SAVINGS: 0, FIXED: 0, FUN: 0 };
  const byBucket: Record<Bucket, Movement[]> = { SAVINGS: [], FIXED: [], FUN: [] };
  let spentCents = 0;
  let savingsSeparatedCents = 0;
  const savingsAccounts = new Set(input.accounts.filter((a) => a.type === 'SAVINGS').map((a) => a.id));
  for (const m of input.movements) {
    if (!inMonth(m.date)) continue;
    if (m.kind === 'EXPENSE') {
      spentCents += m.amountCents;
      if (m.bucket !== 'NONE') {
        used[m.bucket] += m.amountCents;
        byBucket[m.bucket].push(m);
      }
    } else if (m.kind === 'TRANSFER' && m.toAccountId && savingsAccounts.has(m.toAccountId) && !(m.accountId && savingsAccounts.has(m.accountId))) {
      savingsSeparatedCents += m.amountCents;
    }
  }

  const buckets = Object.fromEntries(
    BUCKETS.map((b) => {
      const remaining = assigned[b] - used[b];
      const over = Math.max(0, -remaining);
      return [
        b,
        {
          assigned: assigned[b],
          used: used[b],
          remaining,
          usage: assigned[b] > 0 ? used[b] / assigned[b] : null,
          over,
          overCauses: over
            ? [...byBucket[b]]
                .sort((x, y) => y.amountCents - x.amountCents)
                .slice(0, 3)
                .map((m) => ({ concept: m.concept ?? '', amountCents: m.amountCents, date: m.date }))
            : [],
        },
      ];
    }),
  ) as Record<Bucket, BucketState>;

  const balances = input.accounts
    .filter((a) => !a.archived)
    .map((a) => ({ id: a.id, name: a.name, type: a.type, balanceCents: accountBalance(a.id, a.openingCents, input.movements) }));
  const availableRealCents = balances.filter((b) => b.type !== 'CREDIT').reduce((s, b) => s + b.balanceCents, 0);
  const creditDebtCents = balances.filter((b) => b.type === 'CREDIT').reduce((s, b) => s + Math.max(0, -b.balanceCents), 0);

  return { month, receivedCents, expectedCents, expectedUnknown, spentCents, buckets, savingsSeparatedCents, availableRealCents, creditDebtCents, balances };
}

// --- Proyección de fin de mes -------------------------------------------------------

export interface MonthProjection {
  /** Días que faltan del mes después de hoy (0 en meses pasados). */
  daysLeft: number;
  /** Lo que ya entró + lo que falta por recibir con importe conocido. */
  incomingCents: number;
  spentCents: number;
  /** Gasto en gustos que falta, estimado a tu ritmo diario de gustos de este mes. */
  paceCents: number;
  /** incoming − spent − pace: con cuánto cerrarías el mes. */
  endCents: number;
  /** Cómo cerraría cada presupuesto si llegan los ingresos previstos y sigues a tu ritmo. */
  buckets: Record<Bucket, number>;
}

/**
 * Proyección honesta: sólo cuenta ingresos previstos con importe y estima el resto del gasto
 * con lo que ya gastaste en gustos este mes (los fijos no se extrapolan: suelen pagarse una vez).
 * Los ingresos previstos se reparten con su distribución propia o con la regla vigente.
 */
export function monthProjection(input: {
  summary: MonthSummary;
  today: DateKey;
  incomes: (IncomeLike & { split?: Split | null })[];
  split: Split;
}): MonthProjection {
  const { summary: s, today } = input;
  const [y, mo] = s.month.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const current = monthOf(today) === s.month;
  const past = monthOf(today) > s.month;
  const elapsed = current ? Number(today.slice(8, 10)) : past ? daysInMonth : 0;
  const daysLeft = current ? daysInMonth - elapsed : past ? 0 : daysInMonth;

  const expected: Allocation = { SAVINGS: 0, FIXED: 0, FUN: 0 };
  for (const inc of input.incomes) {
    if (inc.status !== 'PLANNED' || inc.amountCents === null || !inc.expectedOn || monthOf(inc.expectedOn) !== s.month) continue;
    const a = allocate(inc.amountCents, inc.split ?? input.split);
    for (const b of BUCKETS) expected[b] += a[b];
  }

  const paceCents = elapsed > 0 && daysLeft > 0 ? Math.round((s.buckets.FUN.used / elapsed) * daysLeft) : 0;
  const buckets = Object.fromEntries(
    BUCKETS.map((b) => [b, s.buckets[b].remaining + expected[b] - (b === 'FUN' ? paceCents : 0)]),
  ) as Record<Bucket, number>;
  const incomingCents = s.receivedCents + s.expectedCents;
  return { daysLeft, incomingCents, spentCents: s.spentCents, paceCents, endCents: incomingCents - s.spentCents - paceCents, buckets };
}

import { Router } from 'express';
import { z } from 'zod';
import {
  accountCreateSchema,
  accountUpdateSchema,
  addDays,
  allocate,
  bucketLedger,
  budgetRuleSchema,
  budgetTransferSchema,
  dateKeyToUtc,
  incomeCreateSchema,
  incomeUpdateSchema,
  monthProjection,
  monthSummary,
  ruleAt,
  transactionCreateSchema,
  transactionUpdateSchema,
  type DatedRule,
  type Movement,
  type Split,
} from '@forma/core';
import { Prisma, type BudgetBucket, type Income, type PrismaClient, type Transaction } from '@prisma/client';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, notFound, parse } from '../lib/http';
import { dateKey } from '../lib/serialize';
import { loadContext } from '../services/context';

/** Finanzas de Ordo. Todo importe en centavos; los saldos se derivan del libro de movimientos. */
export const financeRouter = Router();

export type Tx = Prisma.TransactionClient | PrismaClient;

const DEFAULT_CATEGORIES: { name: string; bucket: BudgetBucket }[] = [
  { name: 'Alimentación', bucket: 'FIXED' },
  { name: 'Transporte', bucket: 'FIXED' },
  { name: 'Servicios', bucket: 'FIXED' },
  { name: 'Internet', bucket: 'FIXED' },
  { name: 'Salud', bucket: 'FIXED' },
  { name: 'Educación', bucket: 'FIXED' },
  { name: 'Compras', bucket: 'FUN' },
  { name: 'Entretenimiento', bucket: 'FUN' },
  { name: 'Pareja', bucket: 'FUN' },
  { name: 'Deudas', bucket: 'FIXED' },
  { name: 'Suscripciones', bucket: 'FIXED' },
  { name: 'Otros', bucket: 'FUN' },
];

/** Categorías iniciales y regla 70/20/10 la primera vez que se usa Finanzas. */
export async function ensureDefaults(userId: string) {
  if ((await prisma.financeCategory.count({ where: { userId } })) === 0) {
    await prisma.financeCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c, i) => ({ userId, name: c.name, defaultBucket: c.bucket, sortOrder: i })),
      skipDuplicates: true,
    });
  }
  if ((await prisma.budgetRule.count({ where: { userId } })) === 0) {
    // Regla de partida (la del Excel), vigente desde siempre: no altera historiales.
    await prisma.budgetRule.create({ data: { userId, savingsBp: 7000, fixedBp: 2000, funBp: 1000, effectiveFrom: dateKeyToUtc('2000-01-01') } });
  }
}

export const rulesOf = async (db: Tx, userId: string): Promise<DatedRule[]> =>
  (await db.budgetRule.findMany({ where: { userId } })).map((r) => ({ effectiveFrom: dateKey(r.effectiveFrom), savingsBp: r.savingsBp, fixedBp: r.fixedBp, funBp: r.funBp }));

export async function ownAccount(db: Tx, userId: string, id: string | null | undefined) {
  if (!id) return null;
  const a = await db.financialAccount.findFirst({ where: { id, userId } });
  if (!a) throw new HttpError(400, 'Cuenta no encontrada');
  return a;
}
export async function ownCategory(db: Tx, userId: string, id: string | null | undefined) {
  if (!id) return null;
  const c = await db.financeCategory.findFirst({ where: { id, userId } });
  if (!c) throw new HttpError(400, 'Categoría no encontrada');
  return c;
}

const toMovement = (t: Transaction): Movement => ({
  id: t.id,
  kind: t.kind,
  amountCents: t.amountCents,
  date: dateKey(t.localDate),
  accountId: t.accountId,
  toAccountId: t.toAccountId,
  bucket: t.bucket,
  concept: t.concept,
});

const serializeTx = (t: Transaction & { category?: { name: string } | null }) => ({
  id: t.id,
  kind: t.kind,
  amountCents: t.amountCents,
  date: dateKey(t.localDate),
  occurredAt: t.occurredAt.toISOString(),
  concept: t.concept,
  accountId: t.accountId,
  toAccountId: t.toAccountId,
  categoryId: t.categoryId,
  category: t.category?.name ?? null,
  bucket: t.bucket,
  incomeId: t.incomeId,
  notes: t.notes,
});

const serializeIncome = (i: Income) => ({
  id: i.id,
  name: i.name,
  amountCents: i.amountCents,
  type: i.type,
  frequency: i.frequency,
  status: i.status,
  expectedOn: i.expectedOn ? dateKey(i.expectedOn) : null,
  receivedOn: i.receivedOn ? dateKey(i.receivedOn) : null,
  accountId: i.accountId,
  split:
    i.savingsBpOverride !== null && i.fixedBpOverride !== null && i.funBpOverride !== null
      ? { savingsBp: i.savingsBpOverride, fixedBp: i.fixedBpOverride, funBp: i.funBpOverride }
      : null,
  alloc: i.allocSavingsCents !== null ? { SAVINGS: i.allocSavingsCents, FIXED: i.allocFixedCents!, FUN: i.allocFunCents! } : null,
  notes: i.notes,
});

const monthRange = (month: string) => {
  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
};

const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

// --- Resumen ---------------------------------------------------------------------

financeRouter.get('/finance/summary', async (req, res) => {
  const userId = uid(req);
  await ensureDefaults(userId);
  const ctx = await loadContext(userId);
  const month = parse(monthQuery, req.query).month ?? ctx.today.slice(0, 7);
  const { from, to } = monthRange(month);
  const [accounts, txs, incomes, allMoves] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    // Saldos: todos los movimientos hasta el fin del mes.
    prisma.transaction.findMany({ where: { userId, localDate: { lte: dateKeyToUtc(to) } }, include: { category: { select: { name: true } } }, orderBy: { occurredAt: 'desc' } }),
    prisma.income.findMany({ where: { userId } }),
    // Hasta este mes: los sobres son acumulativos.
    prisma.budgetTransfer.findMany({ where: { userId, month: { lte: dateKeyToUtc(from) } } }),
  ]);
  const toMove = (m: (typeof allMoves)[number]) => ({ month: dateKey(m.month).slice(0, 7), from: m.fromBucket, to: m.toBucket, amountCents: m.amountCents });
  const moves = allMoves.filter((m) => dateKey(m.month) === from);
  const incomeLikes = incomes.map((i) => {
    const s = serializeIncome(i);
    return { id: s.id, name: s.name, amountCents: s.amountCents, status: s.status, receivedOn: s.receivedOn, expectedOn: s.expectedOn, alloc: s.alloc, split: s.split };
  });
  const summary = monthSummary({
    month,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, openingCents: a.openingBalanceCents, archived: Boolean(a.archivedAt) })),
    movements: txs.map(toMovement),
    incomes: incomeLikes,
    budgetMoves: moves.map(toMove),
  });
  const ledger = bucketLedger({ upTo: month, incomes: incomeLikes, movements: txs.map(toMovement), budgetMoves: allMoves.map(toMove) }).slice(-12);
  const rule = ruleAt(await rulesOf(prisma, userId), ctx.today);
  const projection = monthProjection({ summary, today: ctx.today, incomes: incomeLikes, split: rule });
  const upcoming = incomes
    .filter((i) => i.status === 'PLANNED')
    .map(serializeIncome)
    .sort((a, b) => (a.expectedOn ?? '9999') .localeCompare(b.expectedOn ?? '9999'))
    .slice(0, 5);
  res.json({
    ...summary,
    today: ctx.today,
    // Para "puedes gastar hoy": lo gastado hoy se descuenta aparte del presupuesto diario.
    spentTodayCents: txs.filter((t) => t.kind === 'EXPENSE' && dateKey(t.localDate) === ctx.today).reduce((a, t) => a + t.amountCents, 0),
    recent: txs.filter((t) => dateKey(t.localDate) >= from).slice(0, 20).map(serializeTx),
    upcoming,
    projection,
    rule,
    ledger,
  });
});

// --- Cuentas -----------------------------------------------------------------------

financeRouter.get('/finance/accounts', async (req, res) => {
  const userId = uid(req);
  const [accounts, txs] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({ where: { userId, OR: [{ accountId: { not: null } }, { toAccountId: { not: null } }] } }),
  ]);
  const movements = txs.map(toMovement);
  res.json(
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      openingBalanceCents: a.openingBalanceCents,
      openedOn: dateKey(a.openedOn),
      archived: Boolean(a.archivedAt),
      balanceCents:
        a.openingBalanceCents +
        movements.reduce((s, m) => s + (m.toAccountId === a.id ? m.amountCents : 0) - (m.accountId === a.id ? m.amountCents : 0), 0),
      movements: movements.filter((m) => m.accountId === a.id || m.toAccountId === a.id).length,
    })),
  );
});

financeRouter.post('/finance/accounts', async (req, res) => {
  const userId = uid(req);
  const d = parse(accountCreateSchema, req.body);
  const existing = await prisma.financialAccount.findUnique({ where: { id: d.id } });
  if (existing) {
    if (existing.userId !== userId) throw new HttpError(409, 'Identificador en conflicto');
    return void res.json({ id: existing.id });
  }
  await prisma.financialAccount.create({
    data: { id: d.id, userId, name: d.name, type: d.type, openingBalanceCents: d.openingBalanceCents, openedOn: dateKeyToUtc(d.openedOn) },
  });
  res.status(201).json({ id: d.id });
});

financeRouter.patch('/finance/accounts/:id', async (req, res) => {
  const userId = uid(req);
  const d = parse(accountUpdateSchema, req.body);
  const a = await ownAccount(prisma, userId, req.params.id);
  await prisma.financialAccount.update({
    where: { id: a!.id },
    data: { name: d.name, archivedAt: d.archived === undefined ? undefined : d.archived ? new Date() : null },
  });
  res.json({ ok: true });
});

financeRouter.delete('/finance/accounts/:id', async (req, res) => {
  const userId = uid(req);
  const a = await prisma.financialAccount.findFirst({ where: { id: req.params.id, userId } });
  if (!a) throw notFound('Cuenta');
  const used = await prisma.transaction.count({ where: { OR: [{ accountId: a.id }, { toAccountId: a.id }] } });
  if (used) throw new HttpError(409, 'La cuenta tiene movimientos: archívala en lugar de borrarla');
  await prisma.financialAccount.delete({ where: { id: a.id } });
  res.status(204).end();
});

// --- Categorías ----------------------------------------------------------------------

financeRouter.get('/finance/categories', async (req, res) => {
  const userId = uid(req);
  await ensureDefaults(userId);
  const cats = await prisma.financeCategory.findMany({ where: { userId, archivedAt: null }, orderBy: { sortOrder: 'asc' } });
  res.json(cats.map((c) => ({ id: c.id, name: c.name, defaultBucket: c.defaultBucket })));
});

// --- Regla de presupuesto --------------------------------------------------------------

financeRouter.get('/finance/rule', async (req, res) => {
  const userId = uid(req);
  await ensureDefaults(userId);
  const ctx = await loadContext(userId);
  const rules = await rulesOf(prisma, userId);
  res.json({ current: ruleAt(rules, ctx.today), history: rules.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)) });
});

/** Cambiar porcentajes desde una fecha: los ingresos ya recibidos conservan su distribución. */
financeRouter.put('/finance/rule', async (req, res) => {
  const userId = uid(req);
  const d = parse(budgetRuleSchema, req.body);
  await prisma.budgetRule.create({ data: { userId, savingsBp: d.savingsBp, fixedBp: d.fixedBp, funBp: d.funBp, effectiveFrom: dateKeyToUtc(d.effectiveFrom) } });
  res.status(201).json({ ok: true });
});

financeRouter.post('/finance/budget-transfers', async (req, res) => {
  const userId = uid(req);
  const d = parse(budgetTransferSchema, req.body);
  if (d.fromBucket === d.toBucket) throw new HttpError(400, 'Elige dos presupuestos distintos');
  await prisma.budgetTransfer.upsert({
    where: { id: d.id },
    update: {},
    create: { id: d.id, userId, month: dateKeyToUtc(`${d.month}-01`), fromBucket: d.fromBucket, toBucket: d.toBucket, amountCents: d.amountCents, note: d.note },
  });
  res.status(201).json({ ok: true });
});

// --- Ingresos --------------------------------------------------------------------------

/**
 * Deja un ingreso consistente: si está recibido fija su distribución con la regla vigente en la
 * fecha (o la propia) y crea/actualiza su movimiento INCOME; si no, borra ambos.
 */
export async function syncIncome(db: Prisma.TransactionClient, income: Income) {
  const received = income.status === 'RECEIVED' && income.amountCents !== null && income.receivedOn;
  if (!received) {
    await db.transaction.deleteMany({ where: { incomeId: income.id } });
    await db.income.update({ where: { id: income.id }, data: { allocSavingsCents: null, allocFixedCents: null, allocFunCents: null } });
    return;
  }
  const date = dateKey(income.receivedOn!);
  const split: Split =
    income.savingsBpOverride !== null && income.fixedBpOverride !== null && income.funBpOverride !== null
      ? { savingsBp: income.savingsBpOverride, fixedBp: income.fixedBpOverride, funBp: income.funBpOverride }
      : ruleAt(await rulesOf(db, income.userId), date);
  const a = allocate(income.amountCents!, split);
  await db.income.update({ where: { id: income.id }, data: { allocSavingsCents: a.SAVINGS, allocFixedCents: a.FIXED, allocFunCents: a.FUN } });
  const txData = {
    kind: 'INCOME' as const,
    amountCents: income.amountCents!,
    occurredAt: dateKeyToUtc(date),
    localDate: dateKeyToUtc(date),
    concept: income.name,
    toAccountId: income.accountId,
    accountId: null,
    bucket: 'NONE' as const,
  };
  const existing = await db.transaction.findUnique({ where: { incomeId: income.id } });
  if (existing) await db.transaction.update({ where: { id: existing.id }, data: txData });
  else await db.transaction.create({ data: { id: crypto.randomUUID(), userId: income.userId, incomeId: income.id, ...txData } });
}

financeRouter.get('/finance/incomes', async (req, res) => {
  const userId = uid(req);
  const rows = await prisma.income.findMany({ where: { userId }, orderBy: [{ receivedOn: 'desc' }, { expectedOn: 'desc' }, { createdAt: 'desc' }] });
  res.json(rows.map(serializeIncome));
});

financeRouter.post('/finance/incomes', async (req, res) => {
  const userId = uid(req);
  const d = parse(incomeCreateSchema, req.body);
  if (d.status === 'RECEIVED' && (d.amountCents === null || !d.receivedOn)) throw new HttpError(400, 'Un ingreso recibido necesita importe y fecha de recepción');
  const prior = await prisma.income.findUnique({ where: { id: d.id } });
  if (prior) {
    if (prior.userId !== userId) throw new HttpError(409, 'Identificador en conflicto');
    return void res.json(serializeIncome(prior));
  }
  await ownAccount(prisma, userId, d.accountId);
  const income = await prisma.$transaction(async (db) => {
    const created = await db.income.create({
      data: {
        id: d.id,
        userId,
        name: d.name,
        amountCents: d.amountCents,
        type: d.type,
        frequency: d.frequency,
        status: d.status,
        expectedOn: d.expectedOn ? dateKeyToUtc(d.expectedOn) : null,
        receivedOn: d.receivedOn ? dateKeyToUtc(d.receivedOn) : null,
        accountId: d.accountId ?? null,
        savingsBpOverride: d.split?.savingsBp ?? null,
        fixedBpOverride: d.split?.fixedBp ?? null,
        funBpOverride: d.split?.funBp ?? null,
        notes: d.notes,
      },
    });
    await syncIncome(db, created);
    return db.income.findUniqueOrThrow({ where: { id: created.id } });
  });
  res.status(201).json(serializeIncome(income));
});

financeRouter.patch('/finance/incomes/:id', async (req, res) => {
  const userId = uid(req);
  const d = parse(incomeUpdateSchema, req.body);
  const current = await prisma.income.findFirst({ where: { id: req.params.id, userId } });
  if (!current) throw notFound('Ingreso');
  if (d.accountId) await ownAccount(prisma, userId, d.accountId);
  const income = await prisma.$transaction(async (db) => {
    const updated = await db.income.update({
      where: { id: current.id },
      data: {
        name: d.name,
        amountCents: d.amountCents === undefined ? undefined : d.amountCents,
        type: d.type,
        frequency: d.frequency,
        status: d.status,
        expectedOn: d.expectedOn === undefined ? undefined : d.expectedOn ? dateKeyToUtc(d.expectedOn) : null,
        receivedOn: d.receivedOn === undefined ? undefined : d.receivedOn ? dateKeyToUtc(d.receivedOn) : null,
        accountId: d.accountId === undefined ? undefined : d.accountId,
        ...(d.split !== undefined
          ? { savingsBpOverride: d.split?.savingsBp ?? null, fixedBpOverride: d.split?.fixedBp ?? null, funBpOverride: d.split?.funBp ?? null }
          : {}),
        notes: d.notes === undefined ? undefined : d.notes,
      },
    });
    if (updated.status === 'RECEIVED' && (updated.amountCents === null || !updated.receivedOn)) {
      throw new HttpError(400, 'Un ingreso recibido necesita importe y fecha de recepción');
    }
    await syncIncome(db, updated);
    return db.income.findUniqueOrThrow({ where: { id: updated.id } });
  });
  res.json(serializeIncome(income));
});

financeRouter.delete('/finance/incomes/:id', async (req, res) => {
  const { count } = await prisma.income.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!count) throw notFound('Ingreso');
  res.status(204).end();
});

// --- Movimientos (gastos, transferencias, ajustes) ---------------------------------------

const txQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  kind: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT']).optional(),
  q: z.string().max(80).optional(),
});

financeRouter.get('/finance/transactions', async (req, res) => {
  const userId = uid(req);
  const q = parse(txQuery, req.query);
  const where: Prisma.TransactionWhereInput = { userId };
  if (q.month) {
    const { from, to } = monthRange(q.month);
    where.localDate = { gte: dateKeyToUtc(from), lte: dateKeyToUtc(to) };
  }
  if (q.kind) where.kind = q.kind;
  if (q.q) where.concept = { contains: q.q, mode: 'insensitive' };
  const rows = await prisma.transaction.findMany({ where, include: { category: { select: { name: true } } }, orderBy: [{ localDate: 'desc' }, { occurredAt: 'desc' }], take: 500 });
  res.json(rows.map(serializeTx));
});

/** Conceptos frecuentes para registrar en segundos (los propios, no inventados). */
financeRouter.get('/finance/suggestions', async (req, res) => {
  const userId = uid(req);
  const rows = await prisma.transaction.groupBy({
    by: ['concept', 'categoryId', 'bucket'],
    where: { userId, kind: 'EXPENSE' },
    _count: { _all: true },
    _max: { occurredAt: true, amountCents: true },
    orderBy: { _count: { concept: 'desc' } },
    take: 8,
  });
  res.json(rows.map((r) => ({ concept: r.concept, categoryId: r.categoryId, bucket: r.bucket, lastAmountCents: r._max.amountCents, uses: r._count._all })));
});

financeRouter.post('/finance/transactions', async (req, res) => {
  const userId = uid(req);
  const d = parse(transactionCreateSchema, req.body);
  const prior = await prisma.transaction.findUnique({ where: { id: d.id } });
  if (prior) {
    if (prior.userId !== userId) throw new HttpError(409, 'Identificador en conflicto');
    return void res.json(serializeTx(prior)); // reintento: no se descuenta dos veces
  }
  await ownAccount(prisma, userId, d.accountId);
  await ownAccount(prisma, userId, d.toAccountId);
  await ownCategory(prisma, userId, d.categoryId);
  const isExpense = d.kind === 'EXPENSE';
  const tx = await prisma.transaction.create({
    data: {
      id: d.id,
      userId,
      kind: d.kind,
      amountCents: d.amountCents,
      occurredAt: new Date(),
      localDate: dateKeyToUtc(d.date),
      concept: d.concept,
      accountId: d.kind === 'ADJUSTMENT' || isExpense || d.kind === 'TRANSFER' ? (d.accountId ?? null) : null,
      toAccountId: d.kind === 'TRANSFER' || d.kind === 'ADJUSTMENT' ? (d.toAccountId ?? null) : null,
      categoryId: isExpense ? (d.categoryId ?? null) : null,
      bucket: isExpense ? d.bucket : 'NONE',
      notes: d.notes,
    },
    include: { category: { select: { name: true } } },
  });
  res.status(201).json(serializeTx(tx));
});

financeRouter.patch('/finance/transactions/:id', async (req, res) => {
  const userId = uid(req);
  const d = parse(transactionUpdateSchema, req.body);
  const t = await prisma.transaction.findFirst({ where: { id: req.params.id, userId } });
  if (!t) throw notFound('Movimiento');
  if (t.incomeId) throw new HttpError(400, 'Este movimiento viene de un ingreso: edítalo desde el ingreso');
  await ownAccount(prisma, userId, d.accountId);
  await ownAccount(prisma, userId, d.toAccountId);
  await ownCategory(prisma, userId, d.categoryId);
  const updated = await prisma.transaction.update({
    where: { id: t.id },
    data: {
      amountCents: d.amountCents,
      localDate: d.date ? dateKeyToUtc(d.date) : undefined,
      concept: d.concept,
      accountId: d.accountId,
      toAccountId: t.kind === 'EXPENSE' ? undefined : d.toAccountId,
      categoryId: t.kind === 'EXPENSE' ? d.categoryId : undefined,
      bucket: t.kind === 'EXPENSE' ? d.bucket : undefined,
      notes: d.notes,
    },
    include: { category: { select: { name: true } } },
  });
  res.json(serializeTx(updated));
});

financeRouter.delete('/finance/transactions/:id', async (req, res) => {
  const userId = uid(req);
  const t = await prisma.transaction.findFirst({ where: { id: req.params.id, userId } });
  if (!t) throw notFound('Movimiento');
  if (t.incomeId) throw new HttpError(400, 'Este movimiento viene de un ingreso: elimínalo desde el ingreso');
  await prisma.transaction.delete({ where: { id: t.id } });
  res.status(204).end();
});

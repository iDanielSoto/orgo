import { createHash, randomUUID } from 'node:crypto';
import { dateKeyToUtc } from '@forma/core';
import type { Prisma } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db';
import { uid } from '../lib/auth';
import { HttpError, parse } from '../lib/http';
import { dateKey } from '../lib/serialize';
import { loadContext } from '../services/context';
import { parseWorkbook, suggestCategory, suggestIncomeType, type ParsedRow, type ParsedWorkbook } from '../services/finance-import';
import { ensureDefaults, ownAccount, ownCategory, syncIncome } from './finance';

/**
 * Importación del Excel de finanzas en dos pasos: vista previa (no crea nada) y confirmación
 * (crea ingresos y gastos ligados a su fila, en una sola transacción y sin duplicar filas ya
 * importadas).
 */
export const financeImportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 2, fieldSize: 200_000 },
});

function receiveFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) return next(new HttpError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'El archivo pesa más de 2 MB' : 'Archivo inválido'));
    if (err) return next(err);
    if (!req.file) return next(new HttpError(400, 'Adjunta el archivo .xlsx'));
    if (!/\.xlsx$/i.test(req.file.originalname)) return next(new HttpError(400, 'Sólo se aceptan archivos .xlsx'));
    next();
  });
}

async function read(file: Express.Multer.File, today: string): Promise<ParsedWorkbook> {
  try {
    return await parseWorkbook(file.buffer, today);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : 'No se pudo leer el archivo');
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Estado del ingreso: sin importe o en un mes/fecha futura es previsto; si ya pasó, recibido
 * (y entonces necesita cuenta destino).
 */
function incomeStatus(row: ParsedRow, date: string | null, today: string): 'PLANNED' | 'RECEIVED' {
  if (row.amountCents === null) return 'PLANNED';
  if (row.month && row.month > today.slice(0, 7)) return 'PLANNED';
  if (date && date > today) return 'PLANNED';
  return 'RECEIVED';
}

/** Huellas ya importadas por este usuario (sólo lotes confirmados). */
async function importedHashes(db: Prisma.TransactionClient | typeof prisma, userId: string, hashes: string[]) {
  const rows = await db.importRow.findMany({
    where: { rowHash: { in: hashes }, batch: { userId, status: 'CONFIRMED' } },
    select: { rowHash: true },
  });
  return new Set(rows.map((r) => r.rowHash));
}

// --- Vista previa ------------------------------------------------------------------------

financeImportRouter.post('/finance/import/preview', receiveFile, async (req, res) => {
  const userId = uid(req);
  await ensureDefaults(userId);
  const ctx = await loadContext(userId);
  const parsed = await read(req.file!, ctx.today);
  const hashes = parsed.rows.map((r) => r.rowHash);
  const dates = parsed.rows.map((r) => r.date).filter((d): d is string => Boolean(d));
  const [done, categories, incomes, expenses] = await Promise.all([
    importedHashes(prisma, userId, hashes),
    prisma.financeCategory.findMany({ where: { userId, archivedAt: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.income.findMany({ where: { userId, importRowId: null } }),
    dates.length
      ? prisma.transaction.findMany({
          where: { userId, kind: 'EXPENSE', importRowId: null, localDate: { in: [...new Set(dates)].map(dateKeyToUtc) } },
        })
      : Promise.resolve([]),
  ]);

  // Registros capturados a mano que parecen la misma fila: se avisan para no duplicarlos.
  const manualIncome = new Set(incomes.map((i) => [norm(i.name), i.amountCents ?? '', i.receivedOn ? dateKey(i.receivedOn) : i.expectedOn ? dateKey(i.expectedOn) : ''].join('|')));
  const manualExpense = new Set(expenses.map((t) => [norm(t.concept), t.amountCents, dateKey(t.localDate)].join('|')));

  const rows = parsed.rows.map((r) => {
    const issues: ('NO_DATE' | 'NO_AMOUNT')[] = [];
    if (!r.date) issues.push('NO_DATE');
    if (r.amountCents === null) issues.push('NO_AMOUNT');
    const key = [norm(r.name), r.amountCents ?? '', r.date ?? ''].join('|');
    const base = { rowHash: r.rowHash, kind: r.kind, sheet: r.sheet, cellRef: r.cellRef, name: r.name, amountCents: r.amountCents, date: r.date, month: r.month, issues, alreadyImported: done.has(r.rowHash) };
    if (r.kind === 'INCOME') {
      return { ...base, status: incomeStatus(r, r.date, ctx.today), incomeType: suggestIncomeType(r.name), categoryId: null, bucket: null, possibleDuplicate: manualIncome.has(key) };
    }
    const cat = suggestCategory(r.name, categories);
    const bucket = cat && cat.defaultBucket !== 'NONE' ? cat.defaultBucket : 'FUN';
    return { ...base, status: null, incomeType: null, categoryId: cat?.id ?? null, bucket, possibleDuplicate: manualExpense.has(key) };
  });

  res.json({
    fileName: req.file!.originalname,
    today: ctx.today,
    sheets: parsed.sheets,
    rows,
    categories: categories.map((c) => ({ id: c.id, name: c.name, defaultBucket: c.defaultBucket })),
  });
});

// --- Confirmación ---------------------------------------------------------------------------

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const decisionSchema = z.object({
  rowHash: z.string().regex(/^[0-9a-f]{64}$/),
  include: z.boolean(),
  date: dateKeySchema.nullish(),
  accountId: z.uuid().nullish(),
  categoryId: z.uuid().nullish(),
  bucket: z.enum(['SAVINGS', 'FIXED', 'FUN']).optional(),
  incomeType: z.enum(['SALARY', 'SCHOLARSHIP', 'PRIZE', 'SALE', 'FREELANCE', 'GIFT', 'REFUND', 'OTHER']).optional(),
});
const decisionsSchema = z.array(decisionSchema).max(1000);

financeImportRouter.post('/finance/import/confirm', receiveFile, async (req, res) => {
  const userId = uid(req);
  let raw: unknown;
  try {
    raw = JSON.parse(String(req.body?.decisions ?? '[]'));
  } catch {
    throw new HttpError(400, 'Decisiones inválidas');
  }
  const decisions = parse(decisionsSchema, raw).filter((d) => d.include);
  if (decisions.length === 0) throw new HttpError(400, 'No elegiste ninguna fila para importar');

  await ensureDefaults(userId);
  const ctx = await loadContext(userId);
  // Se vuelve a leer el archivo: sólo se importa lo que de verdad está capturado en él.
  const parsed = await read(req.file!, ctx.today);
  const byHash = new Map(parsed.rows.map((r) => [r.rowHash, r]));
  const fileHash = createHash('sha256').update(req.file!.buffer).digest('hex');

  // Validación completa antes de escribir nada.
  const plan: { row: ParsedRow; d: z.output<typeof decisionSchema>; date: string | null; status: 'PLANNED' | 'RECEIVED' | null }[] = [];
  for (const d of decisions) {
    const row = byHash.get(d.rowHash);
    if (!row) throw new HttpError(400, 'Una de las filas ya no está en el archivo; vuelve a generar la vista previa');
    const date = row.date ?? d.date ?? null;
    if (row.kind === 'EXPENSE') {
      if (!date) throw new HttpError(400, `Elige la fecha de "${row.name}"`);
      await ownCategory(prisma, userId, d.categoryId);
      await ownAccount(prisma, userId, d.accountId);
      plan.push({ row, d, date, status: null });
    } else {
      const status = incomeStatus(row, date, ctx.today);
      if (status === 'RECEIVED') {
        if (!date) throw new HttpError(400, `Elige la fecha en que recibiste "${row.name}"`);
        if (!d.accountId) throw new HttpError(400, `Elige a qué cuenta entró "${row.name}"`);
      }
      await ownAccount(prisma, userId, d.accountId);
      plan.push({ row, d, date, status });
    }
  }

  const result = await prisma.$transaction(
    async (db) => {
      // Un import a la vez por usuario: dos confirmaciones simultáneas no duplican filas.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`import:${userId}`}))`;
      const done = await importedHashes(db, userId, plan.map((p) => p.row.rowHash));
      const todo = plan.filter((p) => !done.has(p.row.rowHash));
      if (todo.length === 0) return { batchId: null, incomes: 0, expenses: 0, skipped: plan.length };

      const batch = await db.importBatch.create({
        data: { id: randomUUID(), userId, fileName: req.file!.originalname.slice(0, 200), fileHash, status: 'CONFIRMED', confirmedAt: new Date() },
      });
      let incomes = 0;
      let expenses = 0;
      for (const { row, d, date, status } of todo) {
        const importRowId = randomUUID();
        await db.importRow.create({
          data: {
            id: importRowId,
            batchId: batch.id,
            sheet: row.sheet,
            cellRef: row.cellRef,
            rowHash: row.rowHash,
            kind: row.kind,
            data: { name: row.name, amountCents: row.amountCents, date: row.date, chosenDate: date } as Prisma.InputJsonValue,
          },
        });
        if (row.kind === 'INCOME') {
          const income = await db.income.create({
            data: {
              id: randomUUID(),
              userId,
              name: row.name,
              amountCents: row.amountCents,
              type: d.incomeType ?? suggestIncomeType(row.name),
              status: status!,
              expectedOn: status === 'PLANNED' && date ? dateKeyToUtc(date) : null,
              receivedOn: status === 'RECEIVED' ? dateKeyToUtc(date!) : null,
              accountId: d.accountId ?? null,
              importRowId,
              notes: `Importado de ${row.sheet} (${row.cellRef})`,
            },
          });
          await syncIncome(db, income);
          incomes++;
        } else {
          const category = d.categoryId ? await db.financeCategory.findUnique({ where: { id: d.categoryId } }) : null;
          const bucket = d.bucket ?? (category && category.defaultBucket !== 'NONE' ? category.defaultBucket : 'FUN');
          await db.transaction.create({
            data: {
              id: randomUUID(),
              userId,
              kind: 'EXPENSE',
              amountCents: row.amountCents!,
              occurredAt: dateKeyToUtc(date!),
              localDate: dateKeyToUtc(date!),
              concept: row.name,
              accountId: d.accountId ?? null,
              categoryId: category?.id ?? null,
              bucket,
              importRowId,
              notes: `Importado de ${row.sheet} (${row.cellRef})`,
            },
          });
          expenses++;
        }
      }
      return { batchId: batch.id, incomes, expenses, skipped: plan.length - todo.length };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  res.status(result.batchId ? 201 : 200).json(result);
});

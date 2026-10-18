import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import type { BudgetBucket, IncomeType } from '@prisma/client';

/**
 * Lectura del Excel de finanzas. Sólo se toman celdas capturadas a mano: toda celda con fórmula
 * (distribución 70/20/10, totales, "Gasto disponible", total de ahorros) se descarta, porque
 * Ordo la recalcula a partir de los ingresos y gastos y si se importara se contaría dos veces.
 */

export interface ParsedRow {
  kind: 'INCOME' | 'EXPENSE';
  sheet: string;
  cellRef: string;
  name: string;
  /** null = la fila no trae importe (p. ej. un sueldo futuro). */
  amountCents: number | null;
  /** null = el Excel no dice cuándo: la fila es ambigua y se confirma a mano. */
  date: string | null;
  /** Mes de la hoja (AAAA-MM), o null si la hoja no es de un mes. */
  month: string | null;
  rowHash: string;
}

export interface ParsedSheet {
  name: string;
  month: string | null;
  /** Porcentajes del Excel (sólo informativos: la regla vive en Ordo). */
  rule: { savingsBp: number; fixedBp: number; funBp: number } | null;
  /** Celdas con fórmula que no se importan. */
  formulas: number;
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
  rows: ParsedRow[];
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_ABBR = /(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:\s|$)/i;
const ABBR_INDEX: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const pad = (n: number) => String(n).padStart(2, '0');

const isFormula = (c: ExcelJS.Cell) => c.type === ExcelJS.ValueType.Formula || (typeof c.value === 'object' && c.value !== null && ('formula' in c.value || 'sharedFormula' in c.value));

function text(c: ExcelJS.Cell): string | null {
  if (isFormula(c)) return null;
  const v = c.value;
  if (typeof v === 'string') return v.trim() || null;
  if (v && typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('').trim() || null;
  return null;
}

/** Importe en centavos de una celda capturada; null si está vacía o es fórmula. */
function cents(c: ExcelJS.Cell): number | null {
  if (isFormula(c)) return null;
  const v = c.value;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === 'string') {
    const n = Number(v.replace(/[$,\s]/g, ''));
    return v.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

/** Fecha AAAA-MM-DD de una celda (Date de Excel o número de serie). */
function dateOf(c: ExcelJS.Cell): string | null {
  if (isFormula(c)) return null;
  const v = c.value;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return null;
}

const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** "Sueldo 9 oct" → 2026-10-09 (el año lo da la hoja). */
function dateFromName(name: string, year: number): string | null {
  const m = MONTH_ABBR.exec(norm(name));
  if (!m) return null;
  return validDate(year, ABBR_INDEX[m[2]!.slice(0, 3)]!, Number(m[1]));
}

/** Huella estable: hoja + nombre + importe + fecha (la celda puede moverse sin cambiarla). */
export const rowHash = (sheet: string, name: string, amountCents: number | null, date: string | null, occurrence = 0) =>
  createHash('sha256')
    .update([norm(sheet), norm(name), amountCents ?? '', date ?? '', occurrence || ''].join('|'))
    .digest('hex');

interface Table {
  kind: 'INCOME' | 'EXPENSE';
  headerRow: number;
  nameCol: number;
  amountCol: number;
  dateCol: number | null;
}

/** Encuentra las tablas por sus encabezados (Nombre · Entrada / Nombre · Cantidad · Fecha). */
function findTables(ws: ExcelJS.Worksheet): Table[] {
  const tables: Table[] = [];
  ws.eachRow((row, r) => {
    row.eachCell((cell, col) => {
      if (norm(text(cell) ?? '') !== 'nombre') return;
      const next = norm(text(row.getCell(col + 1)) ?? '');
      const after = norm(text(row.getCell(col + 2)) ?? '');
      if (['entrada', 'entradas', 'ingreso', 'ingresos', 'monto'].includes(next)) {
        tables.push({ kind: 'INCOME', headerRow: r, nameCol: col, amountCol: col + 1, dateCol: after === 'fecha' ? col + 2 : null });
      } else if (['cantidad', 'gasto', 'importe'].includes(next)) {
        tables.push({ kind: 'EXPENSE', headerRow: r, nameCol: col, amountCol: col + 1, dateCol: after === 'fecha' ? col + 2 : null });
      }
    });
  });
  return tables;
}

function findRule(ws: ExcelJS.Worksheet): ParsedSheet['rule'] {
  const found: Partial<Record<'savingsBp' | 'fixedBp' | 'funBp', number>> = {};
  const keys: Record<string, 'savingsBp' | 'fixedBp' | 'funBp'> = { ahorro: 'savingsBp', gasto: 'fixedBp', 'gastos fijos': 'fixedBp', gusto: 'funBp', gustos: 'funBp' };
  ws.eachRow((row) =>
    row.eachCell((cell, col) => {
      const key = keys[norm(text(cell) ?? '')];
      const v = row.getCell(col + 1).value;
      if (key && typeof v === 'number' && v > 0 && v <= 1) found[key] = Math.round(v * 10000);
    }),
  );
  return found.savingsBp !== undefined && found.fixedBp !== undefined && found.funBp !== undefined
    ? { savingsBp: found.savingsBp, fixedBp: found.fixedBp, funBp: found.funBp }
    : null;
}

/**
 * Lee el libro y devuelve sólo filas capturadas. `today` (AAAA-MM-DD) da el año cuando la hoja no
 * trae ninguna fecha.
 */
export async function parseWorkbook(buffer: Buffer | ArrayBuffer, today: string): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as ArrayBuffer);
  } catch {
    throw new Error('No es un archivo .xlsx válido');
  }

  // Año del libro: el de las fechas capturadas; si no hay, el actual.
  let year = Number(today.slice(0, 4));
  wb.eachSheet((ws) =>
    ws.eachRow((row) =>
      row.eachCell((c) => {
        const d = dateOf(c);
        if (d && c.numFmt && /[dmy]/i.test(c.numFmt)) year = Number(d.slice(0, 4));
      }),
    ),
  );

  const sheets: ParsedSheet[] = [];
  const rows: ParsedRow[] = [];
  wb.eachSheet((ws) => {
    const mIdx = MONTHS.indexOf(norm(ws.name).split(' ')[0] ?? '');
    const yearInName = /\b(20\d\d)\b/.exec(ws.name);
    const sheetYear = yearInName ? Number(yearInName[1]) : year;
    const month = mIdx >= 0 ? `${sheetYear}-${pad(mIdx + 1)}` : null;
    let formulas = 0;
    ws.eachRow((row) => row.eachCell((c) => void (isFormula(c) && formulas++)));
    sheets.push({ name: ws.name, month, rule: findRule(ws), formulas });
    if (!month) return; // p. ej. "Hoja 2": sólo totales calculados.

    const seen = new Map<string, number>();
    for (const t of findTables(ws)) {
      for (let r = t.headerRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const nameCell = row.getCell(t.nameCol);
        const name = text(nameCell);
        if (!name) continue;
        if (/^total(es)?\b/.test(norm(name))) break;
        const amountCell = row.getCell(t.amountCol);
        if (isFormula(amountCell)) continue; // fila calculada, no capturada
        const amountCents = cents(amountCell);
        const cellDate = t.dateCol ? dateOf(row.getCell(t.dateCol)) : null;
        const date = cellDate ?? (t.kind === 'INCOME' ? dateFromName(name, sheetYear) : null);
        if (t.kind === 'EXPENSE' && amountCents === null) continue; // sin importe no hay gasto
        if (amountCents !== null && amountCents <= 0) continue;
        const base = [t.kind, norm(name), amountCents, date].join('|');
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        rows.push({
          kind: t.kind,
          sheet: ws.name,
          cellRef: nameCell.address,
          name,
          amountCents,
          date,
          month,
          rowHash: rowHash(ws.name, name, amountCents, date, n),
        });
      }
    }
  });
  return { sheets, rows };
}

// --- Sugerencias ---------------------------------------------------------------------

export function suggestIncomeType(name: string): IncomeType {
  const n = norm(name);
  if (/sueldo|salario|nomina|quincena/.test(n)) return 'SALARY';
  if (/beca/.test(n)) return 'SCHOLARSHIP';
  if (/premio|hacka/.test(n)) return 'PRIZE';
  if (/venta|vendi/.test(n)) return 'SALE';
  if (/freelance|proyecto|cliente/.test(n)) return 'FREELANCE';
  if (/regalo/.test(n)) return 'GIFT';
  if (/reembolso|devolucion/.test(n)) return 'REFUND';
  return 'OTHER';
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/noviecit|novia|novio|pareja|cita/, 'Pareja'],
  [/internet|wifi|telmex|izzi|totalplay/, 'Internet'],
  [/deuda|tarjeta|prestamo|credito|abono/, 'Deudas'],
  [/hamburgues|taco|comida|cena|desayuno|super|tienda|oxxo|restaurante|pizza|cafe/, 'Alimentación'],
  [/uber|gasolina|camion|metro|transporte|didi/, 'Transporte'],
  [/\b(luz|agua|gas|renta|telefono|celular)\b/, 'Servicios'],
  [/netflix|spotify|suscrip/, 'Suscripciones'],
  [/doctor|medic|farmacia/, 'Salud'],
  [/escuela|curso|libro|colegiatura/, 'Educación'],
  [/cine|juego|fiesta|salida/, 'Entretenimiento'],
  [/ropa|amazon|compra/, 'Compras'],
];

export function suggestCategory<C extends { id: string; name: string; defaultBucket: BudgetBucket }>(name: string, categories: C[]): C | null {
  const n = norm(name);
  const byName = (want: string) => categories.find((c) => norm(c.name) === norm(want)) ?? null;
  const exact = categories.find((c) => norm(c.name) === n);
  if (exact) return exact;
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(n)) return byName(cat);
  return byName('Otros');
}

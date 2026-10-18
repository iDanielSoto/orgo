import { BUCKET_LABEL, formatMXN, type Bucket, type Split } from '@forma/core';
import { Check } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BUCKET_OPTIONS, Chips, DateRow } from '@/components/forms/finance-log';
import { Capsule, Item, LargeTitle, List, Segmented, Sheet, Switch } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { fk, INCOME_TYPE_LABEL, monthLabel, useAccounts, useRule, type FinCategory, type IncomeType } from '@/lib/finance';
import { cn, fmtShortDate } from '@/lib/format';
import { useAction } from '@/lib/queries';

interface PreviewRow {
  rowHash: string;
  kind: 'INCOME' | 'EXPENSE';
  sheet: string;
  cellRef: string;
  name: string;
  amountCents: number | null;
  date: string | null;
  month: string | null;
  issues: ('NO_DATE' | 'NO_AMOUNT')[];
  alreadyImported: boolean;
  possibleDuplicate: boolean;
  status: 'PLANNED' | 'RECEIVED' | null;
  incomeType: IncomeType | null;
  categoryId: string | null;
  bucket: Bucket | null;
}

interface Preview {
  fileName: string;
  today: string;
  sheets: { name: string; month: string | null; rule: Split | null; formulas: number }[];
  rows: PreviewRow[];
  categories: FinCategory[];
}

interface Decision {
  include: boolean;
  /** Fecha elegida a mano (sólo para filas que el Excel no fecha). */
  date: string;
  /** null = la cuenta general de su tipo. */
  accountId: string | null;
  categoryId: string | null;
  bucket: Bucket;
  incomeType: IncomeType;
}

/** Igual que el servidor: sin importe o en el futuro es previsto; si ya pasó, recibido. */
function statusOf(r: PreviewRow, date: string | null, today: string) {
  if (r.kind !== 'INCOME') return null;
  if (r.amountCents === null) return 'PLANNED' as const;
  if (r.month && r.month > today.slice(0, 7)) return 'PLANNED' as const;
  if (date && date > today) return 'PLANNED' as const;
  return 'RECEIVED' as const;
}

const initialDecisions = (p: Preview) =>
  Object.fromEntries(
    p.rows.map((r) => [
      r.rowHash,
      {
        // Lo ambiguo (sin fecha) o lo que ya parece registrado se confirma a mano.
        include: !r.alreadyImported && !r.possibleDuplicate && !r.issues.includes('NO_DATE'),
        date: '',
        accountId: null,
        categoryId: r.categoryId,
        bucket: r.bucket ?? 'FUN',
        incomeType: r.incomeType ?? 'OTHER',
      } satisfies Decision,
    ]),
  );

export function ImportPage() {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const rule = useRule();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const input = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [dec, setDec] = React.useState<Record<string, Decision>>({});
  const [incomeAccount, setIncomeAccount] = React.useState<string | null>(null);
  const [expenseAccount, setExpenseAccount] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const load = useAction(
    (f: File) => {
      const form = new FormData();
      form.append('file', f);
      return api.upload<Preview>('/finance/import/preview', form);
    },
    {
      invalidate: [],
      onSuccess: (p, f) => {
        setFile(f);
        setPreview(p);
        setDec(initialDecisions(p));
      },
    },
  );

  const today = preview?.today ?? '';
  const view = (preview?.rows ?? []).map((r) => {
    const d = dec[r.rowHash]!;
    const date = r.date ?? (d.date || null);
    const status = statusOf(r, date, today);
    const accountId = d.accountId ?? (r.kind === 'INCOME' ? incomeAccount : expenseAccount);
    const problem = !d.include
      ? null
      : !date && (r.kind === 'EXPENSE' || status === 'RECEIVED')
        ? 'Elige la fecha'
        : status === 'RECEIVED' && !accountId
          ? 'Elige la cuenta'
          : null;
    return { r, d, date, status, accountId, problem };
  });
  const chosen = view.filter((v) => v.d.include && !v.r.alreadyImported);
  const pending = chosen.filter((v) => v.problem).length;

  const commit = useAction(
    () => {
      const form = new FormData();
      form.append(
        'decisions',
        JSON.stringify(
          chosen.map((v) => ({
            rowHash: v.r.rowHash,
            include: true,
            date: v.date,
            accountId: v.accountId,
            categoryId: v.r.kind === 'EXPENSE' ? v.d.categoryId : null,
            bucket: v.r.kind === 'EXPENSE' ? v.d.bucket : undefined,
            incomeType: v.r.kind === 'INCOME' ? v.d.incomeType : undefined,
          })),
        ),
      );
      form.append('file', file!);
      return api.upload<{ incomes: number; expenses: number; skipped: number }>('/finance/import/confirm', form);
    },
    {
      invalidate: [fk.all],
      onSuccess: (res) => {
        const parts = [res.incomes && `${res.incomes} ingresos`, res.expenses && `${res.expenses} gastos`].filter(Boolean);
        toast.success(parts.length ? `Importados ${parts.join(' y ')}` : 'Todo estaba importado');
        navigate('/finanzas');
      },
    },
  );

  const set = (hash: string, patch: Partial<Decision>) => setDec((m) => ({ ...m, [hash]: { ...m[hash]!, ...patch } }));
  const formulas = preview?.sheets.reduce((s, x) => s + x.formulas, 0) ?? 0;
  const excelRule = preview?.sheets.find((s) => s.rule)?.rule;
  const ruleDiffers =
    excelRule && rule.data && (excelRule.savingsBp !== rule.data.current.savingsBp || excelRule.fixedBp !== rule.data.current.fixedBp || excelRule.funBp !== rule.data.current.funBp);
  const needsIncomeAccount = view.some((v) => v.d.include && v.status === 'RECEIVED');

  // Grupos por hoja y tipo, en el orden del archivo.
  const groups: { key: string; title: string; items: typeof view }[] = [];
  for (const v of view) {
    const key = `${v.r.sheet}·${v.r.kind}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, title: `${v.r.month ? monthLabel(v.r.month) : v.r.sheet} · ${v.r.kind === 'INCOME' ? 'Ingresos' : 'Gastos'}`, items: [] };
      groups.push(g);
    }
    g.items.push(v);
  }

  const edit = view.find((v) => v.r.rowHash === editing);
  const sum = (xs: typeof view) => xs.reduce((s, v) => s + (v.r.amountCents ?? 0), 0);
  const received = chosen.filter((v) => v.status === 'RECEIVED');
  const planned = chosen.filter((v) => v.status === 'PLANNED');
  const spent = chosen.filter((v) => v.r.kind === 'EXPENSE');

  return (
    <div className="space-y-8">
      <LargeTitle text="Importar" />
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) load.mutate(f);
        }}
      />

      {!preview ? (
        <div className="py-6 text-center">
          <p className="text-[19px]">Tu Excel de finanzas</p>
          <p className="mx-auto mt-1 max-w-[30ch] text-ink-2">Revisas cada fila antes de que se guarde algo.</p>
          <div className="mt-6 flex justify-center">
            <Capsule onClick={() => input.current?.click()} disabled={load.isPending}>
              {load.isPending ? 'Leyendo…' : 'Elegir archivo .xlsx'}
            </Capsule>
          </div>
        </div>
      ) : (
        <>
          <section className="-mt-4">
            <button onClick={() => input.current?.click()} className="press text-left">
              <p className="text-[17px] font-semibold">{preview.fileName}</p>
              <p className="text-[15px] text-ink-2">
                {formulas} fórmulas no se importan: Ordo calcula la distribución y el ahorro.
                {ruleDiffers && ` El Excel usa ${excelRule!.savingsBp / 100}/${excelRule!.fixedBp / 100}/${excelRule!.funBp / 100}; se aplicará tu regla de Ordo.`}
              </p>
            </button>
          </section>

          {needsIncomeAccount &&
            (active.length === 0 ? (
              <List>
                <Item label="Agrega la cuenta donde recibes tus ingresos" onClick={() => navigate('/finanzas/cuentas')} />
              </List>
            ) : (
              <section>
                <h2 className="mb-2 ml-1 text-[13px] uppercase tracking-wide text-ink-3">Los ingresos recibidos entran a</h2>
                <Chips value={incomeAccount} onChange={setIncomeAccount} options={active.map((a) => ({ value: a.id, label: a.name }))} />
              </section>
            ))}
          {active.length > 0 && view.some((v) => v.r.kind === 'EXPENSE' && v.d.include) && (
            <section>
              <h2 className="mb-2 ml-1 text-[13px] uppercase tracking-wide text-ink-3">Los gastos salieron de</h2>
              <Chips
                value={expenseAccount ?? ''}
                onChange={(v) => setExpenseAccount(v || null)}
                options={[{ value: '', label: 'Sin cuenta' }, ...active.map((a) => ({ value: a.id, label: a.name }))]}
              />
            </section>
          )}

          {groups.map((g) => (
            <List key={g.key} header={g.title}>
              {g.items.map((v) => (
                <RowItem
                  key={v.r.rowHash}
                  v={v}
                  category={preview.categories.find((c) => c.id === v.d.categoryId)?.name}
                  onToggle={() => set(v.r.rowHash, { include: !v.d.include })}
                  onOpen={() => setEditing(v.r.rowHash)}
                />
              ))}
            </List>
          ))}

          <div className="space-y-3 pb-4">
            <button
              onClick={() => setConfirming(true)}
              disabled={chosen.length === 0 || pending > 0}
              className="press h-12 w-full rounded-full bg-tint text-[17px] font-semibold text-[#06102a] disabled:opacity-35"
            >
              {pending > 0 ? `Completa ${pending} ${pending === 1 ? 'fila' : 'filas'}` : chosen.length === 0 ? 'Nada por importar' : `Importar ${chosen.length}`}
            </button>
          </div>
        </>
      )}

      {preview && edit && (
        <Sheet open onOpenChange={(o) => !o && setEditing(null)} title={edit.r.kind === 'INCOME' ? 'Ingreso' : 'Gasto'} onDone={() => setEditing(null)} doneLabel="Listo">
          <div className="text-center">
            <p className="text-[44px] font-semibold leading-none tracking-[-0.03em] tabular">{edit.r.amountCents !== null ? formatMXN(edit.r.amountCents) : 'Sin importe'}</p>
            <p className="mt-2 text-[17px] text-ink-2">{edit.r.name}</p>
          </div>
          <List>
            <Switch label={edit.r.alreadyImported ? 'Ya importado' : 'Importar'} checked={edit.d.include && !edit.r.alreadyImported} onChange={(v) => !edit.r.alreadyImported && set(edit.r.rowHash, { include: v })} />
            {edit.r.date ? (
              <Item label="Fecha" detail={fmtShortDate(edit.r.date)} />
            ) : (
              <DateRow label={edit.status === 'PLANNED' ? 'Fecha esperada' : 'Fecha'} value={edit.d.date} onChange={(d) => set(edit.r.rowHash, { date: d, include: d ? true : edit.d.include })} />
            )}
            {edit.status && <Item label="Estado" detail={edit.status === 'RECEIVED' ? 'Recibido' : 'Previsto'} />}
          </List>
          {edit.r.kind === 'INCOME' ? (
            <>
              <Chips
                value={edit.d.incomeType}
                onChange={(t) => set(edit.r.rowHash, { incomeType: t })}
                options={(Object.keys(INCOME_TYPE_LABEL) as IncomeType[]).map((t) => ({ value: t, label: INCOME_TYPE_LABEL[t] }))}
              />
              {active.length > 0 && (
                <Chips value={edit.accountId} onChange={(id) => set(edit.r.rowHash, { accountId: id })} options={active.map((a) => ({ value: a.id, label: a.name }))} />
              )}
            </>
          ) : (
            <>
              <Segmented value={edit.d.bucket} onChange={(b) => set(edit.r.rowHash, { bucket: b })} options={BUCKET_OPTIONS} />
              <Chips
                value={edit.d.categoryId}
                onChange={(id) => {
                  const c = preview.categories.find((x) => x.id === id);
                  set(edit.r.rowHash, { categoryId: id, ...(c && c.defaultBucket !== 'NONE' ? { bucket: c.defaultBucket } : {}) });
                }}
                options={preview.categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              {active.length > 0 && (
                <Chips
                  value={edit.accountId ?? ''}
                  onChange={(id) => set(edit.r.rowHash, { accountId: id || null })}
                  options={[{ value: '', label: 'Sin cuenta' }, ...active.map((a) => ({ value: a.id, label: a.name }))]}
                />
              )}
            </>
          )}
        </Sheet>
      )}

      {confirming && (
        <Sheet
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title="Importar"
          doneLabel={commit.isPending ? 'Importando…' : 'Importar'}
          doneDisabled={commit.isPending}
          onDone={() => commit.mutate(undefined)}
        >
          <List>
            {received.length > 0 && <Item label={`${received.length} ingresos recibidos`} detail={formatMXN(sum(received))} />}
            {planned.length > 0 && <Item label={`${planned.length} ingresos previstos`} detail={formatMXN(sum(planned))} />}
            {spent.length > 0 && <Item label={`${spent.length} gastos`} detail={formatMXN(sum(spent))} />}
          </List>
          {spent.length > 0 && (
            <List>
              {(['FIXED', 'FUN', 'SAVINGS'] as Bucket[]).map((b) => {
                const xs = spent.filter((v) => v.d.bucket === b);
                return xs.length ? <Item key={b} label={BUCKET_LABEL[b]} detail={formatMXN(sum(xs))} /> : null;
              })}
            </List>
          )}
        </Sheet>
      )}
    </div>
  );
}

function RowItem({
  v,
  category,
  onToggle,
  onOpen,
}: {
  v: { r: PreviewRow; d: Decision; date: string | null; status: 'PLANNED' | 'RECEIVED' | null; problem: string | null };
  category?: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { r, d } = v;
  const on = d.include && !r.alreadyImported;
  const sub = r.alreadyImported
    ? 'Ya importado'
    : v.problem
      ? v.problem
      : [v.date ? fmtShortDate(v.date) : 'Sin fecha', r.kind === 'INCOME' ? (v.status === 'RECEIVED' ? 'recibido' : 'previsto') : category, !d.include && r.possibleDuplicate && 'parece ya registrado']
          .filter(Boolean)
          .join(' · ');
  return (
    <div className={cn('flex min-h-[60px] items-center gap-3 pl-4 pr-5', r.alreadyImported && 'opacity-45')}>
      <button
        aria-label={on ? `No importar ${r.name}` : `Importar ${r.name}`}
        aria-pressed={on}
        disabled={r.alreadyImported}
        onClick={onToggle}
        className={cn('press grid size-7 shrink-0 place-items-center rounded-full border-[1.5px]', on ? 'border-tint bg-tint text-[#06102a]' : 'border-white/30')}
      >
        {on && <Check className="size-4" strokeWidth={3} />}
      </button>
      <button onClick={onOpen} className="flex flex-1 items-center gap-3 py-2.5 text-left">
        <span className="flex-1">
          <span className="block text-[17px] leading-tight">{r.name}</span>
          <span className={cn('block text-[13px]', v.problem && !r.alreadyImported ? 'text-star' : 'text-ink-3')}>{sub}</span>
        </span>
        <span className={cn('text-[17px] tabular', r.kind === 'INCOME' ? 'text-green' : 'text-ink', r.amountCents === null && 'text-ink-3')}>
          {r.amountCents === null ? 'sin importe' : `${r.kind === 'INCOME' ? '+' : '−'}${formatMXN(r.amountCents)}`}
        </span>
      </button>
    </div>
  );
}

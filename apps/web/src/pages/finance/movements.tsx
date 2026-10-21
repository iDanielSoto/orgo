import { BUCKET_LABEL, formatMXN } from '@forma/core';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import * as React from 'react';
import { useSearchParams } from 'react-router';
import { CategoryBadge } from '@/components/category-icon';
import { useFin } from '@/components/forms/finance-log';
import { Item, LargeTitle, List, Segmented } from '@/components/ui/ios';
import { capitalize, fmtDate } from '@/lib/format';
import { INCOME_TYPE_LABEL, monthLabel, shiftMonth, todayKey, useIncomes, useTxs, type FinTx } from '@/lib/finance';
import { TxAmount } from './home';

type View = 'todo' | 'gastos' | 'ingresos';

export function MovementsPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('ver') as View) || 'todo';
  const [month, setMonth] = React.useState(todayKey().slice(0, 7));
  const [q, setQ] = React.useState('');
  const fin = useFin();
  const txs = useTxs(month, view === 'gastos' ? 'EXPENSE' : view === 'ingresos' ? 'INCOME' : undefined, q || undefined);
  const incomes = useIncomes();

  // Agrupar por día.
  const days = React.useMemo(() => {
    const map = new Map<string, FinTx[]>();
    for (const t of txs.data ?? []) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()];
  }, [txs.data]);

  const planned = (incomes.data ?? []).filter((i) => i.status === 'PLANNED' && (!i.expectedOn || i.expectedOn.startsWith(month)));

  return (
    <div className="space-y-6">
      <LargeTitle text="Movimientos" />
      <div className="-mt-6 flex items-center gap-1 text-[17px] text-ink-2">
        <button aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))} className="press -ml-2 p-2">
          <ChevronLeft className="size-5" />
        </button>
        <span>{monthLabel(month)}</span>
        <button aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(month, 1))} className="press p-2">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <Segmented
        value={view}
        onChange={(v) => setParams(v === 'todo' ? {} : { ver: v }, { replace: true })}
        options={[
          { value: 'todo', label: 'Todo' },
          { value: 'gastos', label: 'Gastos' },
          { value: 'ingresos', label: 'Ingresos' },
        ]}
      />

      <label className="glass flex h-11 items-center gap-2 rounded-full px-4">
        <Search className="size-4 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full bg-transparent text-[16px] text-ink placeholder:text-ink-3 focus:outline-none" />
      </label>

      {view !== 'gastos' && planned.length > 0 && (
        <List header="Previstos">
          {planned.map((i) => (
            <Item
              key={i.id}
              label={i.name}
              detail={`${i.amountCents !== null ? formatMXN(i.amountCents) : 'sin importe'}${i.expectedOn ? ` · ${fmtDate(i.expectedOn, 'd MMM')}` : ''}`}
              onClick={() => fin({ kind: 'income', edit: i, receive: true })}
            />
          ))}
        </List>
      )}

      {days.length === 0 && !txs.isPending && <p className="py-10 text-center text-ink-2">Sin movimientos en este mes.</p>}

      {days.map(([day, list]) => {
        const spent = list.filter((t) => t.kind === 'EXPENSE').reduce((s, t) => s + t.amountCents, 0);
        return (
          <List key={day} header={`${capitalize(fmtDate(day, "EEEE d"))}${spent ? ` · ${formatMXN(spent)}` : ''}`}>
            {list.map((t) => (
              <Item
                key={t.id}
                label={
                  <span className="flex items-center gap-3">
                    <CategoryBadge name={t.category} kind={t.kind} size={36} />
                    <span className="min-w-0">
                    {t.concept}
                    <span className="block text-[13px] text-ink-3">
                      {t.kind === 'EXPENSE'
                        ? [t.category, t.bucket !== 'NONE' ? BUCKET_LABEL[t.bucket] : null].filter(Boolean).join(' · ')
                        : t.kind === 'INCOME'
                          ? 'Ingreso'
                          : t.kind === 'TRANSFER'
                            ? 'Transferencia'
                            : 'Ajuste'}
                    </span>
                    </span>
                  </span>
                }
                detail={<TxAmount t={t} />}
                onClick={
                  t.kind === 'EXPENSE'
                    ? () => fin({ kind: 'expense', edit: t })
                    : t.incomeId
                      ? () => {
                          const inc = incomes.data?.find((i) => i.id === t.incomeId);
                          if (inc) fin({ kind: 'income', edit: inc });
                        }
                      : undefined
                }
              />
            ))}
          </List>
        );
      })}

      {view === 'ingresos' && (incomes.data ?? []).some((i) => i.status === 'CANCELLED') && (
        <List header="Cancelados">
          {incomes.data!
            .filter((i) => i.status === 'CANCELLED')
            .map((i) => (
              <Item key={i.id} label={i.name} detail={INCOME_TYPE_LABEL[i.type]} />
            ))}
        </List>
      )}
    </div>
  );
}

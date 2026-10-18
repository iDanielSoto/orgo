import * as React from 'react';
import { BackButton } from '@/pages/activity';
import { Capsule, Item, LargeTitle, List } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { fk, todayKey, useRule } from '@/lib/finance';
import { useAction } from '@/lib/queries';

/** Porcentajes de distribución. Un cambio aplica desde la fecha elegida; lo anterior no se toca. */
export function BudgetRulePage() {
  const rule = useRule();
  const [vals, setVals] = React.useState<{ savings: string; fixed: string; fun: string } | null>(null);
  const [from, setFrom] = React.useState(todayKey().slice(0, 7) + '-01');
  React.useEffect(() => {
    if (rule.data && !vals) {
      const c = rule.data.current;
      setVals({ savings: String(c.savingsBp / 100), fixed: String(c.fixedBp / 100), fun: String(c.funBp / 100) });
    }
  }, [rule.data, vals]);
  const bp = (s: string) => Math.round(Number(s.replace(',', '.') || 0) * 100);
  const sum = vals ? bp(vals.savings) + bp(vals.fixed) + bp(vals.fun) : 0;
  const save = useAction(
    () => api.put('/finance/rule', { savingsBp: bp(vals!.savings), fixedBp: bp(vals!.fixed), funBp: bp(vals!.fun), effectiveFrom: from }),
    { success: 'Porcentajes guardados', invalidate: [fk.all] },
  );

  return (
    <div className="space-y-8">
      <div>
        <BackButton />
        <LargeTitle text="Presupuesto" />
      </div>
      {vals && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['savings', 'Ahorro'],
                ['fixed', 'Gastos fijos'],
                ['fun', 'Gustos'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="glass rounded-[22px] px-4 py-3">
                <span className="block text-[13px] text-ink-2">{label}</span>
                <span className="flex items-baseline">
                  <input
                    inputMode="decimal"
                    value={vals[k]}
                    onChange={(e) => setVals({ ...vals, [k]: e.target.value.replace(/[^\d.,]/g, '') })}
                    className="w-full bg-transparent text-[32px] font-semibold tracking-[-0.03em] text-ink focus:outline-none"
                  />
                  <span className="text-ink-2">%</span>
                </span>
              </label>
            ))}
          </div>
          <p className={sum === 10000 ? 'text-ink-2' : 'text-red'}>Suma: {sum / 100} %</p>
          <List>
            <label className="flex min-h-[52px] items-center gap-3 px-5 py-2">
              <span className="flex-1 text-[17px]">Aplicar desde</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-[10px] bg-white/[0.1] px-3 py-1.5 text-[17px] text-ink" />
            </label>
          </List>
          <div className="flex justify-center">
            <Capsule onClick={() => save.mutate(undefined)} disabled={sum !== 10000 || save.isPending} className="disabled:opacity-40">
              Guardar
            </Capsule>
          </div>
        </>
      )}
      {rule.data && rule.data.history.length > 0 && (
        <List header="Historial">
          {rule.data.history.map((r, i) => (
            <Item
              key={i}
              label={r.effectiveFrom <= '2000-01-01' ? 'Desde el inicio' : `Desde ${fmtDate(r.effectiveFrom, "d 'de' MMM yyyy")}`}
              detail={`${r.savingsBp / 100}/${r.fixedBp / 100}/${r.funBp / 100}`}
            />
          ))}
        </List>
      )}
    </div>
  );
}

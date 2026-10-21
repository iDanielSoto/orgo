import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import * as React from 'react';
import { useLog } from '@/components/forms/log';
import { BackButton, BigNumber, Capsule, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { capitalize, fmtDate, fmtKg, fmtNum, fmtSignedKg } from '@/lib/format';
import { useAction, useBodySummary, useMeasurements } from '@/lib/queries';

export function BodyPage() {
  const summary = useBodySummary();
  const list = useMeasurements();
  const log = useLog();
  const [goal, setGoal] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  const s = summary.data;
  const del = useAction((id: string) => api.del(`/measurements/${id}`), { success: 'Eliminado' });

  return (
    <div>
      <BackButton fallback="/salud" />
      <LargeTitle text="Cuerpo" />

      <div className="text-center">
        <p className="text-[76px] font-semibold leading-none tracking-[-0.05em] tabular">
          {s?.latest ? fmtNum(s.latest.weightKg) : '—'}
          {s?.latest && <span className="ml-1 text-[26px] text-ink-2">kg</span>}
        </p>
        {s?.latest && <p className="mt-3 text-[17px] text-ink-2">{fmtSignedKg(s.changeFromStartKg)} desde el inicio</p>}
      </div>

      {s && s.series.length > 1 && (
        <div className="mt-8 h-40" role="img" aria-label="Evolución del peso">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={s.series} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <YAxis hide domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <Line type="monotone" dataKey="avg7" stroke="var(--tint)" strokeWidth={3} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <Capsule onClick={() => log({ kind: 'weight' })}>Registrar peso</Capsule>
      </div>

      {s && (
        <div className="mt-10">
          <List>
            <Item label="Meta" detail={fmtKg(s.targetKg)} onClick={() => setGoal(true)} />
            <Item label="Historial" detail={list.data?.length ? String(list.data.length) : undefined} onClick={() => setHistory(true)} />
          </List>
        </div>
      )}

      {s && <GoalSheet open={goal} onOpenChange={setGoal} current={s.targetKg} />}
      <Sheet open={history} onOpenChange={setHistory} title="Historial">
        {list.data?.length ? (
          <List>
            {list.data.map((m) => (
              <Item
                key={m.id}
                label={capitalize(fmtDate(m.date, "EEE d 'de' MMM"))}
                detail={m.weightKg !== null ? fmtKg(m.weightKg) : `${fmtNum(m.waistCm ?? 0)} cm`}
                onClick={() => confirm('¿Eliminar este registro?') && del.mutate(m.id)}
              />
            ))}
          </List>
        ) : (
          <p className="py-8 text-center text-ink-2">Aún no hay registros.</p>
        )}
      </Sheet>
    </div>
  );
}

function GoalSheet({ open, onOpenChange, current }: { open: boolean; onOpenChange: (o: boolean) => void; current: number }) {
  const [v, setV] = React.useState(String(current));
  React.useEffect(() => {
    if (open) setV(String(current));
  }, [open, current]);
  const n = Number(v);
  const save = useAction(() => api.patch('/profile', { targetWeightKg: n }), { success: 'Meta guardada', onSuccess: () => onOpenChange(false) });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Meta" onDone={() => save.mutate(undefined)} doneDisabled={!(n >= 30 && n <= 350) || save.isPending}>
      <BigNumber value={v} onChange={setV} unit="kg" decimal />
    </Sheet>
  );
}

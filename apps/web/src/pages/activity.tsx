import * as React from 'react';
import { useLog } from '@/components/forms/log';
import { Capsule, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { Hero } from '@/components/zone';
import { capitalize, cn, fmtDate } from '@/lib/format';
import { useActivity, useActivityPlan } from '@/lib/queries';
import type { ActivityPlan } from '@/lib/types';

type Exercise = ActivityPlan['templates'][number]['exercises'][number];

const trains = (k: string) => k === 'STRENGTH' || k === 'WALK_MOBILITY';

/** Zona Ejercicio: la semana, la rutina de hoy y tus últimas sesiones. */
export function ExercisePage() {
  const plan = useActivityPlan();
  const history = useActivity(30);
  const log = useLog();
  const [ex, setEx] = React.useState<Exercise | null>(null);
  const p = plan.data;
  if (!p) return <LargeTitle text="Ejercicio" />;
  const routine = p.templates.find((t) => t.code === p.today.routine);
  const reps = (e: Exercise) => `${Math.min(e.sets, p.level.setsMax)} × ${e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}`;
  const planned = p.week.filter((d) => trains(d.kind));
  const done = p.week.filter((d) => d.done).length;
  const doneToday = p.week.find((d) => d.date === p.date)?.done ?? false;

  return (
    <div>
      <LargeTitle text="Ejercicio" />

      <Hero value={done} unit={`de ${planned.length}`} sub="sesiones esta semana" tone={planned.length > 0 && done >= planned.length ? 'green' : undefined} />

      <ol className="mt-8 grid grid-cols-7">
        {p.week.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-2">
            <span className={cn('text-[12px] font-medium', d.date === p.date ? 'text-tint' : 'text-ink-3')}>{fmtDate(d.date, 'EEEEE').toUpperCase()}</span>
            <span
              className={cn(
                'grid size-10 place-items-center rounded-full text-[15px] font-semibold',
                d.done ? 'bg-green text-[#04210d]' : trains(d.kind) ? 'glass' : 'text-ink-3',
                d.date === p.date && !d.done && 'ring-2 ring-tint',
              )}
            >
              {d.done ? '✓' : (d.routine ?? (d.kind === 'WALK_MOBILITY' ? 'C' : '·'))}
            </span>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-[22px] font-bold tracking-[-0.02em]">{p.today.label}</h2>
      <div className="mt-3">
        {routine && (
          <List>
            {routine.exercises.map((e) => (
              <Item key={e.name} label={e.name} detail={reps(e)} onClick={() => setEx(e)} />
            ))}
          </List>
        )}
        {p.today.kind === 'WALK_MOBILITY' && (
          <List>
            <Item label="Caminata" detail={`${p.level.walkMinutesMin}–${p.level.walkMinutesMax} min`} />
          </List>
        )}
        {!trains(p.today.kind) && <p className="text-[17px] text-ink-2">Recuperarse también cuenta.</p>}
      </div>

      {trains(p.today.kind) && (
        <div className="mt-6 flex justify-center">
          {doneToday ? (
            <p className="text-[17px] font-semibold text-green">Hecho hoy</p>
          ) : (
            <Capsule className="bg-tint text-[#06102a]" onClick={() => log({ kind: 'activity', routine: p.today.routine ?? 'WALK' })}>
              Ya lo hice
            </Capsule>
          )}
        </div>
      )}

      {history.data && history.data.length > 0 && (
        <div className="mt-12">
          <List header="Últimas sesiones">
            {history.data.slice(0, 10).map((s) => (
              <Item
                key={s.id}
                label={s.kind === 'WALK' ? 'Caminata' : `Fuerza ${s.routineCode ?? ''}`.trim()}
                detail={`${capitalize(fmtDate(s.date, 'EEE d'))}${s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}`}
              />
            ))}
          </List>
        </div>
      )}

      <Sheet open={ex !== null} onOpenChange={(o) => !o && setEx(null)} title={ex?.name ?? ''}>
        {ex && (
          <>
            <p className="text-center text-[40px] font-semibold tracking-[-0.03em] tabular">{reps(ex)}</p>
            <ol className="space-y-4 px-1">
              {ex.instructions.map((s, i) => (
                <li key={s} className="flex gap-4 text-[17px] leading-snug">
                  <span className="font-semibold text-tint tabular">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </>
        )}
      </Sheet>
    </div>
  );
}

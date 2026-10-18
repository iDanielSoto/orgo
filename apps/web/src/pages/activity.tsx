import { ChevronLeft } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { useLog } from '@/components/forms/log';
import { Capsule, GlassCircle, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { cn, fmtDate } from '@/lib/format';
import { useActivityPlan } from '@/lib/queries';
import type { ActivityPlan } from '@/lib/types';

type Exercise = ActivityPlan['templates'][number]['exercises'][number];

export function BackButton() {
  const navigate = useNavigate();
  return (
    <GlassCircle aria-label="Atrás" onClick={() => navigate(-1)} className="mb-2">
      <ChevronLeft className="-ml-0.5" />
    </GlassCircle>
  );
}

export function ActivityPage() {
  const plan = useActivityPlan();
  const log = useLog();
  const [ex, setEx] = React.useState<Exercise | null>(null);
  const p = plan.data;
  if (!p) return <BackButton />;
  const routine = p.templates.find((t) => t.code === p.today.routine);
  const reps = (e: Exercise) => `${Math.min(e.sets, p.level.setsMax)} × ${e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}`;

  return (
    <div>
      <BackButton />
      <LargeTitle text={p.today.label} />

      <ol className="mb-10 flex justify-between">
        {p.week.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-2">
            <span className="text-[13px] text-ink-3">{fmtDate(d.date, 'EEEEE').toUpperCase()}</span>
            <span className={cn('glass grid size-10 place-items-center rounded-full text-[15px] font-semibold', d.done && 'text-green', d.date === p.date && 'text-tint')}>
              {d.done ? '✓' : (d.routine ?? (d.kind === 'WALK_MOBILITY' ? 'C' : '·'))}
            </span>
          </li>
        ))}
      </ol>

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

      {(p.today.kind === 'STRENGTH' || p.today.kind === 'WALK_MOBILITY') && (
        <div className="mt-10 flex justify-center">
          <Capsule onClick={() => log({ kind: 'activity', routine: p.today.routine ?? 'WALK' })}>Ya lo hice</Capsule>
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

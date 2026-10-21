import { Check, Plus } from 'lucide-react';
import * as React from 'react';
import { BackButton, GlassCircle, Item, LargeTitle, List, Segmented, Sheet, TextItem } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { useAction, useHabits } from '@/lib/queries';
import type { Habit } from '@/lib/types';

export function HabitsPage() {
  const habits = useHabits();
  const [editing, setEditing] = React.useState<Habit | 'new' | null>(null);
  return (
    <div>
      <BackButton fallback="/salud" />
      <LargeTitle
        text="Hábitos"
        trailing={
          <GlassCircle aria-label="Nuevo hábito" onClick={() => setEditing('new')}>
            <Plus />
          </GlassCircle>
        }
      />
      {habits.data && (
        <List>
          {habits.data.map((h) => (
            <HabitRow key={h.id} habit={h} onEdit={() => setEditing(h)} />
          ))}
        </List>
      )}
      {habits.isError && <p className="text-red">No se pudo cargar.</p>}
      <HabitSheet habit={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** Como en Recordatorios: círculo vacío o lleno. */
function HabitRow({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const date = habit.week.at(-1)!.date;
  const met = habit.today.status === 'met';
  const auto = met && !habit.today.manual;
  const na = habit.today.status === 'na';
  const toggle = useAction(
    () => (habit.today.manual ? api.del(`/habits/${habit.id}/complete?date=${date}`) : api.post(`/habits/${habit.id}/complete`, { date })),
    { invalidate: [['habits'], ['today']] },
  );
  return (
    <div className="flex min-h-[56px] items-center gap-4 px-5 py-2.5">
      <button
        onClick={() => toggle.mutate(undefined)}
        disabled={toggle.isPending || auto}
        aria-pressed={met}
        aria-label={habit.name}
        className={cn('press grid size-[26px] shrink-0 place-items-center rounded-full border-2', met ? 'border-tint bg-tint text-[#06102a]' : 'border-ink-3', na && 'opacity-40')}
      >
        {met && <Check className="size-4" strokeWidth={3.2} />}
      </button>
      <button onClick={onEdit} className={cn('flex-1 text-left text-[17px] leading-snug', (met || na) && 'text-ink-2')}>
        {habit.name}
      </button>
    </div>
  );
}

function HabitSheet({ habit, onClose }: { habit: Habit | 'new' | null; onClose: () => void }) {
  const current = habit && habit !== 'new' ? habit : null;
  const [name, setName] = React.useState('');
  const [frequency, setFrequency] = React.useState<'DAILY' | 'WEEKLY'>('DAILY');
  React.useEffect(() => {
    setName(current?.name ?? '');
    setFrequency(current?.frequency ?? 'DAILY');
  }, [habit]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction(
    () => (current ? api.patch(`/habits/${current.id}`, { name: name.trim(), frequency }) : api.post('/habits', { name: name.trim(), frequency, autoRule: 'NONE' })),
    { success: 'Hábito guardado', invalidate: [['habits'], ['today']], onSuccess: onClose },
  );
  const archive = useAction(() => api.post(`/habits/${current!.id}/archive`), { success: 'Hábito archivado', invalidate: [['habits'], ['today']], onSuccess: onClose });
  return (
    <Sheet
      open={habit !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? 'Hábito' : 'Nuevo hábito'}
      onDone={() => save.mutate(undefined)}
      doneDisabled={!name.trim() || save.isPending}
    >
      <List>
        <TextItem autoFocus={!current} placeholder="Nombre" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </List>
      <Segmented value={frequency} onChange={setFrequency} options={[{ value: 'DAILY', label: 'Cada día' }, { value: 'WEEKLY', label: 'Cada semana' }]} />
      {current && (
        <List>
          <Item label="Archivar" destructive onClick={() => archive.mutate(undefined)} />
        </List>
      )}
    </Sheet>
  );
}

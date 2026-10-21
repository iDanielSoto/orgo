import { MEAL_LABEL, type MealType } from '@forma/core';
import { Plus } from 'lucide-react';
import { useLog } from '@/components/forms/log';
import { LargeTitle, List } from '@/components/ui/ios';
import { Hero, WEEKDAYS, weekOf } from '@/components/zone';
import { cn, fmtTime } from '@/lib/format';
import { useMeals, useMealsDays, useToday } from '@/lib/queries';
import type { Meal } from '@/lib/types';

const MAIN: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];

/** Zona Alimentación: las comidas de hoy y cómo va la semana. */
export function FoodPage() {
  const today = useToday();
  const meals = useMeals();
  const week = useMealsDays(7);
  const log = useLog();
  const t = today.data;
  const list = meals.data ?? [];
  const logged = MAIN.filter((m) => list.some((x) => x.type === m)).length;
  const protein = list.filter((m) => m.proteinSource).length;

  return (
    <div>
      <LargeTitle text="Alimentación" />

      <Hero value={logged} unit="de 3" sub={list.length ? `comidas hoy · ${protein} con proteína` : 'comidas hoy'} tone={logged === 3 ? 'green' : undefined} />

      <div className="mt-10">
        <List>
          {MAIN.map((type) => {
            const found = list.filter((m) => m.type === type);
            return found.length ? (
              found.map((m) => <MealRow key={m.id} meal={m} onClick={() => log({ kind: 'meal', edit: m })} />)
            ) : (
              <button key={type} onClick={() => log({ kind: 'meal', type })} className="flex min-h-[60px] w-full items-center gap-3 px-5 py-3 text-left active:bg-white/[0.06]">
                <span className="flex-1 text-[17px] text-ink-2">{MEAL_LABEL[type]}</span>
                <span className="grid size-8 place-items-center rounded-full bg-tint text-[#06102a]">
                  <Plus className="size-5" strokeWidth={2.6} />
                </span>
              </button>
            );
          })}
          {list
            .filter((m) => m.type === 'SNACK')
            .map((m) => (
              <MealRow key={m.id} meal={m} onClick={() => log({ kind: 'meal', edit: m })} />
            ))}
        </List>
      </div>

      {t && <WeekMeals today={t.date} meals={week.data ?? []} />}
    </div>
  );
}

function MealRow({ meal, onClick }: { meal: Meal; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 px-5 py-3 text-left active:bg-white/[0.06]">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ink-3">
          {MEAL_LABEL[meal.type]} · {fmtTime(meal.eatenAt)}
        </span>
        <span className="block truncate text-[17px]">{meal.description}</span>
      </span>
      {meal.proteinSource && <span className="size-2.5 shrink-0 rounded-full bg-tint" aria-label="Con proteína" />}
    </button>
  );
}

/** Desayuno, comida y cena de cada día de la semana: un punto por comida. */
function WeekMeals({ today, meals }: { today: string; meals: Meal[] }) {
  const days = weekOf(today);
  return (
    <section className="mt-12">
      <h2 className="text-[22px] font-bold tracking-[-0.02em]">Esta semana</h2>
      <div className="glass mt-3 grid grid-cols-7 rounded-[26px] px-3 py-4">
        {days.map((d, i) => (
          <div key={d} className={cn('flex flex-col items-center gap-2', d > today && 'opacity-30')}>
            <span className={cn('text-[12px] font-medium', d === today ? 'text-tint' : 'text-ink-3')}>{WEEKDAYS[i]}</span>
            {MAIN.map((type) => (
              <span key={type} className={cn('size-3 rounded-full', meals.some((m) => m.date === d && m.type === type) ? 'bg-tint' : 'bg-white/15')} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

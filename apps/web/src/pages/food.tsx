import { dailyKcalGoal, MEAL_LABEL, PORTION_KINDS, PORTIONS, portionTotals, type MealType } from '@forma/core';
import { Plus } from 'lucide-react';
import { KcalRing, MealBadge, PORTION_COLOR, PortionBadge } from '@/components/food-visuals';
import { useLog } from '@/components/forms/log';
import { LargeTitle, List } from '@/components/ui/ios';
import { WeekBars, weekOf } from '@/components/zone';
import { cn, fmtTime } from '@/lib/format';
import { useMeals, useMealsDays, useProfile, useToday } from '@/lib/queries';
import type { Meal } from '@/lib/types';

const MAIN: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];

const sumKcal = (meals: Meal[]) => meals.reduce((a, m) => a + (m.kcal ?? 0), 0);

/** Zona Alimentación: cuánto llevas hoy contra tu meta, tus comidas y la guía de porciones. */
export function FoodPage() {
  const today = useToday();
  const profile = useProfile();
  const meals = useMeals();
  const week = useMealsDays(7);
  const log = useLog();
  const t = today.data;
  const list = meals.data ?? [];
  const e = profile.data?.estimates;
  const goal = e ? dailyKcalGoal(e.tdeeKcal, e.bmrKcal) : null;
  const kcal = sumKcal(list);
  const macros = portionTotals(
    Object.fromEntries(PORTION_KINDS.map((k) => [k, list.reduce((a, m) => a + (m.portions?.[k] ?? 0), 0)])),
  );

  return (
    <div>
      <LargeTitle text="Alimentación" />

      <KcalRing kcal={kcal} goal={goal} />
      {goal !== null && (
        <p className={cn('mt-4 text-center text-[17px]', kcal > goal * 1.05 ? 'text-red' : 'text-ink-2')}>
          {kcal === 0 ? 'Registra tu primera comida' : kcal <= goal ? `Quedan ~${(goal - kcal).toLocaleString('es-MX')} kcal` : `Te pasaste ~${(kcal - goal).toLocaleString('es-MX')} kcal`}
        </p>
      )}

      {kcal > 0 && (
        <div className="mt-5 flex justify-center gap-5 text-[15px] tabular">
          <Macro color={PORTION_COLOR.PROTEIN} label="Proteína" g={macros.proteinG} />
          <Macro color={PORTION_COLOR.CARBS} label="Carbos" g={macros.carbsG} />
          <Macro color={PORTION_COLOR.FAT} label="Grasa" g={macros.fatG} />
        </div>
      )}

      <div className="mt-10">
        <List>
          {MAIN.map((type) => {
            const found = list.filter((m) => m.type === type);
            return found.length ? (
              found.map((m) => <MealRow key={m.id} meal={m} onClick={() => log({ kind: 'meal', edit: m })} />)
            ) : (
              <button key={type} onClick={() => log({ kind: 'meal', type })} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/[0.06]">
                <MealBadge type={type} muted />
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

      {t && (
        <section className="mt-12">
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Esta semana</h2>
          <WeekBars
            days={weekOf(t.date)}
            today={t.date}
            value={(d) => {
              const k = sumKcal((week.data ?? []).filter((m) => m.date === d));
              return k > 0 ? k : null;
            }}
            goal={goal ?? undefined}
            max={Math.max((goal ?? 2000) * 1.3, ...(week.data ?? []).map((m) => m.kcal ?? 0))}
            label="Calorías de la semana"
          />
        </section>
      )}

      <PortionGuide />
    </div>
  );
}

function Macro({ color, label, g }: { color: string; label: string; g: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold">{g} g</span>
    </span>
  );
}

function MealRow({ meal, onClick }: { meal: Meal; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/[0.06]">
      <MealBadge type={meal.type} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ink-3">
          {MEAL_LABEL[meal.type]} · {fmtTime(meal.eatenAt)}
        </span>
        <span className="block truncate text-[17px]">{meal.description}</span>
      </span>
      {meal.kcal !== null && <span className="shrink-0 text-[15px] text-ink-2 tabular">~{meal.kcal}</span>}
    </button>
  );
}

/** Referencia visual: cómo medir cada porción con la mano, con ejemplos. */
function PortionGuide() {
  return (
    <section className="mt-12">
      <h2 className="text-[22px] font-bold tracking-[-0.02em]">Mide con tu mano</h2>
      <div className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {PORTION_KINDS.map((k) => (
          <article key={k} className="glass w-[210px] shrink-0 snap-start rounded-[26px] p-4">
            <PortionBadge kind={k} size={56} />
            <p className="mt-3 text-[17px] font-semibold">{PORTIONS[k].label}</p>
            <p className="text-[15px] text-ink-2">
              1 {PORTIONS[k].hand} ≈ {PORTIONS[k].kcal} kcal
            </p>
            <ul className="mt-3 space-y-1 text-[14px] leading-snug text-ink-2">
              {PORTIONS[k].examples.slice(0, 3).map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

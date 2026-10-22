import { dailyKcalGoal, macroTargets, MEAL_LABEL, PORTION_KINDS, PORTIONS, portionTotals, type MealType } from '@forma/core';
import { Drumstick, Flame, Plus, Salad, ThumbsUp, Utensils } from 'lucide-react';
import { StatusPill, TipList, type Tip, type Tone } from '@/components/feedback';
import { KcalRing, MealBadge, PORTION_COLOR, PortionBadge } from '@/components/food-visuals';
import { useLog } from '@/components/forms/log';
import { LargeTitle, List } from '@/components/ui/ios';
import { WeekBars, weekOf } from '@/components/zone';
import { fmtTime } from '@/lib/format';
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
  const eaten = Object.fromEntries(PORTION_KINDS.map((k) => [k, list.reduce((a, m) => a + (m.portions?.[k] ?? 0), 0)])) as Record<(typeof PORTION_KINDS)[number], number>;
  const macros = portionTotals(eaten);
  const targets = goal !== null && e ? macroTargets(goal, e.weightUsedKg) : null;

  return (
    <div>
      <LargeTitle text="Alimentación" />

      <KcalRing kcal={kcal} goal={goal} />
      {goal !== null && <DayStatus kcal={kcal} goal={goal} />}

      {targets && kcal > 0 && <MacroBars macros={macros} targets={targets} />}

      <div className="mt-10">
        <FoodTips meals={list} kcal={kcal} goal={goal} protein={macros.proteinG} proteinTarget={targets?.proteinG ?? null} veg={eaten.VEG} week={week.data ?? []} today={t?.date} />
      </div>

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

/** Píldora de cómo vas contra la meta y una línea con lo que queda. */
function DayStatus({ kcal, goal }: { kcal: number; goal: number }) {
  if (kcal === 0) return <p className="mt-5 text-center text-[17px] text-ink-2">Registra tu primera comida</p>;
  const tone: Tone = kcal > goal * 1.05 ? 'bad' : 'good';
  const label = kcal > goal * 1.05 ? 'Te pasaste' : kcal >= goal * 0.95 ? 'En tu meta' : 'Vas bien';
  const n = (x: number) => x.toLocaleString('es-MX');
  return (
    <div className="mt-5 text-center">
      <StatusPill tone={tone} label={label} />
      <p className="mt-2.5 text-[15px] text-ink-2 tabular">{kcal <= goal ? `Quedan ~${n(goal - kcal)} kcal` : `~${n(kcal - goal)} kcal arriba de tu meta`}</p>
    </div>
  );
}

/** Cada macro con su barra contra la meta del día. */
function MacroBars({ macros, targets }: { macros: { proteinG: number; carbsG: number; fatG: number }; targets: { proteinG: number; carbsG: number; fatG: number } }) {
  const rows = [
    { label: 'Proteína', g: macros.proteinG, t: targets.proteinG, color: PORTION_COLOR.PROTEIN },
    { label: 'Carbohidratos', g: macros.carbsG, t: targets.carbsG, color: PORTION_COLOR.CARBS },
    { label: 'Grasa', g: macros.fatG, t: targets.fatG, color: PORTION_COLOR.FAT },
  ];
  return (
    <div className="mt-8 space-y-4 rounded-[26px] bg-[var(--card)] px-5 py-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="font-medium">{r.label}</span>
            <span className="text-ink-2 tabular">
              <span className="font-semibold text-ink">{r.g}</span> / {r.t} g
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(1, r.g / Math.max(1, r.t)) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Un plato que cabe en las kcal que quedan: proteína y verdura siempre, carbos y grasa si alcanza. */
function platePlan(remaining: number, palms: number) {
  const base = palms * 130 + 25;
  const carbs = Math.max(0, Math.min(2, Math.floor((remaining - base) / 120)));
  const fat = remaining - base - carbs * 120 >= 100 ? 1 : 0;
  return [
    palms === 1 ? '1 palma de proteína' : `${palms} palmas de proteína`,
    carbs ? `${carbs} ${carbs === 1 ? 'puño' : 'puños'} de carbohidrato` : null,
    'verdura',
    fat ? '1 pulgar de grasa' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Consejos del día según lo que llevas comido, del más urgente al más amable. */
function FoodTips({
  meals,
  kcal,
  goal,
  protein,
  proteinTarget,
  veg,
  week,
  today,
}: {
  meals: Meal[];
  kcal: number;
  goal: number | null;
  protein: number;
  proteinTarget: number | null;
  veg: number;
  week: Meal[];
  today?: string;
}) {
  const log = useLog();
  // La siguiente comida según la hora: de tarde ya no se sugiere el desayuno.
  const h = new Date().getHours();
  const slots: MealType[] = h < 11 ? MAIN : h < 17 ? ['LUNCH', 'DINNER'] : ['DINNER'];
  const next = slots.find((m) => !meals.some((x) => x.type === m));
  const nextName = next ? MEAL_LABEL[next].toLowerCase() : 'próxima comida';
  const missing = meals.filter((m) => m.kcal === null);
  // Palmas de proteína para la siguiente comida: lo que falta repartido entre las que quedan.
  const left = slots.filter((m) => !meals.some((x) => x.type === m)).length || 1;
  const palms = proteinTarget !== null ? Math.min(2, Math.max(1, Math.ceil((proteinTarget - protein) / 24 / left))) : 1;
  const tips: Tip[] = [];

  if (kcal === 0 && !meals.length)
    tips.push({ icon: Utensils, text: `Registra tu ${nextName} con las porciones de tu mano: tarda segundos y te dice cuánto llevas.`, action: { label: 'Registrar', run: () => log({ kind: 'meal', type: next }) } });
  if (goal !== null && kcal > goal * 1.05)
    tips.push({ icon: Flame, text: `Vas ~${(kcal - goal).toLocaleString('es-MX')} kcal arriba. En lo que resta del día, más verdura y proteína y menos carbohidrato.` });
  if (missing.length)
    tips.push({
      icon: Utensils,
      text: `${missing.length === 1 ? 'Una comida de hoy no tiene' : `${missing.length} comidas de hoy no tienen`} porciones; agrégalas para contar sus kcal.`,
      action: { label: 'Agregar porciones', run: () => log({ kind: 'meal', edit: missing[0]! }) },
    });
  if (proteinTarget !== null && next && kcal > 0 && protein < proteinTarget * 0.6)
    tips.push({ icon: Drumstick, text: `Llevas ${protein} de ${proteinTarget} g de proteína: pon ${palms === 1 ? 'al menos una palma' : '2 palmas'} en tu ${nextName}.` });
  if (kcal > 0 && veg === 0) tips.push({ icon: Salad, text: `Hoy aún no comes verdura: suma un puño en tu ${nextName}.` });
  if (goal !== null && next && kcal > 0 && goal - kcal > palms * 130 + 25)
    tips.push({ icon: Utensils, text: `Para tu ${nextName} te quedan ~${(goal - kcal).toLocaleString('es-MX')} kcal: por ejemplo ${platePlan(goal - kcal, palms)}.`, action: { label: 'Registrar', run: () => log({ kind: 'meal', type: next }) } });
  if (goal !== null && today) {
    const days = [...new Set(week.filter((m) => m.kcal !== null && m.date !== today).map((m) => m.date))];
    const avg = days.length ? days.reduce((a, d) => a + week.filter((m) => m.date === d).reduce((x, m) => x + (m.kcal ?? 0), 0), 0) / days.length : 0;
    if (days.length >= 3 && Math.abs(avg - goal) <= goal * 0.1)
      tips.push({ icon: ThumbsUp, text: `Esta semana promedias ~${Math.round(avg).toLocaleString('es-MX')} kcal al día, en tu meta. Sigue así.` });
  }
  return <TipList tips={tips} />;
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

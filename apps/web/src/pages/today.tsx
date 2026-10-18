import { parseClock, type MealType } from '@forma/core';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { useLog, type LogRequest } from '@/components/forms/log';
import { LargeTitle } from '@/components/ui/ios';
import { capitalize, cn, fmtDate, fmtDuration, fmtNum, fmtTime } from '@/lib/format';
import { useMeals, useProfile, useToday } from '@/lib/queries';
import type { Meal, Today } from '@/lib/types';

type State = 'done' | 'now' | 'next' | 'missed' | 'rest';

interface Entry {
  key: string;
  /** Minutos desde que despiertas: ordena el día aunque cruce medianoche. */
  at: number;
  time: string;
  title: string;
  detail?: string;
  state: State;
  /** Al tocar el renglón. */
  open?: LogRequest | 'activity';
  /** Botón + a la derecha (registro rápido). */
  add?: LogRequest;
}

const MEALS: { type: MealType; label: string; after: number }[] = [
  { type: 'BREAKFAST', label: 'Desayuno', after: 60 },
  { type: 'LUNCH', label: 'Comida', after: 6 * 60 },
  { type: 'DINNER', label: 'Cena', after: 11 * 60 },
];

const clock = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** Arma la línea del día con tu horario y lo que ya registraste. */
function buildDay(t: Today, meals: Meal[]): Entry[] {
  const wake = parseClock(t.schedule.wake);
  const since = (m: number) => (((m - wake) % 1440) + 1440) % 1440;
  const minutesOf = (iso: string) => {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  };
  const now = since(t.nowMinutes);
  const past = (at: number) => at < now;
  const out: Entry[] = [];

  // Despertar
  out.push(
    t.sleep
      ? { key: 'wake', at: 0, time: fmtTime(t.sleep.wakeTime), title: 'Despertar', detail: fmtDuration(t.sleep.durationMinutes), state: 'done', open: { kind: 'sleep', edit: { ...t.sleep, date: t.date, note: null } } }
      : { key: 'wake', at: 0, time: t.schedule.wake, title: 'Despertar', detail: '¿Cómo dormiste?', state: past(0) ? 'missed' : 'next', add: { kind: 'sleep' } },
  );

  // Actividad del día
  const a = t.activity;
  const trainAt = since(parseClock(t.schedule.training));
  if (a.kind === 'STRENGTH' || a.kind === 'WALK_MOBILITY') {
    out.push({
      key: 'activity',
      at: trainAt,
      time: t.schedule.training,
      title: a.label,
      detail: a.done ? 'Hecho' : a.kind === 'WALK_MOBILITY' ? `${a.level.walkMinutesMin}–${a.level.walkMinutesMax} min` : '30 min',
      state: a.done ? 'done' : past(trainAt + 120) ? 'missed' : 'next',
      open: 'activity',
      add: a.done ? undefined : { kind: 'activity', routine: a.kind === 'WALK_MOBILITY' ? 'WALK' : a.routine },
    });
  } else {
    out.push({ key: 'activity', at: trainAt, time: t.schedule.training, title: a.label, state: 'rest', open: 'activity' });
  }

  // Comidas: lo registrado a su hora; lo que falta, a la hora aproximada.
  for (const m of MEALS) {
    const logged = meals.filter((x) => x.type === m.type);
    if (logged.length) {
      for (const x of logged)
        out.push({ key: x.id, at: since(minutesOf(x.eatenAt)), time: fmtTime(x.eatenAt), title: m.label, detail: x.description, state: 'done', open: { kind: 'meal', edit: x } });
    } else {
      out.push({ key: m.type, at: m.after, time: clock(wake + m.after), title: m.label, state: past(m.after + 120) ? 'missed' : 'next', add: { kind: 'meal', type: m.type } });
    }
  }
  for (const x of meals.filter((x) => x.type === 'SNACK'))
    out.push({ key: x.id, at: since(minutesOf(x.eatenAt)), time: fmtTime(x.eatenAt), title: 'Snack', detail: x.description, state: 'done', open: { kind: 'meal', edit: x } });

  // Agua y refresco: van "ahora", durante todo el día.
  const h = t.hydration;
  out.push({
    key: 'water',
    at: now,
    time: 'ahora',
    title: 'Agua',
    detail: h.waterGoalMl ? `${fmtNum(h.waterMl / 1000)} / ${fmtNum(h.waterGoalMl / 1000)} L` : `${fmtNum(h.waterMl / 1000)} L`,
    state: h.waterGoalMl && h.waterMl >= h.waterGoalMl ? 'done' : 'now',
    open: { kind: 'water' },
  });
  out.push({
    key: 'soda',
    at: now + 0.5,
    time: '',
    title: 'Refresco',
    detail: h.sodaMaxGlasses !== null ? `${fmtNum(h.sodaGlasses)} de ${h.sodaMaxGlasses} vasos` : `${fmtNum(h.sodaGlasses)} vasos`,
    state: 'next',
    open: { kind: 'soda' },
  });

  // Dormir
  const bed = since(parseClock(t.schedule.bed));
  out.push({ key: 'bed', at: bed, time: t.schedule.bed, title: 'Dormir', detail: bed - now <= 60 && bed > now ? 'Prepárate' : undefined, state: 'next' });

  return out.sort((x, y) => x.at - y.at);
}

/**
 * Lo que se enfoca al abrir: el evento con hora más cercano a este momento
 * (dentro de una hora), o si no hay ninguno, el agua de "ahora".
 */
function focusIndex(entries: Entry[], t: Today): number {
  const wake = parseClock(t.schedule.wake);
  const now = (((t.nowMinutes - wake) % 1440) + 1440) % 1440;
  let best = -1;
  let bestDist = 61;
  entries.forEach((e, i) => {
    if (e.key === 'water' || e.key === 'soda' || e.state === 'done') return;
    const d = Math.abs(e.at - now);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best >= 0 ? best : Math.max(0, entries.findIndex((e) => e.key === 'water'));
}

export function TodayPage() {
  const today = useToday();
  const meals = useMeals();
  const profile = useProfile();
  const navigate = useNavigate();
  const t = today.data;
  const entries = React.useMemo(() => (t ? buildDay(t, meals.data ?? []) : []), [t, meals.data]);

  return (
    <div>
      <LargeTitle
        text="Hoy"
        trailing={
          <button aria-label="Tu perfil" onClick={() => navigate('/perfil')} className="press">
            <Avatar version={profile.data?.profile?.avatarVersion} size={44} />
          </button>
        }
      />
      {t && <p className="-mt-6 text-[17px] text-ink-2">{capitalize(fmtDate(t.date))}</p>}

      {today.isError && (
        <button onClick={() => today.refetch()} className="mt-6 text-[15px] text-red">
          No se pudo cargar. Toca para reintentar.
        </button>
      )}

      {t && entries.length > 0 && <Wheel entries={entries} initial={focusIndex(entries, t)} />}
    </div>
  );
}

const ITEM = 96; // alto de cada renglón de la rueda (px)

/**
 * Rueda 3D vertical (como los selectores de iOS): el evento del centro se ve grande y
 * enfocado; los de antes y después se encogen, se inclinan y se desvanecen. Usa el scroll
 * nativo con imán al centro, así que en el iPhone tiene la inercia de siempre.
 */
function Wheel({ entries, initial }: { entries: Entry[]; initial: number }) {
  const log = useLog();
  const navigate = useNavigate();
  const ref = React.useRef<HTMLDivElement>(null);
  const items = React.useRef<(HTMLLIElement | null)[]>([]);
  const [focused, setFocused] = React.useState(initial);
  const [pad, setPad] = React.useState(0);

  const paint = React.useCallback(() => {
    const box = ref.current;
    if (!box) return;
    const mid = box.scrollTop + box.clientHeight / 2;
    let nearest = 0;
    let nearestD = Infinity;
    items.current.forEach((el, i) => {
      if (!el) return;
      const d = (el.offsetTop + ITEM / 2 - mid) / ITEM; // distancia en renglones
      const a = Math.min(Math.abs(d), 4);
      const scale = 1 - 0.17 * a;
      el.style.transform = `translateY(${-Math.sign(d) * a * a * 6}px) rotateX(${Math.max(-60, Math.min(60, -d * 17))}deg) scale(${scale})`;
      el.style.opacity = String(Math.max(0, 1 - 0.27 * a));
      if (Math.abs(d) < nearestD) {
        nearestD = Math.abs(d);
        nearest = i;
      }
    });
    setFocused(nearest);
  }, []);

  // Al abrir, centra lo que toca ahora (sin animación).
  // Margen arriba y abajo para que el primero y el último también puedan quedar al centro.
  React.useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => setPad(Math.max(0, (box.clientHeight - ITEM) / 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // Al abrir, centra lo que toca ahora (sin animación).
  React.useLayoutEffect(() => {
    const box = ref.current;
    if (!box || !pad) return;
    box.scrollTop = initial * ITEM;
    paint();
  }, [initial, pad, paint]);

  const onScroll = React.useRef(0);
  const handleScroll = () => {
    cancelAnimationFrame(onScroll.current);
    onScroll.current = requestAnimationFrame(paint);
  };

  const run = (e: Entry) => {
    if (e.open === 'activity') navigate('/actividad');
    else if (e.open) log(e.open);
    else if (e.add) log(e.add);
  };
  const tap = (e: Entry, i: number) => {
    if (i !== focused) ref.current?.scrollTo({ top: i * ITEM, behavior: 'smooth' });
    else run(e);
  };

  return (
    <div className="relative mt-4">
      {/* Banda de vidrio que marca el centro, como el selector de iOS */}
      <div aria-hidden className="glass pointer-events-none absolute inset-x-0 top-1/2 h-[96px] -translate-y-1/2 rounded-[30px]" />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="relative h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-290px)] min-h-[340px] snap-y snap-mandatory overflow-y-auto overscroll-contain [perspective:900px]"
        style={{
          WebkitMaskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
          maskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
        }}
      >
        <ol style={{ paddingBlock: pad }}>
          {entries.map((e, i) => {
            const focus = i === focused;
            return (
              <li
                key={e.key}
                ref={(el) => {
                  items.current[i] = el;
                }}
                className="flex snap-center items-center gap-4 px-5 will-change-transform [transform-style:preserve-3d]"
                style={{ height: ITEM }}
              >
                <button onClick={() => tap(e, i)} className="flex min-w-0 flex-1 items-center gap-4 text-left" aria-current={focus ? 'true' : undefined}>
                  <Dot state={e.state} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13px] tabular', e.state === 'now' ? 'font-semibold text-tint' : 'text-ink-3')}>{e.time || 'durante el día'}</span>
                    <span className={cn('block truncate text-[28px] font-bold leading-tight tracking-[-0.02em]', (e.state === 'missed' || e.state === 'rest') && 'text-ink-2')}>{e.title}</span>
                    {e.detail && (
                      <span className={cn('block truncate text-[16px]', e.key === 'soda' ? 'text-star' : e.state === 'now' ? 'text-tint' : 'text-ink-2')}>{e.detail}</span>
                    )}
                  </span>
                </button>
                {e.add && (
                  <button
                    onClick={() => (focus ? log(e.add!) : tap(e, i))}
                    aria-label={`Registrar ${e.title.toLowerCase()}`}
                    className="glass press grid size-12 shrink-0 place-items-center rounded-full"
                  >
                    <Plus className="size-5" strokeWidth={2.4} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Estado: lleno = hecho · medio = en curso · vacío = pendiente. */
function Dot({ state }: { state: State }) {
  const base = 'relative block size-4 shrink-0 rounded-full';
  if (state === 'done') return <span className={cn(base, 'bg-tint shadow-[0_0_12px_rgba(92,160,255,0.6)]')} aria-label="Hecho" />;
  if (state === 'now')
    return (
      <span className={cn(base, 'overflow-hidden border border-tint')} aria-label="En curso">
        <span className="absolute inset-y-0 left-0 w-1/2 bg-tint" />
      </span>
    );
  return <span className={cn(base, 'border border-white/35', (state === 'missed' || state === 'rest') && 'opacity-50')} aria-label="Pendiente" />;
}

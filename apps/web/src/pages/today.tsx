import { parseClock, type MealType } from '@forma/core';
import { addDays, addMonths, addWeeks, endOfMonth, format, getDay, parseISO, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { DayRing } from '@/components/day-ring';
import { BreathFill, GlassBubble, Liquid, NightFill, PlateFill, RingFill } from '@/components/bubbles';
import { atIso, useLog, type LogRequest } from '@/components/forms/log';
import { GlassCircle, LargeTitle, Sheet } from '@/components/ui/ios';
import { capitalize, cn, fmtDate, fmtDuration, fmtNum, fmtTime } from '@/lib/format';
import { useAction, useActivityPlan, useDay, useDays, useMeals, useProfile } from '@/lib/queries';
import { api, newId } from '@/lib/api';
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

const toClock = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** Arma la línea del día con tu horario y lo que ya registraste. */
const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** Minutos del reloj del teléfono, actualizados cada minuto y al volver a la app. */
function useClockMinutes() {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = React.useState(read);
  React.useEffect(() => {
    const tick = () => setNow(read());
    const id = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

/**
 * Arma la línea del día. El día empieza a la mitad de tu sueño (schedule.dayStart), no a
 * medianoche; las comidas se ubican a partir de tu despertar real si ya lo registraste.
 * Sin reloj (`clock` null) es un día pasado: todo quedó atrás y lo que agregues va a esa fecha.
 */
function buildDay(t: Today, meals: Meal[], clock: number | null): Entry[] {
  const start = t.schedule.dayStart;
  const since = (m: number) => (((m - start) % 1440) + 1440) % 1440;
  const wakeClock = t.sleep ? minutesOf(t.sleep.wakeTime) : parseClock(t.schedule.wake);
  const wakeAt = since(wakeClock);
  const over = clock === null;
  const now = over ? 1440 : since(clock);
  const past = (at: number) => at < now;
  const d = over ? { date: t.date } : {};
  const out: Entry[] = [];

  // Despertar
  out.push(
    t.sleep
      ? { key: 'wake', at: wakeAt, time: fmtTime(t.sleep.wakeTime), title: 'Despertar', detail: fmtDuration(t.sleep.durationMinutes), state: 'done', open: { kind: 'sleep', edit: { ...t.sleep, date: t.date, note: null } } }
      : { key: 'wake', at: wakeAt, time: t.schedule.wake, title: 'Despertar', detail: '¿Cómo dormiste?', state: over ? 'missed' : 'next', add: { kind: 'sleep', ...d } },
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
      add: a.done ? undefined : { kind: 'activity', routine: a.kind === 'WALK_MOBILITY' ? 'WALK' : a.routine, ...d },
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
      const at = wakeAt + m.after;
      out.push({ key: m.type, at, time: toClock(wakeClock + m.after), title: m.label, state: past(at + 120) ? 'missed' : 'next', add: { kind: 'meal', type: m.type, ...d } });
    }
  }
  for (const x of meals.filter((x) => x.type === 'SNACK'))
    out.push({ key: x.id, at: since(minutesOf(x.eatenAt)), time: fmtTime(x.eatenAt), title: 'Snack', detail: x.description, state: 'done', open: { kind: 'meal', edit: x } });

  // Agua y refresco: van "ahora", durante todo el día (en días pasados, tras el despertar).
  const h = t.hydration;
  const drinksAt = over ? wakeAt + 1 : now;
  out.push({
    key: 'water',
    at: drinksAt,
    time: over ? '' : 'ahora',
    title: 'Agua',
    detail: h.waterGoalMl ? `${fmtNum(h.waterMl / 1000)} / ${fmtNum(h.waterGoalMl / 1000)} L` : `${fmtNum(h.waterMl / 1000)} L`,
    state: h.waterGoalMl && h.waterMl >= h.waterGoalMl ? 'done' : over ? 'missed' : 'now',
    open: { kind: 'water', ...d },
  });
  out.push({
    key: 'soda',
    at: drinksAt + 0.5,
    time: '',
    title: 'Refresco',
    detail: h.sodaMaxGlasses !== null ? `${fmtNum(h.sodaGlasses)} de ${h.sodaMaxGlasses} vasos` : `${fmtNum(h.sodaGlasses)} vasos`,
    state: over ? 'rest' : 'next',
    open: { kind: 'soda', ...d },
  });

  // Dormir
  const bed = since(parseClock(t.schedule.bed));
  out.push({ key: 'bed', at: bed, time: t.schedule.bed, title: 'Dormir', detail: bed - now <= 60 && bed > now ? 'Prepárate' : undefined, state: over ? 'rest' : 'next' });

  return out.sort((x, y) => x.at - y.at);
}

/**
 * Lo que se enfoca al abrir: el evento con hora más cercano a este momento
 * (dentro de una hora), o si no hay ninguno, el agua de "ahora".
 */
function focusIndex(entries: Entry[], t: Today, clock: number): number {
  const now = (((clock - t.schedule.dayStart) % 1440) + 1440) % 1440;
  // En la mañana, si aún no registras tu sueño, eso va primero.
  const wake = entries.findIndex((e) => e.key === 'wake');
  if (!t.sleep && wake >= 0 && now <= entries[wake]!.at + 5 * 60) return wake;
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
  const today = useDay(null);
  const [sel, setSel] = React.useState<string | null>(null);
  const day = useDay(sel);
  const meals = useMeals(sel ?? undefined);
  const profile = useProfile();
  const navigate = useNavigate();
  const [month, setMonth] = React.useState(false);
  const t = day.data;
  const todayKey = today.data?.date;
  const clock = useClockMinutes();
  const past = sel !== null;
  const entries = React.useMemo(() => (t ? buildDay(t, meals.data ?? [], past ? null : clock) : []), [t, meals.data, clock, past]);
  const pick = (d: string) => setSel(d === todayKey ? null : d);

  return (
    <div>
      <LargeTitle
        text={!t || !past ? 'Hoy' : sel === (todayKey && toKey(subDays(parseISO(todayKey), 1))) ? 'Ayer' : capitalize(fmtDate(sel, 'EEEE d'))}
        trailing={
          <button aria-label="Inicio" onClick={() => navigate('/')} className="press">
            <Avatar version={profile.data?.profile?.avatarVersion} size={44} />
          </button>
        }
      />
      {t && (
        <button onClick={() => setMonth(true)} className="press -mt-6 flex items-center gap-1 text-[17px] text-ink-2">
          {capitalize(fmtDate(t.date, "d 'de' MMMM"))}
          <ChevronDown className="size-4" strokeWidth={2.5} />
        </button>
      )}

      {today.isError && (
        <button onClick={() => today.refetch()} className="mt-6 text-[15px] text-red">
          No se pudo cargar. Toca para reintentar.
        </button>
      )}

      {today.data && <WeekStrip today={today.data.date} start={today.data.program.start} selected={sel ?? today.data.date} onPick={pick} />}

      {t && entries.length > 0 && <Pager key={t.date} t={t} entries={entries} meals={meals.data ?? []} initial={past ? 0 : focusIndex(entries, t, clock)} clock={past ? null : clock} />}

      {today.data && (
        <MonthSheet
          open={month}
          onOpenChange={setMonth}
          today={today.data.date}
          start={today.data.program.start}
          selected={sel ?? today.data.date}
          onPick={(d) => {
            pick(d);
            setMonth(false);
          }}
        />
      )}
    </div>
  );
}

// --- Calendario -------------------------------------------------------------------

const toKey = (d: Date) => format(d, 'yyyy-MM-dd');
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const weekStart = (key: string) => startOfWeek(parseISO(key), { weekStartsOn: 1 });

/** Anillo de cumplimiento del día con el número al centro (como Actividad de iOS). */
function DayCell({ date, score, selected, isToday, disabled, onPick }: { date: string; score: number | undefined; selected: boolean; isToday: boolean; disabled: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      aria-label={capitalize(fmtDate(date))}
      aria-pressed={selected}
      className="press relative mx-auto grid size-11 place-items-center disabled:opacity-30"
    >
      <span className="absolute inset-0">
        <DayRing score={score} track={!disabled} />
      </span>
      <span
        className={cn(
          'relative grid size-[30px] place-items-center rounded-full text-[15px] font-semibold tabular',
          selected ? 'bg-ink text-[#000]' : isToday ? 'text-tint' : 'text-ink',
        )}
      >
        {Number(date.slice(8))}
      </span>
    </button>
  );
}

/** Semanas de lunes a domingo que pasas de lado; al abrir, la del día elegido. */
function WeekStrip({ today, start, selected, onPick }: { today: string; start: string; selected: string; onPick: (d: string) => void }) {
  const first = React.useMemo(() => {
    const s = weekStart(start);
    const limit = subWeeks(weekStart(today), 25);
    return s < limit ? limit : s;
  }, [start, today]);
  const weeks = React.useMemo(() => {
    const out: string[][] = [];
    for (let w = first; w <= parseISO(today); w = addWeeks(w, 1)) out.push(Array.from({ length: 7 }, (_, i) => toKey(addDays(w, i))));
    return out;
  }, [first, today]);
  const scores = useDays(toKey(first), today);
  const byDate = React.useMemo(() => new Map(scores.data?.map((d) => [d.date, d.score])), [scores.data]);
  const ref = React.useRef<HTMLDivElement>(null);
  const selWeek = weeks.findIndex((w) => w.includes(selected));

  React.useLayoutEffect(() => {
    const box = ref.current;
    if (box && selWeek >= 0) box.scrollTo({ left: selWeek * box.clientWidth, behavior: box.scrollLeft ? 'smooth' : 'instant' });
  }, [selWeek]);

  return (
    <div className="-mx-5 mt-5">
      <div className="grid grid-cols-7 px-5 text-center text-[12px] font-medium text-ink-3">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div ref={ref} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {weeks.map((w) => (
          <div key={w[0]} className="grid w-full shrink-0 snap-start grid-cols-7 px-5 pt-1.5">
            {w.map((d) => (
              <DayCell key={d} date={d} score={byDate.get(d)} selected={d === selected} isToday={d === today} disabled={d > today || d < start} onPick={() => onPick(d)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mes completo en una hoja, para saltar a cualquier día del historial. */
function MonthSheet({ open, onOpenChange, today, start, selected, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; today: string; start: string; selected: string; onPick: (d: string) => void }) {
  const [month, setMonth] = React.useState(() => startOfMonth(parseISO(selected)));
  React.useEffect(() => {
    if (open) setMonth(startOfMonth(parseISO(selected)));
  }, [open, selected]);
  const from = toKey(month);
  const to = toKey(endOfMonth(month));
  const scores = useDays(from, to);
  const byDate = new Map(scores.data?.map((d) => [d.date, d.score]));
  const lead = (getDay(month) + 6) % 7; // huecos antes del día 1 (semana de lunes)
  const days = Array.from({ length: Number(to.slice(8)) }, (_, i) => toKey(addDays(month, i)));
  const canPrev = from > start;
  const canNext = to < today;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={capitalize(format(month, 'MMMM yyyy', { locale: es }))}>
      <div className="flex justify-between">
        <GlassCircle aria-label="Mes anterior" disabled={!canPrev} onClick={() => setMonth((m) => subMonths(m, 1))} className="disabled:opacity-30">
          <ChevronLeft />
        </GlassCircle>
        <GlassCircle aria-label="Mes siguiente" disabled={!canNext} onClick={() => setMonth((m) => addMonths(m, 1))} className="disabled:opacity-30">
          <ChevronRight />
        </GlassCircle>
      </div>
      <div className="grid grid-cols-7 gap-y-2 pb-2 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[12px] font-medium text-ink-3">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`x${i}`} />
        ))}
        {days.map((d) => (
          <DayCell key={d} date={d} score={byDate.get(d)} selected={d === selected} isToday={d === today} disabled={d > today || d < start} onPick={() => onPick(d)} />
        ))}
      </div>
    </Sheet>
  );
}

// --- Pasos del día ----------------------------------------------------------------

/**
 * Tarjetas que pasas de lado, una por momento del día, con puntos de página abajo. Al abrir
 * muestra lo que toca ahora; en días pasados, empieza por el despertar.
 */
function Pager({ t, entries, meals, initial, clock }: { t: Today; entries: Entry[]; meals: Meal[]; initial: number; clock: number | null }) {
  const log = useLog();
  const navigate = useNavigate();
  const ref = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(initial);
  const step = () => {
    const first = ref.current?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 12 : 1;
  };

  React.useLayoutEffect(() => {
    const box = ref.current;
    if (box) box.scrollLeft = initial * step();
  }, [initial]);

  const go = (i: number) => ref.current?.scrollTo({ left: i * step(), behavior: 'smooth' });

  return (
    <div className="mt-6">
      <div
        ref={ref}
        onScroll={(ev) => setIndex(Math.round(ev.currentTarget.scrollLeft / step()))}
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-7"
      >
        {entries.map((e) => (
          <section key={e.key} className="glass flex h-[300px] w-[calc(100%-1rem)] shrink-0 snap-center flex-col rounded-[32px] px-5 py-5" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
            <div className="flex items-center gap-3">
              <Dot state={e.state} />
              <span className={cn('text-[15px] tabular', e.state === 'now' ? 'font-semibold text-tint' : 'text-ink-3')}>{e.time || 'durante el día'}</span>
            </div>
            <h2 className={cn('mt-1 truncate text-[32px] font-bold leading-tight tracking-[-0.025em]', (e.state === 'missed' || e.state === 'rest') && 'text-ink-2')}>{e.title}</h2>
            <div className="mt-3 min-h-0 flex-1">
              <LiveContent
                entry={e}
                t={t}
                meals={meals}
                clock={clock}
                onOpen={() => (e.open === 'activity' ? navigate('/salud/actividad') : e.open ? log(e.open) : e.add && log(e.add))}
              />
            </div>
          </section>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-0.5" role="tablist" aria-label="Momentos del día">
        {entries.map((e, i) => (
          <button key={e.key} role="tab" aria-selected={i === index} aria-label={e.title} onClick={() => go(i)} className="grid h-6 w-4 place-items-center">
            <span className={cn('block h-2 rounded-full transition-all duration-300', i === index ? 'w-2 bg-ink' : 'w-2 bg-white/25')} />
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Contenido en vivo de la tarjeta ------------------------------------------------
// Cada tarjeta lleva una burbuja de vidrio con un recurso visual propio (como la del agua)
// y sus acciones a la derecha.

function LiveButton({ children, onClick, primary, tone }: { children: React.ReactNode; onClick: () => void; primary?: boolean; tone?: 'star' }) {
  return (
    <button
      onClick={onClick}
      className={cn('press h-11 max-w-full truncate whitespace-nowrap rounded-full px-5 text-[16px] font-semibold', primary ? (tone === 'star' ? 'bg-star text-[#2a1d00]' : 'bg-tint text-[#06102a]') : 'glass')}
    >
      {children}
    </button>
  );
}

/** Contenedor común: burbuja a la izquierda, acciones a la derecha. */
function LiveRow({ bubble, children }: { bubble: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center gap-4">
      {bubble}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">{children}</div>
    </div>
  );
}

function LiveContent({ entry: e, t, meals, clock, onOpen }: { entry: Entry; t: Today; meals: Meal[]; clock: number | null; onOpen: () => void }) {
  const log = useLog();
  const date = clock === null ? t.date : undefined;
  const addDrink = useAction((v: { type: 'WATER' | 'SODA_REGULAR'; ml: number }) => api.post('/beverages', { id: newId(), type: v.type, volumeMl: v.ml, loggedAt: atIso(date) }), {
    success: (_r, v) => (v.type === 'WATER' ? `+${v.ml} ml` : 'Refresco registrado'),
  });
  const h = t.hydration;

  if (e.key === 'water') {
    return (
      <LiveRow
        bubble={
          <GlassBubble ariaLabel="Ver agua de hoy" onClick={() => log({ kind: 'water', date })} label={`${fmtNum(h.waterMl / 1000)} L`} sub={h.waterGoalMl ? `de ${fmtNum(h.waterGoalMl / 1000)} L` : undefined}>
            <Liquid pct={h.waterGoalMl ? h.waterMl / h.waterGoalMl : 0} color="rgba(92,160,255,0.55)" />
          </GlassBubble>
        }
      >
        <LiveButton primary onClick={() => addDrink.mutate({ type: 'WATER', ml: 250 })}>+250 ml</LiveButton>
        <LiveButton onClick={() => addDrink.mutate({ type: 'WATER', ml: 500 })}>+500 ml</LiveButton>
      </LiveRow>
    );
  }

  if (e.key === 'soda') {
    const max = h.sodaMaxGlasses;
    return (
      <LiveRow
        bubble={
          <GlassBubble ariaLabel="Ver refresco de hoy" onClick={() => log({ kind: 'soda', date })} label={max !== null ? `${fmtNum(h.sodaGlasses)}/${max}` : fmtNum(h.sodaGlasses)} sub="vasos">
            <Liquid pct={max ? h.sodaGlasses / max : h.sodaGlasses ? 1 : 0} color="rgba(255,190,60,0.5)" fizz />
          </GlassBubble>
        }
      >
        <LiveButton primary tone="star" onClick={() => addDrink.mutate({ type: 'SODA_REGULAR', ml: h.glassSizeMl })}>
          +1 vaso
        </LiveButton>
        <LiveButton onClick={() => log({ kind: 'soda', date })}>Otra cantidad</LiveButton>
      </LiveRow>
    );
  }

  if (e.key === 'activity') return <ActivityLive entry={e} t={t} onOpen={onOpen} />;

  if (e.key === 'wake') {
    const done = e.state === 'done' && t.sleep;
    return (
      <LiveRow
        bubble={
          <GlassBubble ariaLabel="Tu sueño" onClick={onOpen} label={done ? fmtDuration(t.sleep!.durationMinutes) : '—'} sub={done ? (t.sleep!.quality ? ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'][t.sleep!.quality] : 'dormiste') : 'sin registro'}>
            <NightFill />
          </GlassBubble>
        }
      >
        {done ? <LiveButton onClick={onOpen}>Editar</LiveButton> : <LiveButton primary onClick={onOpen}>Registrar</LiveButton>}
      </LiveRow>
    );
  }

  if (e.key === 'bed') {
    const start = t.schedule.dayStart;
    const since = (m: number) => (((m - start) % 1440) + 1440) % 1440;
    if (clock === null) {
      return (
        <LiveRow
          bubble={
            <GlassBubble ariaLabel="Hora de dormir" label={t.schedule.bed} sub="meta">
              <NightFill />
            </GlassBubble>
          }
        >
          {null}
        </LiveRow>
      );
    }
    const left = since(parseClock(t.schedule.bed)) - since(clock);
    const pct = left > 0 ? Math.min(1, left / 180) : 0; // las últimas 3 horas
    return (
      <LiveRow
        bubble={
          <GlassBubble ariaLabel="Hora de dormir" label={left <= 0 ? 'Ya' : left >= 180 ? `${Math.round(left / 60)} h` : fmtDuration(left)} sub={left > 0 ? 'para dormir' : 'es hora'}>
            <NightFill />
            <RingFill pct={pct} color="rgba(244,234,208,0.8)" />
          </GlassBubble>
        }
      >
        <p className="text-[17px] text-ink-2">Meta: {t.schedule.bed}</p>
        {left > 0 && left <= 60 && <p className="text-[17px]">Baja las pantallas</p>}
      </LiveRow>
    );
  }

  // Comidas: plato con desayuno, comida y cena.
  const has = (type: MealType) => meals.some((m) => m.type === type);
  const plate: [boolean, boolean, boolean] = [has('BREAKFAST'), has('LUNCH'), has('DINNER')];
  return (
    <LiveRow
      bubble={
        <GlassBubble ariaLabel={e.title} onClick={onOpen} label={`${plate.filter(Boolean).length}/3`} sub="comidas">
          <PlateFill done={plate} />
        </GlassBubble>
      }
    >
      {e.state === 'done' ? (
        <>
          <p className="line-clamp-2 text-[16px] leading-snug">{e.detail}</p>
          <LiveButton onClick={onOpen}>Editar</LiveButton>
        </>
      ) : (
        <>
          <p className="text-[16px] text-ink-2">Cerca de las {e.time}</p>
          <LiveButton primary onClick={onOpen}>Registrar</LiveButton>
        </>
      )}
    </LiveRow>
  );
}

function ActivityLive({ entry: e, t, onOpen }: { entry: Entry; t: Today; onOpen: () => void }) {
  const log = useLog();
  const plan = useActivityPlan();
  const p = plan.data;
  const routine = p?.templates.find((x) => x.code === t.activity.routine);
  if (e.state === 'rest') {
    return (
      <LiveRow
        bubble={
          <GlassBubble ariaLabel="Día de descanso" onClick={onOpen} label="Hoy" sub="descanso">
            <BreathFill />
          </GlassBubble>
        }
      >
        <p className="text-[16px] text-ink-2">Recuperarse también cuenta</p>
        <LiveButton onClick={onOpen}>Ver semana</LiveButton>
      </LiveRow>
    );
  }
  const done = e.state === 'done';
  return (
    <LiveRow
      bubble={
        <GlassBubble ariaLabel="Ver rutina" onClick={() => onOpen()} label={t.activity.routine ?? 'C'} sub={routine ? `${routine.exercises.length} ejercicios` : e.detail}>
          <RingFill pct={done ? 1 : 0.06} color="rgba(48,209,88,0.85)" />
        </GlassBubble>
      }
    >
      {routine && (
        <ul className="w-full space-y-0.5 text-[14px] text-ink-2">
          {routine.exercises.slice(0, 3).map((x) => (
            <li key={x.name} className="truncate">
              {x.name}
            </li>
          ))}
        </ul>
      )}
      {done ? <span className="text-[16px] font-semibold text-green">Hecho</span> : <LiveButton primary onClick={() => (e.add ? log(e.add) : onOpen())}>Ya lo hice</LiveButton>}
    </LiveRow>
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

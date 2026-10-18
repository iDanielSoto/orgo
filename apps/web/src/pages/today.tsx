import { parseClock, type MealType } from '@forma/core';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { useLog, type LogRequest } from '@/components/forms/log';
import { LargeTitle } from '@/components/ui/ios';
import { capitalize, cn, fmtDate, fmtDuration, fmtNum, fmtTime } from '@/lib/format';
import { useAction, useActivityPlan, useMeals, useProfile, useToday } from '@/lib/queries';
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
 */
function buildDay(t: Today, meals: Meal[], clock: number): Entry[] {
  const start = t.schedule.dayStart;
  const since = (m: number) => (((m - start) % 1440) + 1440) % 1440;
  const wakeClock = t.sleep ? minutesOf(t.sleep.wakeTime) : parseClock(t.schedule.wake);
  const wakeAt = since(wakeClock);
  const now = since(clock);
  const past = (at: number) => at < now;
  const out: Entry[] = [];

  // Despertar
  out.push(
    t.sleep
      ? { key: 'wake', at: wakeAt, time: fmtTime(t.sleep.wakeTime), title: 'Despertar', detail: fmtDuration(t.sleep.durationMinutes), state: 'done', open: { kind: 'sleep', edit: { ...t.sleep, date: t.date, note: null } } }
      : { key: 'wake', at: wakeAt, time: t.schedule.wake, title: 'Despertar', detail: '¿Cómo dormiste?', state: 'next', add: { kind: 'sleep' } },
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
      const at = wakeAt + m.after;
      out.push({ key: m.type, at, time: toClock(wakeClock + m.after), title: m.label, state: past(at + 120) ? 'missed' : 'next', add: { kind: 'meal', type: m.type } });
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
  const today = useToday();
  const meals = useMeals();
  const profile = useProfile();
  const navigate = useNavigate();
  const t = today.data;
  const clock = useClockMinutes();
  const entries = React.useMemo(() => (t ? buildDay(t, meals.data ?? [], clock) : []), [t, meals.data, clock]);

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

      {t && entries.length > 0 && <Wheel t={t} entries={entries} meals={meals.data ?? []} initial={focusIndex(entries, t, clock)} clock={clock} />}
    </div>
  );
}

// --- Rueda del día ----------------------------------------------------------------

const ITEM = 96; // alto de cada renglón (px)
const CARD = 236; // alto de la tarjeta viva del centro (px)

/**
 * Rueda 3D vertical (como los selectores de iOS). El evento del centro se convierte en una
 * tarjeta de vidrio con su contenido en vivo; los de antes y después se encogen, se inclinan y
 * se apartan. Usa el scroll nativo con imán al centro (inercia del iPhone).
 */
function Wheel({ t, entries, meals, initial, clock }: { t: Today; entries: Entry[]; meals: Meal[]; initial: number; clock: number }) {
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
      // Se apartan para dejar sitio a la tarjeta del centro y se acercan entre sí al alejarse.
      const push = Math.sign(d) * ((CARD - ITEM) / 2) * Math.min(1, a);
      const ty = push - Math.sign(d) * a * a * 7;
      el.style.transform = `translateY(${ty}px) rotateX(${Math.max(-60, Math.min(60, -d * 17))}deg) scale(${1 - 0.15 * a})`;
      // El del centro lo muestra la tarjeta.
      el.style.opacity = String(Math.max(0, 1 - 0.27 * a) * Math.min(1, Math.max(0, (a - 0.35) / 0.45)));
      if (Math.abs(d) < nearestD) {
        nearestD = Math.abs(d);
        nearest = i;
      }
    });
    setFocused(nearest);
  }, []);

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

  const raf = React.useRef(0);
  const handleScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paint);
  };

  const center = entries[focused];

  return (
    <div className="relative mt-3">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="relative h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-300px)] min-h-[440px] snap-y snap-mandatory overflow-y-auto overscroll-contain [perspective:900px]"
        style={{
          WebkitMaskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)',
          maskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)',
        }}
      >
        <ol style={{ paddingBlock: pad }}>
          {entries.map((e, i) => (
            <li
              key={e.key}
              ref={(el) => {
                items.current[i] = el;
              }}
              className="flex snap-center items-center gap-4 px-5 will-change-transform [transform-style:preserve-3d]"
              style={{ height: ITEM }}
            >
              <button
                onClick={() => ref.current?.scrollTo({ top: i * ITEM, behavior: 'smooth' })}
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                tabIndex={i === focused ? -1 : 0}
              >
                <Dot state={e.state} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px] tabular', e.state === 'now' ? 'font-semibold text-tint' : 'text-ink-3')}>{e.time || 'durante el día'}</span>
                  <span className={cn('block truncate text-[28px] font-bold leading-tight tracking-[-0.02em]', (e.state === 'missed' || e.state === 'rest') && 'text-ink-2')}>{e.title}</span>
                  {e.detail && <span className={cn('block truncate text-[16px]', e.key === 'soda' ? 'text-star' : e.state === 'now' ? 'text-tint' : 'text-ink-2')}>{e.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Tarjeta viva del centro: deja pasar el deslizamiento y sólo captura sus botones. */}
      {center && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2" style={{ height: CARD }}>
          <div key={center.key} className="glass flex h-full animate-[fade_200ms_ease-out] flex-col rounded-[32px] px-5 py-4" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
            <div className="flex items-center gap-3">
              <Dot state={center.state} />
              <span className={cn('text-[13px] tabular', center.state === 'now' ? 'font-semibold text-tint' : 'text-ink-3')}>{center.time || 'durante el día'}</span>
            </div>
            <p className="mt-0.5 truncate text-[30px] font-bold leading-tight tracking-[-0.02em]">{center.title}</p>
            <div className="pointer-events-auto mt-2 min-h-0 flex-1">
              <LiveContent entry={center} t={t} meals={meals} clock={clock} onOpen={() => (center.open === 'activity' ? navigate('/actividad') : center.open ? log(center.open) : center.add && log(center.add))} />
            </div>
          </div>
        </div>
      )}
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

/** Burbuja de vidrio (132 px) con capas de fondo y una etiqueta al centro. */
function GlassBubble({ children, label, sub, onClick, ariaLabel }: { children?: React.ReactNode; label: React.ReactNode; sub?: string; onClick?: () => void; ariaLabel: string }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className="glass press relative grid size-[min(132px,33vw)] shrink-0 place-items-center overflow-hidden rounded-full">
      {children}
      <span className="relative text-center">
        <span className="block text-[26px] font-semibold leading-none tracking-[-0.03em] tabular">{label}</span>
        {sub && <span className="mt-1 block text-[13px] text-ink-2">{sub}</span>}
      </span>
    </button>
  );
}

/** Líquido con ola animada; `fizz` agrega burbujitas que suben (refresco). */
function Liquid({ pct, color, fizz }: { pct: number; color: string; fizz?: boolean }) {
  const level = Math.max(0.04, Math.min(1, pct)) * 100;
  return (
    <>
      <span className="absolute inset-x-0 bottom-0 transition-[height] duration-700" style={{ height: `${level}%`, background: color }} />
      <span className="absolute left-0 w-[200%] animate-[wave_5s_linear_infinite]" style={{ bottom: `calc(${level}% - 7px)` }} aria-hidden>
        <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="block h-[14px] w-full">
          <path d="M0 7 Q 25 0 50 7 T 100 7 T 150 7 T 200 7 V14 H0Z" fill={color} />
        </svg>
      </span>
      {fizz &&
        [12, 30, 48, 63, 78].map((x, i) => (
          <span
            key={x}
            aria-hidden
            className="absolute size-[5px] rounded-full bg-white/60 animate-[fizz_2.6s_ease-in_infinite]"
            style={{ left: `${x}%`, bottom: 4, animationDelay: `${i * 0.5}s`, ['--rise' as string]: `-${Math.max(18, level * 1.2)}px` }}
          />
        ))}
    </>
  );
}

/** Cielo nocturno dentro de la burbuja: luna creciente y estrellas. */
function NightFill() {
  return (
    <span aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 120%, rgba(60,80,150,0.55), rgba(8,12,30,0.2) 70%)' }}>
      <span className="absolute right-[24%] top-[16%] size-7 rounded-full shadow-[inset_-7px_3px_0_0_#f4ead0]" />
      {[
        [22, 26],
        [34, 14],
        [70, 62],
        [18, 70],
        [80, 34],
        [56, 22],
      ].map(([x, y], i) => (
        <span key={i} className="absolute size-[3px] animate-[twinkle_3s_ease-in-out_infinite] rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.45}s` }} />
      ))}
    </span>
  );
}

/** Plato en tres partes (desayuno, comida, cena) que se llenan al registrarlas. */
function PlateFill({ done }: { done: [boolean, boolean, boolean] }) {
  const on = 'rgba(92,160,255,0.55)';
  const off = 'rgba(255,255,255,0.06)';
  const bg = `conic-gradient(from -90deg, ${done[0] ? on : off} 0 118deg, transparent 118deg 120deg, ${done[1] ? on : off} 120deg 238deg, transparent 238deg 240deg, ${done[2] ? on : off} 240deg 358deg, transparent 358deg)`;
  return (
    <span aria-hidden className="absolute inset-[14px] rounded-full" style={{ background: bg, WebkitMask: 'radial-gradient(circle, transparent 55%, #000 56%)', mask: 'radial-gradient(circle, transparent 55%, #000 56%)' }} />
  );
}

/** Anillo de progreso (0–1) alrededor de la burbuja. */
function RingFill({ pct, color }: { pct: number; color: string }) {
  const deg = Math.max(0, Math.min(1, pct)) * 360;
  return (
    <span
      aria-hidden
      className="absolute inset-[10px] rounded-full transition-[background] duration-700"
      style={{
        background: `conic-gradient(from 0deg, ${color} 0 ${deg}deg, rgba(255,255,255,0.08) ${deg}deg 360deg)`,
        WebkitMask: 'radial-gradient(circle, transparent 82%, #000 83%)',
        mask: 'radial-gradient(circle, transparent 82%, #000 83%)',
      }}
    />
  );
}

/** Pulso lento, como respiración (día de descanso). */
function BreathFill() {
  return <span aria-hidden className="absolute inset-[22px] animate-[breathe_5s_ease-in-out_infinite] rounded-full bg-tint/25" />;
}

function LiveContent({ entry: e, t, meals, clock, onOpen }: { entry: Entry; t: Today; meals: Meal[]; clock: number; onOpen: () => void }) {
  const log = useLog();
  const addDrink = useAction((v: { type: 'WATER' | 'SODA_REGULAR'; ml: number }) => api.post('/beverages', { id: newId(), type: v.type, volumeMl: v.ml, loggedAt: new Date().toISOString() }), {
    success: (_r, v) => (v.type === 'WATER' ? `+${v.ml} ml` : 'Refresco registrado'),
  });
  const h = t.hydration;

  if (e.key === 'water') {
    return (
      <LiveRow
        bubble={
          <GlassBubble ariaLabel="Ver agua de hoy" onClick={() => log({ kind: 'water' })} label={`${fmtNum(h.waterMl / 1000)} L`} sub={h.waterGoalMl ? `de ${fmtNum(h.waterGoalMl / 1000)} L` : undefined}>
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
          <GlassBubble ariaLabel="Ver refresco de hoy" onClick={() => log({ kind: 'soda' })} label={max !== null ? `${fmtNum(h.sodaGlasses)}/${max}` : fmtNum(h.sodaGlasses)} sub="vasos">
            <Liquid pct={max ? h.sodaGlasses / max : h.sodaGlasses ? 1 : 0} color="rgba(255,190,60,0.5)" fizz />
          </GlassBubble>
        }
      >
        <LiveButton primary tone="star" onClick={() => addDrink.mutate({ type: 'SODA_REGULAR', ml: h.glassSizeMl })}>
          +1 vaso
        </LiveButton>
        <LiveButton onClick={() => log({ kind: 'soda' })}>Otra cantidad</LiveButton>
      </LiveRow>
    );
  }

  if (e.key === 'activity') return <ActivityLive entry={e} onOpen={onOpen} />;

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

function ActivityLive({ entry: e, onOpen }: { entry: Entry; onOpen: () => void }) {
  const plan = useActivityPlan();
  const p = plan.data;
  const routine = p?.templates.find((x) => x.code === p.today.routine);
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
        <GlassBubble ariaLabel="Ver rutina" onClick={() => onOpen()} label={p?.today.routine ?? 'C'} sub={routine ? `${routine.exercises.length} ejercicios` : e.detail}>
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
      {done ? <span className="text-[16px] font-semibold text-green">Hecho</span> : <LiveButton primary onClick={onOpen}>Ya lo hice</LiveButton>}
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

import { BEVERAGE_LABEL, MEAL_LABEL, NO_PORTIONS, PORTION_KINDS, PORTIONS, clockSleepMinutes, portionTotals, type MealType, type PortionKind, type Portions } from '@forma/core';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { MealBadge, PortionBadge, Plate } from '@/components/food-visuals';
import { BigNumber, Capsule, Item, List, Segmented, Sheet, Switch, TextItem, TimeItem } from '@/components/ui/ios';
import { api, newId } from '@/lib/api';
import { fmtDuration, fmtNum, fmtTime } from '@/lib/format';
import { keys, useAction, useHydrationDay, useMeals } from '@/lib/queries';
import type { Meal, SleepEntry, Today } from '@/lib/types';

/** `date` (AAAA-MM-DD) registra en un día pasado del calendario; sin ella, ahora. */
export type LogRequest =
  | { kind: 'water'; date?: string }
  | { kind: 'soda'; date?: string }
  | { kind: 'weight' }
  | { kind: 'sleep'; edit?: SleepEntry; date?: string }
  | { kind: 'meals' }
  | { kind: 'meal'; edit?: Meal; type?: MealType; date?: string }
  | { kind: 'activity'; routine?: 'A' | 'B' | 'WALK' | null; date?: string };

const LogContext = React.createContext<(req: LogRequest) => void>(() => undefined);
export const useLog = () => React.useContext(LogContext);

export function LogProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = React.useState<LogRequest | null>(null);
  const [open, setOpen] = React.useState(false);
  const [n, setN] = React.useState(0);
  const show = React.useCallback((r: LogRequest) => {
    setReq(r);
    setN((x) => x + 1);
    setOpen(true);
  }, []);
  const close = () => setOpen(false);
  const props = { open, onOpenChange: setOpen, onClose: close, show };
  return (
    <LogContext.Provider value={show}>
      {children}
      <React.Fragment key={n}>
        {req?.kind === 'water' && <DrinkSheet {...props} type="WATER" date={req.date} />}
        {req?.kind === 'soda' && <DrinkSheet {...props} type="SODA_REGULAR" date={req.date} />}
        {req?.kind === 'weight' && <WeightSheet {...props} />}
        {req?.kind === 'sleep' && <SleepSheet {...props} edit={req.edit} date={req.date} />}
        {req?.kind === 'meals' && <MealsSheet {...props} />}
        {req?.kind === 'meal' && <MealSheet {...props} edit={req.edit} type={req.type} date={req.date} />}
        {req?.kind === 'activity' && <ActivitySheet {...props} routine={req.routine ?? null} date={req.date} />}
      </React.Fragment>
    </LogContext.Provider>
  );
}

interface SheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClose: () => void;
  show: (r: LogRequest) => void;
}

const nowIso = () => new Date().toISOString();

/** Momento para un registro: ahora, o a la hora indicada del día pasado `date`. */
export function atIso(date: string | undefined, hh = 12, mm = 0) {
  if (!date) return nowIso();
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

const MEAL_HOUR: Record<MealType, number> = { BREAKFAST: 9, LUNCH: 14, SNACK: 17, DINNER: 20 };

function useToday() {
  return useQueryClient().getQueryData<Today>(keys.today);
}

// --- Agua y refresco ------------------------------------------------------------

function DrinkSheet({ open, onOpenChange, type, date }: SheetProps & { type: 'WATER' | 'SODA_REGULAR'; date?: string }) {
  const day = useHydrationDay(date);
  const glass = day.data?.glassSizeMl ?? 355;
  const add = useAction((ml: number) => api.post('/beverages', { id: newId(), type, volumeMl: ml, loggedAt: atIso(date) }), {
    success: (_r, ml) => (type === 'WATER' ? `+${ml} ml` : 'Refresco registrado'),
  });
  const del = useAction((id: string) => api.del(`/beverages/${id}`), { success: 'Eliminado' });
  const logs = day.data?.logs.filter((l) => l.type === type) ?? [];
  const isWater = type === 'WATER';
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={isWater ? 'Agua' : 'Refresco'}>
      <p className="py-4 text-center">
        <span className={`text-[64px] font-semibold leading-none tracking-[-0.04em] tabular ${isWater ? 'text-tint' : 'text-star'}`}>
          {day.data ? (isWater ? fmtNum(day.data.waterMl / 1000) : fmtNum(day.data.sodaGlasses)) : '—'}
        </span>
        <span className="ml-2 text-[24px] font-semibold text-ink-2">{isWater ? 'L' : 'vasos'}</span>
      </p>
      <div className="flex justify-center gap-3">
        {isWater ? (
          <>
            <Capsule onClick={() => add.mutate(250)}>+250 ml</Capsule>
            <Capsule onClick={() => add.mutate(500)}>+500 ml</Capsule>
          </>
        ) : (
          <Capsule onClick={() => add.mutate(glass)}>+1 vaso</Capsule>
        )}
      </div>
      {logs.length > 0 && (
        <List header={date ? undefined : 'Hoy'}>
          {logs.map((l) => (
            <Item
              key={l.id}
              label={`${l.volumeMl} ml`}
              detail={fmtTime(l.loggedAt)}
              onClick={() => confirm(`¿Eliminar ${l.volumeMl} ml de ${BEVERAGE_LABEL[l.type].toLowerCase()}?`) && del.mutate(l.id)}
            />
          ))}
        </List>
      )}
    </Sheet>
  );
}

// --- Peso -------------------------------------------------------------------------

function WeightSheet({ open, onOpenChange, onClose }: SheetProps) {
  const t = useToday();
  const [kg, setKg] = React.useState(String(t?.weight.latestKg ?? t?.weight.startKg ?? ''));
  const [waist, setWaist] = React.useState('');
  const value = Number(kg);
  const valid = value >= 30 && value <= 350;
  const save = useAction(
    () => api.post('/measurements', { id: newId(), measuredAt: nowIso(), weightKg: value, waistCm: waist ? Number(waist) : null }),
    { success: 'Peso guardado', onSuccess: onClose },
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Peso" onDone={() => save.mutate(undefined)} doneDisabled={!valid || save.isPending}>
      <BigNumber value={kg} onChange={setKg} unit="kg" decimal />
      <List>
        <label className="flex items-center">
          <span className="pl-5 text-[17px]">Cintura</span>
          <TextItem inputMode="decimal" placeholder="Opcional" value={waist} onChange={(e) => setWaist(e.target.value.replace(/[^\d.]/g, ''))} style={{ textAlign: 'right' }} />
          <span className="pr-5 text-ink-3">cm</span>
        </label>
      </List>
    </Sheet>
  );
}

// --- Sueño --------------------------------------------------------------------------

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function SleepSheet({ open, onOpenChange, onClose, edit, date }: SheetProps & { edit?: SleepEntry; date?: string }) {
  const [bed, setBed] = React.useState(edit ? hhmm(edit.bedtime) : '02:00');
  const [wake, setWake] = React.useState(edit ? hhmm(edit.wakeTime) : '09:30');
  const [quality, setQuality] = React.useState<number | null>(edit?.quality ?? null);
  const valid = /^\d{2}:\d{2}$/.test(bed) && /^\d{2}:\d{2}$/.test(wake);
  const minutes = valid ? clockSleepMinutes(bed, wake) : 0;
  const save = useAction(
    () => {
      const w = edit ? new Date(edit.wakeTime) : new Date(atIso(date));
      const [wh, wm] = wake.split(':').map(Number) as [number, number];
      const [bh, bm] = bed.split(':').map(Number) as [number, number];
      w.setHours(wh, wm, 0, 0);
      const b = new Date(w);
      b.setHours(bh, bm, 0, 0);
      if (b >= w) b.setDate(b.getDate() - 1); // la noche cruzó medianoche
      const body = { bedtime: b.toISOString(), wakeTime: w.toISOString(), quality };
      return edit ? api.patch(`/sleep/${edit.id}`, body) : api.post('/sleep', { id: newId(), ...body });
    },
    { success: 'Sueño guardado', onSuccess: onClose },
  );
  const del = useAction(() => api.del(`/sleep/${edit!.id}`), { success: 'Eliminado', onSuccess: onClose });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sueño" onDone={() => save.mutate(undefined)} doneDisabled={!valid || minutes > 16 * 60 || save.isPending}>
      <p className="py-2 text-center text-[48px] font-semibold tracking-[-0.04em] tabular">{valid ? fmtDuration(minutes) : '—'}</p>
      <List>
        <TimeItem label="Me dormí" value={bed} onChange={setBed} />
        <TimeItem label="Desperté" value={wake} onChange={setWake} />
      </List>
      <Segmented
        value={quality}
        onChange={setQuality}
        options={[
          { value: 2, label: 'Mal' },
          { value: 3, label: 'Regular' },
          { value: 4, label: 'Bien' },
        ]}
      />
      {edit && (
        <List>
          <Item label="Eliminar" destructive onClick={() => confirm('¿Eliminar este registro?') && del.mutate(undefined)} />
        </List>
      )}
    </Sheet>
  );
}

// --- Comidas ------------------------------------------------------------------------

function MealsSheet({ open, onOpenChange, show }: SheetProps) {
  const meals = useMeals();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Comidas">
      <List>
        {meals.data?.map((m) => (
          <Item key={m.id} label={m.description} detail={MEAL_LABEL[m.type]} onClick={() => show({ kind: 'meal', edit: m })} />
        ))}
        <Item label={<span className="text-tint">Agregar comida</span>} onClick={() => show({ kind: 'meal' })} />
      </List>
    </Sheet>
  );
}

function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'BREAKFAST';
  if (h >= 12 && h < 18) return 'LUNCH';
  if (h >= 18 || h < 3) return 'DINNER';
  return 'SNACK';
}

function MealSheet({ open, onOpenChange, onClose, edit, type: preset, date }: SheetProps & { edit?: Meal; type?: MealType; date?: string }) {
  const [type, setType] = React.useState<MealType>(edit?.type ?? preset ?? (date ? 'LUNCH' : guessMeal()));
  const [desc, setDesc] = React.useState(edit?.description ?? '');
  const [portions, setPortions] = React.useState<Portions>(edit?.portions ?? { ...NO_PORTIONS });
  const t = portionTotals(portions);
  const any = PORTION_KINDS.some((k) => portions[k] > 0);
  const step = (k: PortionKind, d: number) => setPortions((p) => ({ ...p, [k]: Math.min(10, Math.max(0, p[k] + d)) }));
  const save = useAction(
    () => {
      // Sin descripción, el plato habla por sí mismo ("Proteína 2 · Carbohidrato 1").
      const auto = PORTION_KINDS.filter((k) => portions[k] > 0)
        .map((k) => `${PORTIONS[k].label} ${fmtPortion(portions[k])}`)
        .join(' · ');
      const body = {
        type,
        description: desc.trim() || auto || MEAL_LABEL[type],
        proteinSource: portions.PROTEIN > 0 ? (edit?.proteinSource ?? 'Sí') : null,
        eatenAt: edit?.eatenAt ?? atIso(date, MEAL_HOUR[type]),
        hasFruit: edit?.hasFruit ?? false,
        hasVegetables: portions.VEG > 0,
        portions,
      };
      return edit ? api.patch(`/meals/${edit.id}`, body) : api.post('/meals', { id: newId(), ...body });
    },
    { success: any ? `Comida guardada · ~${t.kcal} kcal` : 'Comida guardada', onSuccess: onClose },
  );
  const del = useAction(() => api.del(`/meals/${edit!.id}`), { success: 'Eliminada', onSuccess: onClose });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Comida" onDone={() => save.mutate(undefined)} doneDisabled={(!any && !desc.trim()) || save.isPending}>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Tipo de comida">
        {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={type === m} onClick={() => setType(m)} className="press flex flex-col items-center gap-1.5">
            <MealBadge type={m} size={48} muted={type !== m} />
            <span className={type === m ? 'text-[13px] font-semibold' : 'text-[13px] text-ink-2'}>{MEAL_LABEL[m]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-5 px-1">
        <Plate portions={portions} size={118} />
        <div className="min-w-0">
          <p className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular">
            <span className="text-ink-3">~</span>
            {t.kcal}
          </p>
          <p className="mt-1 text-[15px] text-ink-2">kcal aprox.</p>
          {any && (
            <p className="mt-2 text-[13px] text-ink-2 tabular">
              P {t.proteinG} g · C {t.carbsG} g · G {t.fatG} g
            </p>
          )}
        </div>
      </div>

      <List>
        {PORTION_KINDS.map((k) => (
          <div key={k} className="flex min-h-[64px] items-center gap-3 px-4 py-2">
            <PortionBadge kind={k} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px]">{PORTIONS[k].label}</span>
              <span className="block text-[13px] text-ink-3">
                1 {PORTIONS[k].hand} ≈ {PORTIONS[k].kcal} kcal
              </span>
            </span>
            <button type="button" aria-label={`Menos ${PORTIONS[k].label}`} onClick={() => step(k, -0.5)} disabled={!portions[k]} className="press grid size-9 place-items-center rounded-full bg-fill text-[22px] disabled:opacity-30">
              −
            </button>
            <span className="w-8 text-center text-[19px] font-semibold tabular">{fmtPortion(portions[k])}</span>
            <button type="button" aria-label={`Más ${PORTIONS[k].label}`} onClick={() => step(k, 0.5)} className="press grid size-9 place-items-center rounded-full bg-fill text-[22px]">
              +
            </button>
          </div>
        ))}
      </List>

      <List>
        <TextItem placeholder="¿Qué comiste? (opcional)" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
      </List>
      {edit && (
        <List>
          <Item label="Eliminar" destructive onClick={() => confirm('¿Eliminar esta comida?') && del.mutate(undefined)} />
        </List>
      )}
    </Sheet>
  );
}

/** 1.5 → "1½", 0.5 → "½". */
export const fmtPortion = (n: number) => (n === 0 ? '0' : `${Math.floor(n) || ''}${n % 1 ? '½' : ''}`);

// --- Actividad ----------------------------------------------------------------------

function ActivitySheet({ open, onOpenChange, onClose, routine, date }: SheetProps & { routine: 'A' | 'B' | 'WALK' | null; date?: string }) {
  const [what, setWhat] = React.useState<'A' | 'B' | 'WALK' | null>(routine);
  const [minutes, setMinutes] = React.useState(routine === 'WALK' ? '15' : '30');
  const [pain, setPain] = React.useState(false);
  const [tired, setTired] = React.useState(false);
  const m = Number(minutes);
  const save = useAction(
    () =>
      api.post('/activity', {
        id: newId(),
        kind: what === 'WALK' ? 'WALK' : 'STRENGTH',
        routineCode: what === 'WALK' ? null : what,
        performedAt: new Date((date ? Date.parse(atIso(date, 18)) : Date.now()) - m * 60_000).toISOString(),
        durationMinutes: m,
        pain,
        excessiveFatigue: tired,
        poorRecovery: false,
      }),
    { success: 'Actividad guardada', onSuccess: onClose },
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Actividad" onDone={() => save.mutate(undefined)} doneDisabled={!what || !(m >= 1 && m <= 300) || save.isPending}>
      <Segmented
        value={what}
        onChange={setWhat}
        options={[
          { value: 'A', label: 'Fuerza A' },
          { value: 'B', label: 'Fuerza B' },
          { value: 'WALK', label: 'Caminata' },
        ]}
      />
      <BigNumber value={minutes} onChange={setMinutes} unit="min" />
      <List>
        <Switch label="Tuve dolor" checked={pain} onChange={setPain} />
        <Switch label="Terminé muy cansado" checked={tired} onChange={setTired} />
      </List>
    </Sheet>
  );
}

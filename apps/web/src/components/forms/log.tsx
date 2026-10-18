import { BEVERAGE_LABEL, MEAL_LABEL, clockSleepMinutes, type MealType } from '@forma/core';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { BigNumber, Capsule, Item, List, Segmented, Sheet, Switch, TextItem, TimeItem } from '@/components/ui/ios';
import { api, newId } from '@/lib/api';
import { fmtDuration, fmtNum, fmtTime } from '@/lib/format';
import { keys, useAction, useHydrationDay, useMeals } from '@/lib/queries';
import type { Meal, SleepEntry, Today } from '@/lib/types';

export type LogRequest =
  | { kind: 'water' }
  | { kind: 'soda' }
  | { kind: 'weight' }
  | { kind: 'sleep'; edit?: SleepEntry }
  | { kind: 'meals' }
  | { kind: 'meal'; edit?: Meal; type?: MealType }
  | { kind: 'activity'; routine?: 'A' | 'B' | 'WALK' | null };

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
        {req?.kind === 'water' && <DrinkSheet {...props} type="WATER" />}
        {req?.kind === 'soda' && <DrinkSheet {...props} type="SODA_REGULAR" />}
        {req?.kind === 'weight' && <WeightSheet {...props} />}
        {req?.kind === 'sleep' && <SleepSheet {...props} edit={req.edit} />}
        {req?.kind === 'meals' && <MealsSheet {...props} />}
        {req?.kind === 'meal' && <MealSheet {...props} edit={req.edit} type={req.type} />}
        {req?.kind === 'activity' && <ActivitySheet {...props} routine={req.routine ?? null} />}
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

function useToday() {
  return useQueryClient().getQueryData<Today>(keys.today);
}

// --- Agua y refresco ------------------------------------------------------------

function DrinkSheet({ open, onOpenChange, type }: SheetProps & { type: 'WATER' | 'SODA_REGULAR' }) {
  const day = useHydrationDay();
  const glass = day.data?.glassSizeMl ?? 355;
  const add = useAction((ml: number) => api.post('/beverages', { id: newId(), type, volumeMl: ml, loggedAt: nowIso() }), {
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
        <List header="Hoy">
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

function SleepSheet({ open, onOpenChange, onClose, edit }: SheetProps & { edit?: SleepEntry }) {
  const [bed, setBed] = React.useState(edit ? hhmm(edit.bedtime) : '02:00');
  const [wake, setWake] = React.useState(edit ? hhmm(edit.wakeTime) : '09:30');
  const [quality, setQuality] = React.useState<number | null>(edit?.quality ?? null);
  const valid = /^\d{2}:\d{2}$/.test(bed) && /^\d{2}:\d{2}$/.test(wake);
  const minutes = valid ? clockSleepMinutes(bed, wake) : 0;
  const save = useAction(
    () => {
      const w = edit ? new Date(edit.wakeTime) : new Date();
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

function MealSheet({ open, onOpenChange, onClose, edit, type: preset }: SheetProps & { edit?: Meal; type?: MealType }) {
  const [type, setType] = React.useState<MealType>(edit?.type ?? preset ?? guessMeal());
  const [desc, setDesc] = React.useState(edit?.description ?? '');
  const [protein, setProtein] = React.useState(Boolean(edit?.proteinSource));
  const save = useAction(
    () => {
      const body = {
        type,
        description: desc.trim(),
        // Se conserva la fuente si ya existía; si no, basta con saber que hubo proteína.
        proteinSource: protein ? (edit?.proteinSource ?? 'Sí') : null,
        eatenAt: edit?.eatenAt ?? nowIso(),
        hasFruit: edit?.hasFruit ?? false,
        hasVegetables: edit?.hasVegetables ?? false,
      };
      return edit ? api.patch(`/meals/${edit.id}`, body) : api.post('/meals', { id: newId(), ...body });
    },
    { success: 'Comida guardada', onSuccess: onClose },
  );
  const del = useAction(() => api.del(`/meals/${edit!.id}`), { success: 'Eliminada', onSuccess: onClose });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Comida" onDone={() => save.mutate(undefined)} doneDisabled={!desc.trim() || save.isPending}>
      <Segmented value={type} onChange={setType} options={(Object.keys(MEAL_LABEL) as MealType[]).map((v) => ({ value: v, label: MEAL_LABEL[v] }))} />
      <List>
        <TextItem autoFocus placeholder="¿Qué comiste?" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
        <Switch label="Con proteína" checked={protein} onChange={setProtein} />
      </List>
      {edit && (
        <List>
          <Item label="Eliminar" destructive onClick={() => confirm('¿Eliminar esta comida?') && del.mutate(undefined)} />
        </List>
      )}
    </Sheet>
  );
}

// --- Actividad ----------------------------------------------------------------------

function ActivitySheet({ open, onOpenChange, onClose, routine }: SheetProps & { routine: 'A' | 'B' | 'WALK' | null }) {
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
        performedAt: new Date(Date.now() - m * 60_000).toISOString(),
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

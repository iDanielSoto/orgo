import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BigNumber, Item, LargeTitle, List, Sheet, TextItem, TimeItem } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { fmtKg, fmtLiters, fmtNum } from '@/lib/format';
import { useAction, useHydrationGoals, useProfile } from '@/lib/queries';
import type { HydrationGoal } from '@/lib/types';
import { NotificationsSection } from '@/components/notifications';
import { BackButton } from './activity';

type Edit =
  | { kind: 'number'; title: string; path: '/profile' | '/settings'; field: string; value: number; unit: string; decimal?: boolean }
  | { kind: 'time'; title: string; field: string; value: string }
  | { kind: 'week'; goal: HydrationGoal }
  | { kind: 'delete' };

export function SettingsPage() {
  const profile = useProfile();
  const goals = useHydrationGoals();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = React.useState<Edit | null>(null);
  const data = profile.data;
  if (!data) return <BackButton />;
  const { profile: p, settings: s } = data;
  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    navigate('/entrar', { replace: true });
  };

  return (
    <div className="space-y-8">
      <div>
        <BackButton />
        <LargeTitle text="Ajustes" />
      </div>

      {goals.data && (
        <List header="Agua y refresco">
          {goals.data.map((g) => (
            <Item key={g.weekNumber} label={`Semana ${g.weekNumber}`} detail={`${fmtLiters(g.waterMl)} · ${g.sodaMaxGlasses ?? '—'}`} onClick={() => setEdit({ kind: 'week', goal: g })} />
          ))}
          <Item label="Vaso" detail={`${s.glassSizeMl} ml`} onClick={() => setEdit({ kind: 'number', title: 'Vaso', path: '/settings', field: 'glassSizeMl', value: s.glassSizeMl, unit: 'ml' })} />
        </List>
      )}

      <WeatherPlace place={s.weatherPlace} />

      <List header="Horario">
        <Item label="Dormir" detail={s.targetBedtime} onClick={() => setEdit({ kind: 'time', title: 'Dormir', field: 'targetBedtime', value: s.targetBedtime })} />
        <Item label="Despertar" detail={s.targetWakeTime} onClick={() => setEdit({ kind: 'time', title: 'Despertar', field: 'targetWakeTime', value: s.targetWakeTime })} />
        <Item label="Entrenar" detail={s.trainingTime} onClick={() => setEdit({ kind: 'time', title: 'Entrenar', field: 'trainingTime', value: s.trainingTime })} />
      </List>

      <NotificationsSection />

      <List>
        <Item label="Descargar mis datos" onClick={() => window.open('/api/account/export')} />
        <Item label="Cerrar sesión" onClick={logout} />
        <Item label="Eliminar cuenta" destructive onClick={() => setEdit({ kind: 'delete' })} />
      </List>

      {edit?.kind === 'number' && <NumberSheet edit={edit} onClose={() => setEdit(null)} />}
      {edit?.kind === 'time' && <TimeSheet edit={edit} onClose={() => setEdit(null)} />}
      {edit?.kind === 'week' && goals.data && <WeekSheet goal={edit.goal} all={goals.data} onClose={() => setEdit(null)} />}
      {edit?.kind === 'delete' && <DeleteSheet onClose={() => setEdit(null)} />}
    </div>
  );
}

export type NumberEdit = Extract<Edit, { kind: 'number' }>;

export function NumberSheet({ edit, onClose }: { edit: NumberEdit; onClose: () => void }) {
  const [v, setV] = React.useState(String(edit.value));
  const n = Number(v);
  const save = useAction(() => api.patch(edit.path, { [edit.field]: n }), { success: 'Guardado', onSuccess: onClose });
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={edit.title} onDone={() => save.mutate(undefined)} doneDisabled={!v || !Number.isFinite(n) || save.isPending}>
      <BigNumber value={v} onChange={setV} unit={edit.unit} decimal={edit.decimal} />
    </Sheet>
  );
}

function TimeSheet({ edit, onClose }: { edit: Extract<Edit, { kind: 'time' }>; onClose: () => void }) {
  const [v, setV] = React.useState(edit.value);
  const save = useAction(() => api.patch('/settings', { [edit.field]: v }), { success: 'Guardado', onSuccess: onClose });
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={edit.title} onDone={() => save.mutate(undefined)} doneDisabled={!/^\d{2}:\d{2}$/.test(v) || save.isPending}>
      <List>
        <TimeItem label="Hora" value={v} onChange={setV} />
      </List>
    </Sheet>
  );
}

function WeekSheet({ goal, all, onClose }: { goal: HydrationGoal; all: HydrationGoal[]; onClose: () => void }) {
  const [water, setWater] = React.useState(String(goal.waterMl));
  const [soda, setSoda] = React.useState(goal.sodaMaxGlasses?.toString() ?? '');
  const save = useAction(
    () =>
      api.put('/hydration/goals', {
        goals: all.map((g) => (g.weekNumber === goal.weekNumber ? { ...g, waterMl: Number(water), sodaMaxGlasses: soda === '' ? null : Number(soda) } : g)),
      }),
    { success: 'Meta guardada', onSuccess: onClose },
  );
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`Semana ${goal.weekNumber}`} onDone={() => save.mutate(undefined)} doneDisabled={!water || save.isPending}>
      <List>
        <label className="flex items-center">
          <span className="pl-5 text-[17px]">Agua</span>
          <TextItem inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value.replace(/\D/g, ''))} style={{ textAlign: 'right' }} />
          <span className="pr-5 text-ink-3">ml</span>
        </label>
        <label className="flex items-center">
          <span className="whitespace-nowrap pl-5 text-[17px]">Refresco máx.</span>
          <TextItem inputMode="numeric" value={soda} onChange={(e) => setSoda(e.target.value.replace(/\D/g, ''))} style={{ textAlign: 'right' }} />
          <span className="pr-5 text-ink-3">vasos</span>
        </label>
      </List>
    </Sheet>
  );
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState('');
  const [confirmText, setConfirmText] = React.useState('');
  const remove = useAction(() => api.del('/account', { password, confirm: confirmText }), {
    invalidate: [],
    onSuccess: () => {
      qc.clear();
      navigate('/entrar', { replace: true });
    },
  });
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Eliminar cuenta"
      doneLabel="Eliminar"
      onDone={() => remove.mutate(undefined)}
      doneDisabled={!password || confirmText !== 'ELIMINAR' || remove.isPending}
    >
      <p className="px-2 text-center text-[15px] text-ink-2">Se borran tu perfil y todos tus registros.</p>
      <List>
        <TextItem type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextItem placeholder="Escribe ELIMINAR" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </List>
    </Sheet>
  );
}

/** Lugar del cielo y el clima del fondo. */
function WeatherPlace({ place }: { place: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const useMine = () => {
    if (!('geolocation' in navigator)) return toast.error('Este teléfono no comparte su ubicación');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.patch('/settings', {
            weatherLatitude: Number(pos.coords.latitude.toFixed(4)),
            weatherLongitude: Number(pos.coords.longitude.toFixed(4)),
            weatherPlace: 'Tu ubicación',
          });
          await Promise.all([qc.invalidateQueries({ queryKey: ['weather'] }), qc.invalidateQueries({ queryKey: ['profile'] })]);
          toast.success('El cielo ahora sigue tu ubicación');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        toast.error('No se pudo obtener tu ubicación');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 3_600_000 },
    );
  };
  return (
    <List header="Cielo y clima">
      <Item label="Lugar" detail={place} />
      <Item label={busy ? 'Buscando…' : 'Usar mi ubicación'} onClick={busy ? undefined : useMine} />
    </List>
  );
}

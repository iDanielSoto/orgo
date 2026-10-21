import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/avatar';
import { HeatWord } from '@/components/portfolio';
import { BackButton, Item, List, TextBlock } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { imageToAvatarDataUrl } from '@/lib/avatar';
import { fmtDate, fmtKg, fmtNum } from '@/lib/format';
import { useAction, useProfile } from '@/lib/queries';
import { NumberSheet, type NumberEdit } from './settings';

const none = (xs: string[] | undefined, empty: string) => (xs && xs.length ? xs.join(', ') : empty);
const ACTIVITY: Record<string, string> = {
  SEDENTARY: 'Sedentaria',
  LIGHT: 'Ligera',
  MODERATE: 'Moderada',
  ACTIVE: 'Alta',
  VERY_ACTIVE: 'Muy alta',
};

export function ProfilePage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [edit, setEdit] = React.useState<NumberEdit | null>(null);
  const remove = useAction(() => api.del('/profile/avatar'), { success: 'Foto quitada', invalidate: [['profile']] });

  const data = profile.data;
  if (!data?.profile) return <BackButton />;
  const { profile: p, health: h, estimates: e } = data;

  const onFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await api.put('/profile/avatar', { dataUrl: await imageToAvatarDataUrl(file) });
      await qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Foto actualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  };
  const num = (title: string, field: string, value: number, unit: string, decimal = false) =>
    setEdit({ kind: 'number', title, path: '/profile', field, value, unit, decimal });

  return (
    <div className="space-y-8">
      <BackButton />

      <header className="flex flex-col items-center text-center">
        <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Cambiar foto de perfil" className="press">
          <Avatar version={p.avatarVersion} size={168} className={uploading ? 'opacity-50' : undefined} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <HeatWord text={p.displayName} className="mt-6 text-[44px] font-bold leading-none tracking-[-0.04em]" />
        <p className="mt-3 text-[17px] text-ink-2">
          {e?.age ?? p.ageYears} años · {fmtNum(p.heightCm)} cm · {p.primaryGoal.toLowerCase()}
        </p>
      </header>

      <List>
        <Item label={uploading ? 'Subiendo…' : 'Cambiar foto'} onClick={uploading ? undefined : () => fileRef.current?.click()} />
        {p.avatarVersion && <Item label="Quitar foto" destructive onClick={() => remove.mutate(undefined)} />}
      </List>

      <List header="Cuerpo">
        <Item label="Estatura" detail={`${fmtNum(p.heightCm)} cm`} onClick={() => num('Estatura', 'heightCm', p.heightCm, 'cm')} />
        <Item label="Edad" detail={`${p.ageYears} años`} onClick={() => num('Edad', 'ageYears', p.ageYears, 'años')} />
        <Item label="Peso inicial" detail={fmtKg(p.startWeightKg)} onClick={() => num('Peso inicial', 'startWeightKg', p.startWeightKg, 'kg', true)} />
        <Item label="Peso meta" detail={fmtKg(p.targetWeightKg)} onClick={() => num('Peso meta', 'targetWeightKg', p.targetWeightKg, 'kg', true)} />
        {e && <Item label="IMC" detail={`${fmtNum(e.bmi)} · ${e.bmiCategory}`} />}
        {e && <Item label="Gasto diario estimado" detail={`${e.tdeeKcal.toLocaleString('es-MX')} kcal`} />}
      </List>

      <List header="Objetivos">
        <TextBlock label="Principal" text={p.primaryGoal} />
        {p.secondaryGoals.length > 0 && <TextBlock label="También" text={p.secondaryGoals.join(', ')} />}
        {p.obstacles.length > 0 && <TextBlock label="Lo que más cuesta" text={p.obstacles.join(', ')} />}
      </List>

      <List header="Actividad">
        <Item label="Nivel" detail={ACTIVITY[p.activityLevel]} />
        <Item label="Entrena en" detail={p.trainingLocation ?? '—'} />
        <Item label="Días por semana" detail={p.trainingDaysPerWeek} />
        <Item label="Minutos por sesión" detail={p.sessionMinutes} />
        {p.preferredTrainingTime && <Item label="Horario" detail={p.preferredTrainingTime} />}
        <Item label="Equipo" detail={none(p.equipment, 'Ninguno')} />
        {h?.physicalCapacity && <TextBlock label="Capacidad" text={h.physicalCapacity} />}
      </List>

      {h && (
        <List header="Salud">
          <Item label="Enfermedades" detail={none(h.conditions, 'Ninguna')} />
          <Item label="Medicamentos" detail={none(h.medications, 'Ninguno')} />
          <Item label="Limitaciones" detail={none(h.physicalLimitations, 'Ninguna')} />
          {h.symptoms.length > 0 && <TextBlock label="Síntomas" text={h.symptoms.join(', ')} />}
          {h.stressLevel && <Item label="Estrés" detail={h.stressLevel} />}
        </List>
      )}

      {h && (h.dietSummary || h.foodPreferences) && (
        <List header="Alimentación">
          {h.dietSummary && <TextBlock label="Cómo come hoy" text={h.dietSummary} />}
          {h.foodPreferences && <TextBlock label="Preferencias" text={h.foodPreferences} />}
          {h.weeklyExtraBudgetMxn !== null && (
            <Item label="Presupuesto extra" detail={`${h.weeklyExtraBudgetMxn.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })} / semana`} />
          )}
        </List>
      )}

      {h && (
        <List header="Sueño">
          {h.usualBedtime && h.usualWakeTime && <Item label="Horario habitual" detail={`${h.usualBedtime} → ${h.usualWakeTime}`} />}
          {h.usualSleepHours !== null && <Item label="Horas habituales" detail={`${fmtNum(h.usualSleepHours)} h`} />}
          {h.sleepQuality && <TextBlock label="Calidad" text={h.sleepQuality} />}
          {h.lifestyleNotes && <TextBlock label="Rutina" text={h.lifestyleNotes} />}
        </List>
      )}

      <List header="Programa">
        <Item label="Inicio" detail={fmtDate(p.programStartDate, "d 'de' MMMM 'de' yyyy")} />
        <Item label="Primera revisión" detail={fmtDate(p.firstReviewDate, "d 'de' MMMM")} />
      </List>

      <List>
        <Item label="Ajustes" onClick={() => navigate('/ajustes')} />
      </List>

      {edit && <NumberSheet edit={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

import * as React from 'react';
import { useNavigate } from 'react-router';
import { Capsule, LargeTitle, List, Segmented, TextItem } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { useAction } from '@/lib/queries';

const todayKey = () => new Date().toLocaleDateString('en-CA');
const addDaysKey = (k: string, n: number) => {
  const d = new Date(`${k}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};

function NumberRow({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center">
      <span className="whitespace-nowrap pl-5 text-[17px]">{label}</span>
      <TextItem inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} style={{ textAlign: 'right' }} />
      <span className="pr-5 text-ink-3">{unit}</span>
    </label>
  );
}

/** Primer uso de una cuenta nueva. */
export function ProfileSetupPage() {
  const navigate = useNavigate();
  const [name, setName] = React.useState('');
  const [sex, setSex] = React.useState<'MALE' | 'FEMALE' | null>(null);
  const [age, setAge] = React.useState('');
  const [height, setHeight] = React.useState('');
  const [weight, setWeight] = React.useState('');
  const [target, setTarget] = React.useState('');
  const ready = name.trim() && sex && Number(age) >= 14 && Number(height) >= 100 && Number(weight) >= 30 && Number(target) >= 30;
  const save = useAction(
    () => {
      const start = todayKey();
      return api.put('/profile', {
        displayName: name.trim(),
        ageYears: Math.round(Number(age)),
        sexForEstimates: sex,
        heightCm: Number(height),
        startWeightKg: Number(weight),
        targetWeightKg: Number(target),
        activityLevel: 'SEDENTARY',
        primaryGoal: 'Recomposición corporal',
        secondaryGoals: [],
        programStartDate: start,
        firstReviewDate: addDaysKey(start, 6),
        trainingDaysPerWeek: 5,
        sessionMinutes: 30,
      });
    },
    { invalidate: [['me'], ['profile'], ['today']], onSuccess: () => navigate('/', { replace: true }) },
  );
  return (
    <div className="mx-auto max-w-[520px] space-y-6 px-5 py-10">
      <LargeTitle text="Tu perfil" />
      <List>
        <TextItem placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <NumberRow label="Edad" unit="años" value={age} onChange={setAge} />
        <NumberRow label="Estatura" unit="cm" value={height} onChange={setHeight} />
        <NumberRow label="Peso" unit="kg" value={weight} onChange={setWeight} />
        <NumberRow label="Meta" unit="kg" value={target} onChange={setTarget} />
      </List>
      <Segmented value={sex} onChange={setSex} options={[{ value: 'MALE', label: 'Masculino' }, { value: 'FEMALE', label: 'Femenino' }]} />
      <div className="flex justify-center pt-4">
        <Capsule disabled={!ready || save.isPending} onClick={() => save.mutate(undefined)} className="disabled:opacity-40">
          Empezar
        </Capsule>
      </div>
    </div>
  );
}

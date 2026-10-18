import { CupSoda, Droplet, Moon, Utensils } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { useNavigate } from 'react-router';
import { useLog } from '@/components/forms/log';
import { Bubble, Capsule, LargeTitle } from '@/components/ui/ios';
import { fmtNum } from '@/lib/format';
import { useProfile, useToday } from '@/lib/queries';

export function TodayPage() {
  const today = useToday();
  const log = useLog();
  const navigate = useNavigate();
  const t = today.data;
  const profile = useProfile();

  const sleep = t?.sleep ? `${Math.floor(t.sleep.durationMinutes / 60)}:${String(t.sleep.durationMinutes % 60).padStart(2, '0')}` : '—';

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

      {today.isError && (
        <button onClick={() => today.refetch()} className="mb-6 text-[15px] text-red">
          No se pudo cargar. Toca para reintentar.
        </button>
      )}

      <div className="grid grid-cols-2 gap-5">
        <Bubble label="Agua" tone="tint" icon={<Droplet strokeWidth={1.8} />} value={t ? `${fmtNum(t.hydration.waterMl / 1000)} L` : '—'} onClick={() => log({ kind: 'water' })} />
        <Bubble
          label="Refresco"
          tone="star"
          icon={<CupSoda strokeWidth={1.8} />}
          value={t ? (t.hydration.sodaMaxGlasses !== null ? `${fmtNum(t.hydration.sodaGlasses)}/${t.hydration.sodaMaxGlasses}` : fmtNum(t.hydration.sodaGlasses)) : '—'}
          onClick={() => log({ kind: 'soda' })}
        />
        <Bubble
          label="Sueño"
          icon={<Moon strokeWidth={1.8} />}
          value={sleep}
          onClick={() =>
            log({
              kind: 'sleep',
              edit: t?.sleep ? { ...t.sleep, date: t.date, note: null } : undefined,
            })
          }
        />
        <Bubble label="Comidas" icon={<Utensils strokeWidth={1.8} />} value={t ? t.meals.length : '—'} onClick={() => log({ kind: 'meals' })} />
      </div>

      {t && (
        <div className="mt-10 flex justify-center">
          <Capsule onClick={() => navigate('/actividad')}>
            <span className="text-ink-2 font-normal">Hoy toca</span> {t.activity.label}
          </Capsule>
        </div>
      )}
    </div>
  );
}

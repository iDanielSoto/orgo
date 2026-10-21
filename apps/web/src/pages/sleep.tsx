import { useNavigate } from 'react-router';
import { useLog } from '@/components/forms/log';
import { Capsule, Item, LargeTitle, List } from '@/components/ui/ios';
import { Hero, WeekBars, weekOf } from '@/components/zone';
import { capitalize, fmtDate, fmtDuration } from '@/lib/format';
import { useSleep, useToday } from '@/lib/queries';

const QUALITY = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'];

/** Zona Sueño: la última noche, la semana contra tu meta y tu horario. */
export function SleepPage() {
  const today = useToday();
  const sleep = useSleep(14);
  const log = useLog();
  const navigate = useNavigate();
  const t = today.data;
  const nights = sleep.data ?? [];
  const last = t?.sleep ?? null;
  const goal = (t?.sleepTargetMinHours ?? 7) * 60;
  const week = t ? weekOf(t.date) : [];
  const byDate = (d: string) => {
    const n = nights.filter((x) => x.date === d);
    return n.length ? n.reduce((a, x) => a + x.durationMinutes, 0) : null;
  };
  const logged = week.map(byDate).filter((v): v is number => v !== null);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : null;

  return (
    <div>
      <LargeTitle text="Sueño" />

      <Hero
        value={last ? fmtDuration(last.durationMinutes) : '—'}
        sub={last ? `anoche${last.quality ? ` · ${QUALITY[last.quality]}` : ''}` : 'sin registro de anoche'}
        tone={last && last.durationMinutes >= goal ? 'tint' : undefined}
      />

      <div className="mt-6 flex justify-center">
        {last ? (
          <Capsule onClick={() => log({ kind: 'sleep', edit: { ...last, date: t!.date, note: null } })}>Editar</Capsule>
        ) : (
          <Capsule className="bg-tint text-[#06102a]" onClick={() => log({ kind: 'sleep' })}>
            Registrar
          </Capsule>
        )}
      </div>

      {t && <WeekBars days={week} today={t.date} value={byDate} goal={goal} max={Math.max(goal * 1.35, ...logged)} label="Horas de sueño de la semana" />}

      <div className="mt-10">
        <List>
          <Item label="Promedio" detail={avg !== null ? fmtDuration(avg) : '—'} />
          <Item label="Meta" detail={fmtDuration(goal)} />
          {t && <Item label="Dormir" detail={t.schedule.bed} onClick={() => navigate('/ajustes')} />}
          {t && <Item label="Despertar" detail={t.schedule.wake} onClick={() => navigate('/ajustes')} />}
        </List>
      </div>

      {nights.length > 0 && (
        <div className="mt-10">
          <List header="Noches">
            {nights.slice(0, 10).map((n) => (
              <Item
                key={n.id}
                label={capitalize(fmtDate(n.date, "EEEE d 'de' MMM"))}
                detail={fmtDuration(n.durationMinutes)}
                onClick={() => log({ kind: 'sleep', edit: n })}
              />
            ))}
          </List>
        </div>
      )}
    </div>
  );
}

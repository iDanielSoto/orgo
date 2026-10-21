import { formatMXN } from '@forma/core';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { DayRing } from '@/components/day-ring';
import { HeatWord } from '@/components/portfolio';
import { capitalize, cn, fmtDate, greeting } from '@/lib/format';
import { useFinSummary } from '@/lib/finance';
import { useDays, useProfile, useToday } from '@/lib/queries';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Inicio: saludo y la cifra principal de cada área de Ordo. */
export function HomePage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const today = useToday();
  const fin = useFinSummary();
  const p = profile.data?.profile;
  const t = today.data;
  const now = new Date();

  return (
    <div>
      <header className="flex items-start justify-between gap-3 pt-3">
        <div className="min-w-0">
          <p className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink-2">{greeting(now.getHours() * 60 + now.getMinutes())},</p>
          <HeatWord text={p?.displayName ?? ' '} className="text-[44px] font-bold leading-none tracking-[-0.04em]" />
          {t && <p className="mt-3 text-[17px] text-ink-2">{capitalize(fmtDate(t.date))}</p>}
        </div>
        <button aria-label="Tu perfil" onClick={() => navigate('/perfil')} className="press shrink-0">
          <Avatar version={p?.avatarVersion} size={56} />
        </button>
      </header>

      <div className="mt-10 space-y-4">
        <button onClick={() => navigate('/salud')} className="glass press block w-full rounded-[32px] px-6 py-5 text-left">
          <span className="text-[17px] font-semibold">Salud</span>
          {t ? <HealthWeek today={t.date} /> : <span className="block h-[132px]" />}
        </button>

        <button onClick={() => navigate('/finanzas')} className="glass press block w-full rounded-[32px] px-6 py-5 text-left">
          <span className="text-[17px] font-semibold">Finanzas</span>
          {fin.data ? (
            <>
              <Figure value={formatMXN(fin.data.receivedCents - fin.data.spentCents).replace(/\.00$/, '')} sub="te queda" negative={fin.data.receivedCents < fin.data.spentCents} />
              <span className="mt-1 block text-[15px] text-ink-2">
                Recibiste {formatMXN(fin.data.receivedCents).replace(/\.00$/, '')} y gastaste {formatMXN(fin.data.spentCents).replace(/\.00$/, '')}
              </span>
            </>
          ) : (
            <span className="block h-[78px]" />
          )}
        </button>
      </div>
    </div>
  );
}

function Figure({ value, sub, negative }: { value: string; sub: string; negative?: boolean }) {
  return (
    <span className="mt-1 flex items-baseline gap-2">
      <span className={cn('text-[48px] font-semibold leading-none tracking-[-0.04em] tabular', negative && 'text-red')}>{value}</span>
      <span className="text-[17px] text-ink-2">{sub}</span>
    </span>
  );
}

/** Cumplimiento de hoy y los anillos de la semana (lunes a domingo). */
function HealthWeek({ today }: { today: string }) {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
  const days = useDays(week[0]!, today);
  const byDate = new Map(days.data?.map((d) => [d.date, d.score]));
  const score = byDate.get(today) ?? 0;
  return (
    <>
      <Figure value={`${Math.round(score * 100)} %`} sub="de tu día" />
      <span className="mt-4 grid grid-cols-7 text-center">
        {week.map((d, i) => (
          <span key={d} className={cn('flex flex-col items-center gap-1', d > today && 'opacity-30')}>
            <DayRing score={byDate.get(d)} size={32} />
            <span className={cn('text-[12px] font-medium', d === today ? 'text-tint' : 'text-ink-3')}>{WEEKDAYS[i]}</span>
          </span>
        ))}
      </span>
    </>
  );
}

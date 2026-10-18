import { formatMXN } from '@forma/core';
import { HeartPulse, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { HeatWord } from '@/components/portfolio';
import { capitalize, fmtDate, fmtNum } from '@/lib/format';
import { useFinSummary } from '@/lib/finance';
import { useProfile, useToday } from '@/lib/queries';

/** Inicio: tu perfil y las dos áreas de Ordo. */
export function HomePage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const today = useToday();
  const fin = useFinSummary();
  const p = profile.data?.profile;
  const t = today.data;

  return (
    <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-60px)] flex-col items-center justify-center pb-10 text-center">
      <button aria-label="Tu perfil" onClick={() => navigate('/perfil')} className="press">
        <Avatar version={p?.avatarVersion} size={112} />
      </button>
      <HeatWord text={p?.displayName ?? ' '} className="mt-6 text-[44px] font-bold leading-none tracking-[-0.04em]" />
      {t && <p className="mt-3 text-[17px] text-ink-2">{capitalize(fmtDate(t.date))}</p>}

      <div className="mt-12 grid w-full grid-cols-2 gap-5">
        <Area
          icon={<HeartPulse strokeWidth={1.8} />}
          title="Salud"
          line={t ? (t.hydration.waterGoalMl ? `${fmtNum(t.hydration.waterMl / 1000)} de ${fmtNum(t.hydration.waterGoalMl / 1000)} L` : t.activity.label) : ' '}
          onClick={() => navigate('/salud')}
        />
        <Area
          icon={<Wallet strokeWidth={1.8} />}
          title="Finanzas"
          line={fin.data ? formatMXN(fin.data.availableRealCents).replace(/\.00$/, '') : ' '}
          onClick={() => navigate('/finanzas')}
        />
      </div>
    </div>
  );
}

function Area({ icon, title, line, onClick }: { icon: React.ReactNode; title: string; line: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass press flex aspect-square w-full flex-col items-center justify-center rounded-full">
      <span className="text-ink [&_svg]:size-8">{icon}</span>
      <span className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{title}</span>
      <span className="mt-1 text-[15px] text-ink-2 tabular">{line}</span>
    </button>
  );
}

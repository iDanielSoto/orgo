import { BUCKET_LABEL, formatMXN, type Bucket } from '@forma/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { CategoryBadge } from '@/components/category-icon';
import { useFin } from '@/components/forms/finance-log';
import { Capsule, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { capitalize, cn, fmtDate } from '@/lib/format';
import { monthLabel, shiftMonth, todayKey, useFinSummary, type FinSummary, type FinTx } from '@/lib/finance';
import { useProfile } from '@/lib/queries';

/** "$1,470" sin centavos cuando son cero. */
const compact = (c: number) => formatMXN(c).replace(/\.00$/, '');

type Pace = { tone: 'good' | 'calm' | 'bad'; text: string };

/**
 * Cuánto puedes gastar hoy: lo que te queda del mes (recibido − gastado antes de hoy) repartido
 * entre los días que faltan, incluido hoy, menos lo que ya gastaste hoy. Baja en cuanto registras
 * un gasto. No descuenta el ahorro por apartar: eso se ve en Sobres.
 */
function todayBudget(s: FinSummary) {
  const [y, m] = s.month.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysLeft = daysInMonth - Number(s.today.slice(8, 10)) + 1;
  const left = s.receivedCents - s.spentCents;
  const perDay = Math.floor((left + s.spentTodayCents) / daysLeft / 100) * 100; // pesos enteros
  const canSpend = perDay - s.spentTodayCents;
  const pace: Pace =
    left < 0
      ? { tone: 'bad', text: `Gastaste ${compact(-left)} más de lo que entró` }
      : canSpend < 0
        ? { tone: 'calm', text: `Hoy te pasaste ${compact(-canSpend)} · mañana se ajusta` }
        : { tone: 'good', text: `Vas bien · ${daysLeft === 1 ? 'último día' : `quedan ${daysLeft} días`}` };
  return { canSpend: Math.max(0, canSpend), pace };
}

const TONE: Record<Pace['tone'], string> = { good: 'bg-green', calm: 'bg-star', bad: 'bg-red' };

export function FinanceHomePage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const [month, setMonth] = React.useState<string | undefined>();
  const s = useFinSummary(month);
  const [sheet, setSheet] = React.useState<'sobres' | 'proyeccion' | null>(null);
  const data = s.data;
  const current = data?.month;
  const isNow = data ? data.month === data.today.slice(0, 7) : false;

  return (
    <div>
      <LargeTitle
        text="Finanzas"
        trailing={
          <button aria-label="Inicio" onClick={() => navigate('/')} className="press">
            <Avatar version={profile.data?.profile?.avatarVersion} size={44} />
          </button>
        }
      />

      {current && (
        <div className="-mt-6 mb-8 flex items-center gap-1 text-[17px] text-ink-2">
          <button aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(current, -1))} className="press -ml-2 p-2">
            <ChevronLeft className="size-5" />
          </button>
          <span>{monthLabel(current)}</span>
          <button aria-label="Mes siguiente" disabled={isNow} onClick={() => setMonth(shiftMonth(current, 1))} className="press p-2 disabled:opacity-0">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {s.isError && <p className="text-red">No se pudo cargar.</p>}

      {data && (
        <div className="space-y-10">
          {isNow ? <SpendToday s={data} /> : <MonthResult s={data} />}
          {(data.receivedCents > 0 || data.spentCents > 0) && <MonthBar s={data} />}
          <Movements txs={data.recent} />
          <List>
            <Item label="Sobres" detail={`${data.rule.savingsBp / 100}/${data.rule.fixedBp / 100}/${data.rule.funBp / 100}`} onClick={() => setSheet('sobres')} />
            {isNow && data.projection.daysLeft > 0 && data.projection.incomingCents > 0 && <Item label="Cómo cerrarías el mes" detail={compact(data.projection.endCents)} onClick={() => setSheet('proyeccion')} />}
            <Item label="Importar Excel" onClick={() => navigate('/finanzas/importar')} />
          </List>
        </div>
      )}

      {data && <EnvelopesSheet s={data} open={sheet === 'sobres'} onClose={() => setSheet(null)} />}
      {data && <ProjectionSheet s={data} open={sheet === 'proyeccion'} onClose={() => setSheet(null)} />}
    </div>
  );
}

function SpendToday({ s }: { s: FinSummary }) {
  const fin = useFin();
  if (s.receivedCents === 0 && s.spentCents === 0) {
    return (
      <section className="text-center">
        <p className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">¿Cuánto te entró este mes?</p>
        <p className="mt-2 text-[17px] text-ink-2">Con eso calculo cuánto puedes gastar cada día.</p>
        <Capsule className="mt-6 bg-tint text-[#06102a]" onClick={() => fin({ kind: 'income' })}>
          Registrar ingreso
        </Capsule>
      </section>
    );
  }
  const { canSpend, pace } = todayBudget(s);
  return (
    <section className="text-center">
      <p className="text-[17px] text-ink-2">Puedes gastar hoy</p>
      <p className={cn('mt-2 text-[76px] font-semibold leading-none tracking-[-0.05em] tabular', pace.tone === 'bad' && 'text-red')}>{compact(canSpend)}</p>
      <p className="mt-4 inline-flex items-center gap-2 text-[15px] text-ink-2">
        <span className={cn('size-2.5 rounded-full', TONE[pace.tone])} />
        {pace.text}
      </p>
    </section>
  );
}

/** Meses pasados: con cuánto cerraste. */
function MonthResult({ s }: { s: FinSummary }) {
  const left = s.receivedCents - s.spentCents;
  return (
    <section className="text-center">
      <p className="text-[17px] text-ink-2">{left >= 0 ? 'Te sobró' : 'Te faltó'}</p>
      <p className={cn('mt-2 text-[64px] font-semibold leading-none tracking-[-0.05em] tabular', left < 0 && 'text-red')}>{compact(Math.abs(left))}</p>
    </section>
  );
}

/** Lo gastado contra lo recibido en el mes, y lo que aún va a entrar. */
function MonthBar({ s }: { s: FinSummary }) {
  const navigate = useNavigate();
  const pct = s.receivedCents > 0 ? s.spentCents / s.receivedCents : s.spentCents > 0 ? 1 : 0;
  return (
    <section>
      <div className="h-3 overflow-hidden rounded-full bg-fill">
        <div className={cn('h-full rounded-full transition-[width] duration-700', pct > 1 ? 'bg-red' : pct > 0.85 ? 'bg-star' : 'bg-tint')} style={{ width: `${Math.min(1, pct) * 100}%` }} />
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 text-[15px]">
        <span className="text-ink-2">
          Gastaste <span className="font-semibold text-ink tabular">{compact(s.spentCents)}</span> de {compact(s.receivedCents)}
        </span>
        {s.expectedCents > 0 && (
          <button onClick={() => navigate('/finanzas/movimientos?ver=ingresos')} className="press shrink-0 font-medium text-green tabular">
            +{compact(s.expectedCents)} por recibir
          </button>
        )}
      </div>
    </section>
  );
}

const dayTitle = (d: string) => {
  const today = todayKey();
  const y = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
  return d === today ? 'Hoy' : d === y ? 'Ayer' : capitalize(fmtDate(d, "EEEE d 'de' MMMM"));
};

/** Movimientos del mes agrupados por día, con el ícono de su categoría. */
export function Movements({ txs, empty }: { txs: FinTx[]; empty?: string }) {
  const fin = useFin();
  const days = React.useMemo(() => {
    const map = new Map<string, FinTx[]>();
    for (const t of txs) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()];
  }, [txs]);
  if (!days.length) return empty ? <p className="py-6 text-center text-[17px] text-ink-2">{empty}</p> : null;
  return (
    <div className="space-y-6">
      {days.map(([d, list]) => (
        <List key={d} header={dayTitle(d)}>
          {list.map((t) => (
            <button
              key={t.id}
              onClick={t.kind === 'EXPENSE' ? () => fin({ kind: 'expense', edit: t }) : undefined}
              className={cn('flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left', t.kind === 'EXPENSE' && 'active:bg-white/[0.06]')}
            >
              <CategoryBadge name={t.category} kind={t.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px]">{t.concept}</span>
                {t.category && t.category !== t.concept && <span className="block truncate text-[13px] text-ink-3">{t.category}</span>}
              </span>
              <span className="text-[17px] tabular">
                <TxAmount t={t} />
              </span>
            </button>
          ))}
        </List>
      ))}
    </div>
  );
}

export function TxAmount({ t }: { t: FinTx }) {
  if (t.kind === 'INCOME') return <span className="text-green">+{formatMXN(t.amountCents)}</span>;
  if (t.kind === 'TRANSFER') return <span className="text-ink-2">⇄ {formatMXN(t.amountCents)}</span>;
  if (t.kind === 'ADJUSTMENT') return <span className="text-ink-2">{t.toAccountId ? '+' : '−'}{formatMXN(t.amountCents)}</span>;
  return <span>−{formatMXN(t.amountCents)}</span>;
}

// --- Sobres (regla 70/20/10) ------------------------------------------------------

const BAR: Record<Bucket, string> = { SAVINGS: 'bg-green', FIXED: 'bg-tint', FUN: 'bg-star' };

/** Cada sobre con su barra y una frase normal: cuánto queda o cuánto te pasaste. */
function EnvelopesSheet({ s, open, onClose }: { s: FinSummary; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const phrase = (b: Bucket) => {
    const st = s.buckets[b];
    if (b === 'SAVINGS') {
      const toSet = st.assigned - s.savingsSeparatedCents;
      return toSet > 0 ? `Aparta ${compact(toSet)}` : 'Ya apartaste tu ahorro';
    }
    return st.remaining >= 0 ? `Quedan ${compact(st.remaining)}` : `Te pasaste ${compact(-st.remaining)}`;
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Sobres">
      <div className="space-y-6 px-1">
        {(['FUN', 'FIXED', 'SAVINGS'] as Bucket[]).map((b) => {
          const st = s.buckets[b];
          const used = b === 'SAVINGS' ? s.savingsSeparatedCents : st.used;
          const pct = st.assigned > 0 ? used / st.assigned : used > 0 ? 1 : 0;
          const over = b !== 'SAVINGS' && st.remaining < 0;
          return (
            <section key={b}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[17px] font-semibold">{BUCKET_LABEL[b]}</span>
                <span className={cn('text-[17px] tabular', over ? 'text-red' : 'text-ink-2')}>{phrase(b)}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fill">
                <div className={cn('h-full rounded-full', over ? 'bg-red' : BAR[b])} style={{ width: `${Math.min(1, pct) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-ink-3 tabular">
                {compact(used)} de {compact(st.assigned)}
              </p>
              {over && st.overCauses.length > 0 && (
                <p className="mt-1 text-[13px] text-ink-2">Lo más grande: {st.overCauses.map((c) => `${c.concept} ${compact(c.amountCents)}`).join(' · ')}</p>
              )}
            </section>
          );
        })}
      </div>
      <List>
        <Item label="Cambiar reparto" detail={`${s.rule.savingsBp / 100}/${s.rule.fixedBp / 100}/${s.rule.funBp / 100}`} onClick={() => navigate('/finanzas/presupuesto')} />
      </List>
    </Sheet>
  );
}

/** Con cuánto cerrarías el mes si llegan los ingresos previstos y sigues gastando igual en gustos. */
function ProjectionSheet({ s, open, onClose }: { s: FinSummary; open: boolean; onClose: () => void }) {
  const p = s.projection;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Fin de mes">
      <div className="py-2 text-center">
        <p className="text-[17px] text-ink-2">Cerrarías con</p>
        <p className={cn('mt-1 text-[52px] font-semibold leading-none tracking-[-0.04em] tabular', p.endCents < 0 && 'text-red')}>{compact(p.endCents)}</p>
      </div>
      <List>
        <Item label="Entra en total" detail={`+${compact(p.incomingCents)}`} />
        <Item label="Gastado hasta hoy" detail={`−${compact(p.spentCents)}`} />
        {p.paceCents > 0 && <Item label={`Gustos al ritmo de ahora`} detail={`−${compact(p.paceCents)}`} />}
      </List>
    </Sheet>
  );
}

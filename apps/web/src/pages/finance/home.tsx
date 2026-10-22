import { formatMXN, type Bucket } from '@forma/core';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Receipt,
  ShoppingBag,
  ThumbsUp,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { CategoryBadge } from '@/components/category-icon';
import { StatusPill, TipList, type Tip, type Tone } from '@/components/feedback';
import { useFin } from '@/components/forms/finance-log';
import { Capsule, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { capitalize, cn, fmtDate } from '@/lib/format';
import { monthLabel, shiftMonth, todayKey, useFinSummary, type FinSummary, type FinTx } from '@/lib/finance';
import { useProfile } from '@/lib/queries';

/** "$1,470" sin centavos cuando son cero. */
const compact = (c: number) => formatMXN(c).replace(/\.00$/, '');

type Pace = { tone: Tone; text: string };

const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
};

/** Qué parte del mes ya pasó (1 en meses cerrados). */
const monthElapsed = (s: FinSummary) => (s.month === s.today.slice(0, 7) ? Number(s.today.slice(8, 10)) / daysIn(s.month) : 1);

/**
 * Cuánto puedes gastar hoy: lo que te queda del mes (recibido − gastado antes de hoy) repartido
 * entre los días que faltan, incluido hoy, menos lo que ya gastaste hoy. Baja en cuanto registras
 * un gasto. No descuenta el ahorro por apartar: eso se ve en el acumulado.
 */
function todayBudget(s: FinSummary) {
  const daysLeft = daysIn(s.month) - Number(s.today.slice(8, 10)) + 1;
  const left = s.receivedCents - s.spentCents;
  const perDay = Math.floor((left + s.spentTodayCents) / daysLeft / 100) * 100; // pesos enteros
  const canSpend = perDay - s.spentTodayCents;
  const pace: Pace =
    left < 0
      ? { tone: 'bad', text: `Salieron ${compact(-left)} más de lo que entró` }
      : canSpend < 0
        ? { tone: 'calm', text: `Hoy gastaste ${compact(-canSpend)} de más · mañana se ajusta` }
        : {
            tone: 'good',
            text: [daysLeft === 1 ? 'Último día del mes' : `Quedan ${daysLeft} días`, s.spentTodayCents > 0 && `hoy llevas ${compact(s.spentTodayCents)}`].filter(Boolean).join(' · '),
          };
  return { canSpend: Math.max(0, canSpend), pace, daysLeft };
}

const STATUS: Record<Pace['tone'], string> = { good: 'Vas bien', calm: 'Ve con calma', bad: 'Te pasaste' };

export function FinanceHomePage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const [month, setMonth] = React.useState<string | undefined>();
  const s = useFinSummary(month);
  const [sheet, setSheet] = React.useState<Bucket | 'proyeccion' | null>(null);
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
          {data.ledger.length > 0 && <Accumulated s={data} onOpen={setSheet} />}
          <Tips s={data} onProjection={() => setSheet('proyeccion')} />
          <Movements txs={data.recent} />
          <List>
            <Item label="Importar Excel" onClick={() => navigate('/finanzas/importar')} />
          </List>
        </div>
      )}

      {data && <LedgerSheet s={data} bucket={sheet === 'proyeccion' ? null : sheet} onClose={() => setSheet(null)} />}
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
      <StatusPill tone={pace.tone} label={STATUS[pace.tone]} className="mt-5" />
      <p className="mt-2.5 text-[15px] text-ink-2 tabular">{pace.text}</p>
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

/**
 * Lo gastado contra lo recibido, con una marca de "hoy" en la parte del mes que ya pasó: si la
 * barra va por detrás de la marca, gastas más lento que el mes.
 */
function MonthBar({ s }: { s: FinSummary }) {
  const navigate = useNavigate();
  const pct = s.receivedCents > 0 ? s.spentCents / s.receivedCents : s.spentCents > 0 ? 1 : 0;
  const elapsed = monthElapsed(s);
  const ahead = pct > elapsed + 0.05;
  const isNow = elapsed < 1;
  return (
    <section>
      <div className="relative">
        <div className="h-3.5 overflow-hidden rounded-full bg-fill">
          <div className={cn('h-full rounded-full transition-[width] duration-700', pct > 1 ? 'bg-red' : ahead ? 'bg-star' : 'bg-tint')} style={{ width: `${Math.min(1, pct) * 100}%` }} />
        </div>
        {isNow && (
          <div className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center" style={{ left: `${elapsed * 100}%` }}>
            <span className="h-[26px] w-[3px] rounded-full bg-ink" />
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">hoy</span>
          </div>
        )}
      </div>
      <div className={cn('flex items-baseline justify-between gap-3 text-[15px]', isNow ? 'mt-6' : 'mt-2.5')}>
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

// --- Sobres acumulados (regla 70/20/10) ------------------------------------------

/** Cómo se llama cada sobre en el apartado: Gustos se muestra como lo que tienes disponible. */
const LEDGER_LABEL: Record<Bucket, string> = { SAVINGS: 'Ahorro', FIXED: 'Gastos fijos', FUN: 'Disponible' };
const FILL: Record<Bucket, string> = { SAVINGS: 'bg-green', FIXED: 'bg-tint', FUN: 'bg-star' };

/** Barra de este mes (Ahorro: lo apartado; los demás: lo que queda) y una frase de cómo va. */
function envelopeState(s: FinSummary, b: Bucket) {
  const st = s.buckets[b];
  const isNow = s.month === s.today.slice(0, 7);
  if (b === 'SAVINGS') {
    const toSet = st.assigned - s.savingsSeparatedCents;
    return {
      pct: st.assigned > 0 ? s.savingsSeparatedCents / st.assigned : 0,
      over: false,
      text: st.assigned === 0 ? 'Sin ingresos este mes' : toSet > 0 ? `Falta apartar ${compact(toSet)} de este mes` : 'Ya apartaste lo de este mes',
    };
  }
  // Como un tanque: lleno = intacto, vacío = se acabó lo de este mes.
  const used = st.assigned > 0 ? st.used / st.assigned : st.used > 0 ? 1 : 0;
  const pct = st.assigned > 0 ? Math.max(0, st.remaining) / st.assigned : 0;
  if (st.remaining < 0) return { pct: 1, over: true, text: `Este mes te pasaste ${compact(-st.remaining)}` };
  if (b === 'FUN' && isNow) {
    const daysLeft = daysIn(s.month) - Number(s.today.slice(8, 10)) + 1;
    return { pct, over: false, text: st.remaining > 0 ? `~${compact(Math.floor(st.remaining / daysLeft / 100) * 100)} al día hasta fin de mes` : 'Se acabó lo de este mes' };
  }
  return { pct, over: false, text: st.used === 0 ? 'Intacto este mes' : `Usaste ${Math.round(used * 100)} % de este mes` };
}

/** Lo que llevas en cada sobre sumando todos los meses: lo que no gastas se acumula. */
function Accumulated({ s, onOpen }: { s: FinSummary; onOpen: (b: Bucket) => void }) {
  const bal = s.ledger.at(-1)!.balance;
  return (
    <section>
      <h2 className="text-[22px] font-bold tracking-[-0.02em]">Acumulado</h2>
      <div className="mt-3 overflow-hidden rounded-[26px] bg-[var(--card)] [&>*+*]:border-t [&>*+*]:border-sep">
        {(['SAVINGS', 'FIXED', 'FUN'] as Bucket[]).map((b) => {
          const e = envelopeState(s, b);
          return (
            <button key={b} onClick={() => onOpen(b)} className="block w-full px-5 py-4 text-left active:bg-white/[0.06]">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[17px] font-semibold">{LEDGER_LABEL[b]}</span>
                <span className={cn('text-[22px] font-semibold tracking-[-0.02em] tabular', bal[b] < 0 && 'text-red')}>{compact(bal[b])}</span>
              </span>
              <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-fill">
                <span className={cn('block h-full rounded-full transition-[width] duration-700', e.over ? 'bg-red' : FILL[b])} style={{ width: `${Math.min(1, e.pct) * 100}%` }} />
              </span>
              <span className={cn('mt-2 block text-[14px]', e.over ? 'text-red' : 'text-ink-2')}>{e.text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --- Consejos ---------------------------------------------------------------------

/** Hasta tres consejos sacados de tus números, del más urgente al más amable. */
function Tips({ s, onProjection }: { s: FinSummary; onProjection: () => void }) {
  const navigate = useNavigate();
  const fin = useFin();
  const isNow = s.month === s.today.slice(0, 7);
  const left = s.receivedCents - s.spentCents;
  const pct = s.receivedCents > 0 ? s.spentCents / s.receivedCents : 0;
  const elapsed = monthElapsed(s);
  const toSave = s.buckets.SAVINGS.assigned - s.savingsSeparatedCents;
  const hasSavingsAccount = s.balances.some((b) => b.type === 'SAVINGS');
  const top = s.topCategories[0];
  const next = s.upcoming.find((i) => i.amountCents !== null && i.expectedOn && i.expectedOn >= s.today);
  const out: Tip[] = [];

  if (left < 0) out.push({ icon: TriangleAlert, text: `Este mes salió más de lo que entró. Empieza por tus gastos más grandes.`, action: { label: 'Ver gastos', run: () => navigate('/finanzas/movimientos?ver=gastos') } });
  if (isNow && toSave > 0)
    out.push({
      icon: PiggyBank,
      text: `Mueve ${compact(toSave)} a tu cuenta de ahorro: lo que no ves, no lo gastas.`,
      action: hasSavingsAccount ? { label: 'Apartar', run: () => fin({ kind: 'transfer' }) } : { label: 'Crear cuenta de ahorro', run: () => fin({ kind: 'account' }) },
    });
  if (s.buckets.FIXED.remaining < 0 && top)
    out.push({ icon: Receipt, text: `Tus gastos fijos ya pasan su ${s.rule.fixedBp / 100} %. Lo más grande: ${top.name} (${compact(top.cents)}).` });
  else if (top && s.topCategories.length >= 2 && top.cents / s.spentCents >= 0.3)
    out.push({ icon: ShoppingBag, text: `${top.name} se llevó el ${Math.round((top.cents / s.spentCents) * 100)} % de tus gastos (${compact(top.cents)}).` });
  if (isNow && next) out.push({ icon: CalendarClock, text: `${next.name} llega el ${fmtDate(next.expectedOn!, "d 'de' MMMM")}: +${compact(next.amountCents!)}.` });
  if (isNow && left >= 0 && pct + 0.05 < elapsed && s.receivedCents > 0)
    out.push({ icon: ThumbsUp, text: `Va el ${Math.round(elapsed * 100)} % del mes y has gastado el ${Math.round(pct * 100)} % de lo que entró. Sigue así.` });
  if (isNow && s.projection.daysLeft > 0 && s.projection.incomingCents > 0)
    out.push({ icon: TrendingUp, text: `A este ritmo cerrarías el mes con ${compact(s.projection.endCents)}.`, action: { label: 'Ver cálculo', run: onProjection } });

  return <TipList tips={out} />;
}

/** Un sobre mes por mes: lo que entró, lo que salió y con cuánto cerró. */
function LedgerSheet({ s, bucket, onClose }: { s: FinSummary; bucket: Bucket | null; onClose: () => void }) {
  const navigate = useNavigate();
  const b = bucket ?? 'SAVINGS';
  const months = [...s.ledger].reverse();
  const total = s.ledger.at(-1)?.balance[b] ?? 0;
  const now = s.ledger.find((m) => m.month === s.month);
  return (
    <Sheet open={bucket !== null} onOpenChange={(o) => !o && onClose()} title={LEDGER_LABEL[b]}>
      <div className="py-2 text-center">
        <p className="text-[17px] text-ink-2">Llevas</p>
        <p className={cn('mt-1 text-[52px] font-semibold leading-none tracking-[-0.04em] tabular', total < 0 && 'text-red')}>{compact(total)}</p>
        {now && (
          <p className="mt-3 text-[15px] text-ink-2 tabular">
            Este mes +{compact(now.in[b])} · −{compact(now.out[b])}
          </p>
        )}
      </div>
      <List header="Mes por mes">
        {months.map((m) => (
          <div key={m.month} className="flex min-h-[60px] items-center gap-3 px-5 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[17px]">{capitalize(monthLabel(m.month))}</span>
              <span className="block text-[13px] text-ink-3 tabular">
                +{compact(m.in[b])} · −{compact(m.out[b])}
              </span>
            </span>
            <span className={cn('text-[17px] tabular', m.balance[b] < 0 ? 'text-red' : 'text-ink')}>{compact(m.balance[b])}</span>
          </div>
        ))}
      </List>
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

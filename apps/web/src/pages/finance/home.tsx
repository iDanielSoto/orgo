import { BUCKET_LABEL, formatMXN, type Bucket } from '@forma/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { GlassBubble, Liquid } from '@/components/bubbles';
import { useFin } from '@/components/forms/finance-log';
import { Capsule, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { cn, fmtDate } from '@/lib/format';
import { monthLabel, shiftMonth, useFinSummary, type FinSummary, type FinTx } from '@/lib/finance';
import { useProfile } from '@/lib/queries';

const BUCKET_COLOR: Record<Bucket, string> = {
  SAVINGS: 'rgba(48,209,88,0.5)',
  FIXED: 'rgba(92,160,255,0.55)',
  FUN: 'rgba(255,190,60,0.5)',
};
const SHORT: Record<Bucket, string> = { SAVINGS: 'Ahorro', FIXED: 'Fijos', FUN: 'Gustos' };

/** "$1,470" sin centavos cuando son cero, para que quepa en la burbuja. */
const compact = (c: number) => formatMXN(c).replace(/\.00$/, '');

export function FinanceHomePage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const fin = useFin();
  const [month, setMonth] = React.useState<string | undefined>();
  const s = useFinSummary(month);
  const [bucket, setBucket] = React.useState<Bucket | null>(null);
  const data = s.data;
  const current = data?.month;

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
        <div className="-mt-5 mb-6 flex items-center gap-1 text-[17px] text-ink-2">
          <button aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(current, -1))} className="press -ml-2 p-2">
            <ChevronLeft className="size-5" />
          </button>
          <span>{monthLabel(current)}</span>
          <button aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(current, 1))} className="press p-2">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {s.isError && <p className="text-red">No se pudo cargar.</p>}

      {data && (
        <div className="space-y-8">
          <section>
            <p className="text-[15px] text-ink-2">Te queda este mes</p>
            <p className="mt-1 text-[48px] font-semibold leading-none tracking-[-0.04em] tabular">{formatMXN(data.receivedCents - data.spentCents)}</p>
            <p className="mt-2 text-[15px] text-ink-2">
              Recibiste {compact(data.receivedCents)} y gastaste {compact(data.spentCents)}
            </p>
            {data.balances.length === 0 || data.availableRealCents === 0 ? (
              <button onClick={() => navigate('/finanzas/cuentas')} className="mt-1 text-[15px] font-medium text-ink underline decoration-white/50 underline-offset-4">
                {data.balances.length === 0 ? 'Agrega tus cuentas para ver tu dinero real' : 'Registra el saldo de tus cuentas'}
              </button>
            ) : (
              <p className="mt-1 text-[15px] text-ink-2">
                En tus cuentas {formatMXN(data.availableRealCents)}
                {data.creditDebtCents > 0 && ` · debes ${formatMXN(data.creditDebtCents)} en tarjetas`}
              </p>
            )}
          </section>

          {/* Presupuestos 70/20/10 */}
          <section className="grid grid-cols-3 gap-3">
            {(['SAVINGS', 'FIXED', 'FUN'] as Bucket[]).map((b) => {
              const st = data.buckets[b];
              const left = st.assigned > 0 ? Math.max(0, st.remaining) / st.assigned : 0;
              return (
                <div key={b} className="flex flex-col items-center">
                  <div className="w-full">
                    <GlassBubble
                      ariaLabel={BUCKET_LABEL[b]}
                      onClick={() => setBucket(b)}
                      label={compact(st.remaining)}
                      sub={st.over > 0 ? 'excedido' : b === 'SAVINGS' ? 'para ahorrar' : 'disponible'}
                      className="size-auto aspect-square w-full"
                      labelClassName="text-[17px]"
                    >
                      <Liquid pct={left} color={st.over > 0 ? 'rgba(255,107,94,0.4)' : BUCKET_COLOR[b]} />
                    </GlassBubble>
                  </div>
                  <span className="mt-2 text-[15px] font-medium">{SHORT[b]}</span>
                </div>
              );
            })}
          </section>

          <List>
            <Item label="Recibido" detail={formatMXN(data.receivedCents)} />
            <Item
              label="Por recibir"
              detail={`${formatMXN(data.expectedCents)}${data.expectedUnknown ? ` + ${data.expectedUnknown} sin importe` : ''}`}
              onClick={() => navigate('/finanzas/movimientos?ver=ingresos')}
            />
            <Item label="Gastado" detail={formatMXN(data.spentCents)} onClick={() => navigate('/finanzas/movimientos?ver=gastos')} />
            <Item label="Ya apartado en ahorro" detail={`${formatMXN(data.savingsSeparatedCents)} de ${formatMXN(data.buckets.SAVINGS.assigned)}`} />
          </List>

          {data.projection.daysLeft > 0 && data.projection.incomingCents + data.projection.spentCents > 0 && <Projection s={data} />}

          {data.upcoming.length > 0 && (
            <List header="Próximos ingresos">
              {data.upcoming.map((i) => (
                <Item
                  key={i.id}
                  label={i.name}
                  detail={`${i.amountCents !== null ? formatMXN(i.amountCents) : 'sin importe'}${i.expectedOn ? ` · ${fmtDate(i.expectedOn, 'd MMM')}` : ''}`}
                  onClick={() => fin({ kind: 'income', edit: i, receive: true })}
                />
              ))}
            </List>
          )}

          <Recent txs={data.recent} />

          <div className="flex justify-center gap-3">
            <Capsule onClick={() => navigate('/finanzas/presupuesto')}>
              {data.rule.savingsBp / 100}/{data.rule.fixedBp / 100}/{data.rule.funBp / 100}
            </Capsule>
            <Capsule onClick={() => navigate('/finanzas/importar')}>Importar Excel</Capsule>
          </div>
        </div>
      )}

      {data && bucket && <BucketSheet s={data} bucket={bucket} onClose={() => setBucket(null)} />}
    </div>
  );
}

/** Con cuánto cerrarías el mes si llegan los ingresos previstos y sigues gastando igual en gustos. */
function Projection({ s }: { s: FinSummary }) {
  const p = s.projection;
  const month = monthLabel(s.month).split(' ')[0]!.toLowerCase();
  const tone = (c: number) => (c < 0 ? 'text-red' : undefined);
  return (
    <section>
      <p className="px-4 pb-2 text-[13px] uppercase tracking-wide text-ink-2">Proyección a fin de {month}</p>
      <div className="glass rounded-[26px] px-5 py-5">
        <p className="text-[15px] text-ink-2">Cerrarías con</p>
        <p className={cn('mt-1 text-[36px] font-semibold leading-none tracking-[-0.03em] tabular', tone(p.endCents))}>{formatMXN(p.endCents)}</p>
        <div className="mt-4 space-y-2 text-[15px]">
          <Row label="Entra en total" value={`+${formatMXN(p.incomingCents)}`} />
          <Row label="Gastado hasta hoy" value={`−${formatMXN(p.spentCents)}`} />
          {p.paceCents > 0 && <Row label={`Gustos estimados · ${p.daysLeft} ${p.daysLeft === 1 ? 'día' : 'días'}`} value={`−${formatMXN(p.paceCents)}`} />}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-sep pt-4 text-center">
          {(['SAVINGS', 'FIXED', 'FUN'] as Bucket[]).map((b) => (
            <div key={b}>
              <p className={cn('text-[17px] font-semibold tabular', tone(p.buckets[b]))}>{compact(p.buckets[b])}</p>
              <p className="text-[13px] text-ink-2">{SHORT[b]}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-snug text-ink-2">
          Cuenta los ingresos por recibir con importe
          {s.expectedUnknown > 0 && ` (${s.expectedUnknown} sin importe no se cuenta${s.expectedUnknown === 1 ? '' : 'n'})`} y estima tus gustos al ritmo que llevas este mes.
        </p>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function Recent({ txs }: { txs: FinTx[] }) {
  const fin = useFin();
  if (txs.length === 0) return null;
  return (
    <List header="Movimientos recientes">
      {txs.map((t) => (
        <Item
          key={t.id}
          label={t.concept}
          detail={<TxAmount t={t} />}
          onClick={t.kind === 'EXPENSE' ? () => fin({ kind: 'expense', edit: t }) : undefined}
        />
      ))}
    </List>
  );
}

export function TxAmount({ t }: { t: FinTx }) {
  if (t.kind === 'INCOME') return <span className="text-green">+{formatMXN(t.amountCents)}</span>;
  if (t.kind === 'TRANSFER') return <span className="text-ink-2">⇄ {formatMXN(t.amountCents)}</span>;
  if (t.kind === 'ADJUSTMENT') return <span className="text-ink-2">{t.toAccountId ? '+' : '−'}{formatMXN(t.amountCents)}</span>;
  return <span>−{formatMXN(t.amountCents)}</span>;
}

function BucketSheet({ s, bucket, onClose }: { s: FinSummary; bucket: Bucket; onClose: () => void }) {
  const st = s.buckets[bucket];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={BUCKET_LABEL[bucket]}>
      <p className="text-center text-[44px] font-semibold tracking-[-0.03em] tabular">{formatMXN(st.remaining)}</p>
      <List>
        <Item label="Asignado" detail={formatMXN(st.assigned)} />
        <Item label="Usado" detail={formatMXN(st.used)} />
        <Item label="Uso" detail={st.usage === null ? '—' : `${Math.round(st.usage * 100)} %`} />
      </List>
      {st.over > 0 && (
        <List header={`Excedido por ${formatMXN(st.over)}`}>
          {st.overCauses.map((c, i) => (
            <Item key={i} label={c.concept} detail={formatMXN(c.amountCents)} />
          ))}
        </List>
      )}
    </Sheet>
  );
}

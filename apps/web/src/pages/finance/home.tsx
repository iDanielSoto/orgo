import { BUCKET_LABEL, formatMXN, type Bucket } from '@forma/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/avatar';
import { GlassBubble, Liquid } from '@/components/bubbles';
import { useFin } from '@/components/forms/finance-log';
import { Capsule, Item, LargeTitle, List, Sheet } from '@/components/ui/ios';
import { fmtDate } from '@/lib/format';
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
            <p className="text-[15px] text-ink-2">Disponible real</p>
            <p className="mt-1 text-[48px] font-semibold leading-none tracking-[-0.04em] tabular">{formatMXN(data.availableRealCents)}</p>
            {data.balances.length === 0 ? (
              <button onClick={() => navigate('/finanzas/cuentas')} className="mt-2 text-[15px] text-tint">
                Agrega tus cuentas para ver tu saldo
              </button>
            ) : (
              data.creditDebtCents > 0 && <p className="mt-1 text-[15px] text-ink-2">Debes {formatMXN(data.creditDebtCents)} en tarjetas</p>
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
                      sub={st.over > 0 ? 'excedido' : 'disponible'}
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
            <Item label="Ahorro separado" detail={`${formatMXN(data.savingsSeparatedCents)} de ${formatMXN(data.buckets.SAVINGS.assigned)}`} />
          </List>

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

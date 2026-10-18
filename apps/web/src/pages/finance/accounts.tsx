import { formatMXN } from '@forma/core';
import { Plus } from 'lucide-react';
import { useFin } from '@/components/forms/finance-log';
import { Capsule, GlassCircle, Item, LargeTitle, List } from '@/components/ui/ios';
import { ACCOUNT_LABEL, useAccounts } from '@/lib/finance';

export function AccountsPage() {
  const accounts = useAccounts();
  const fin = useFin();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const archived = (accounts.data ?? []).filter((a) => a.archived);
  const total = active.filter((a) => a.type !== 'CREDIT').reduce((s, a) => s + a.balanceCents, 0);

  return (
    <div className="space-y-8">
      <LargeTitle
        text="Cuentas"
        trailing={
          <GlassCircle aria-label="Nueva cuenta" onClick={() => fin({ kind: 'account' })}>
            <Plus />
          </GlassCircle>
        }
      />
      {accounts.data && active.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[19px]">Aún no hay cuentas</p>
          <p className="mt-1 text-ink-2">Registra dónde tienes tu dinero con su saldo real.</p>
          <div className="mt-6 flex justify-center">
            <Capsule onClick={() => fin({ kind: 'account' })}>Agregar cuenta</Capsule>
          </div>
        </div>
      ) : (
        <>
          <section className="-mt-4">
            <p className="text-[15px] text-ink-2">En cuentas</p>
            <p className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular">{formatMXN(total)}</p>
          </section>
          <List>
            {active.map((a) => (
              <Item
                key={a.id}
                label={
                  <span>
                    {a.name}
                    <span className="block text-[13px] text-ink-3">{ACCOUNT_LABEL[a.type]}</span>
                  </span>
                }
                detail={<span className={a.balanceCents < 0 ? 'text-red' : undefined}>{formatMXN(a.balanceCents)}</span>}
                onClick={() => fin({ kind: 'account', edit: a })}
              />
            ))}
          </List>
          {active.length >= 2 && (
            <div className="flex justify-center">
              <Capsule onClick={() => fin({ kind: 'transfer' })}>Transferir entre cuentas</Capsule>
            </div>
          )}
        </>
      )}
      {archived.length > 0 && (
        <List header="Archivadas">
          {archived.map((a) => (
            <Item key={a.id} label={a.name} detail={formatMXN(a.balanceCents)} onClick={() => fin({ kind: 'account', edit: a })} />
          ))}
        </List>
      )}
    </div>
  );
}

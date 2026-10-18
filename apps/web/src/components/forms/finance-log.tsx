import { allocate, BUCKET_LABEL, formatMXN, toCents, type Bucket, type Split } from '@forma/core';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';
import { BigNumber, Item, List, Segmented, Sheet, Switch, TextItem } from '@/components/ui/ios';
import { api, newId } from '@/lib/api';
import {
  ACCOUNT_LABEL,
  fk,
  INCOME_TYPE_LABEL,
  todayKey,
  useAccounts,
  useCategories,
  useFinSummary,
  useSuggestions,
  type AccountType,
  type FinAccount,
  type FinIncome,
  type FinSummary,
  type FinTx,
  type IncomeType,
} from '@/lib/finance';
import { cn } from '@/lib/format';
import { useAction } from '@/lib/queries';

export type FinRequest =
  | { kind: 'expense'; edit?: FinTx }
  | { kind: 'income'; edit?: FinIncome; receive?: boolean }
  | { kind: 'transfer' }
  | { kind: 'account'; edit?: FinAccount };

const FinContext = React.createContext<(r: FinRequest) => void>(() => undefined);
export const useFin = () => React.useContext(FinContext);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = React.useState<FinRequest | null>(null);
  const [open, setOpen] = React.useState(false);
  const [n, setN] = React.useState(0);
  const show = React.useCallback((r: FinRequest) => {
    setReq(r);
    setN((x) => x + 1);
    setOpen(true);
  }, []);
  const p = { open, onOpenChange: setOpen, onClose: () => setOpen(false) };
  return (
    <FinContext.Provider value={show}>
      {children}
      <React.Fragment key={n}>
        {req?.kind === 'expense' && <ExpenseSheet {...p} edit={req.edit} />}
        {req?.kind === 'income' && <IncomeSheet {...p} edit={req.edit} receive={req.receive} />}
        {req?.kind === 'transfer' && <TransferSheet {...p} />}
        {req?.kind === 'account' && <AccountSheet {...p} edit={req.edit} />}
      </React.Fragment>
    </FinContext.Provider>
  );
}

interface SheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClose: () => void;
}

// --- Piezas -------------------------------------------------------------------------

export function Chips<T extends string>({ value, onChange, options }: { value: T | null; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors', value === o.value ? 'bg-white text-black' : 'glass text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-h-[52px] items-center gap-3 px-5 py-2">
      <span className="flex-1 text-[17px]">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-[10px] bg-white/[0.1] px-3 py-1.5 text-[17px] text-ink" />
    </label>
  );
}

const parseAmount = (s: string): number | null => {
  try {
    const c = toCents(s || '0');
    return c > 0 ? c : null;
  } catch {
    return null;
  }
};
const centsToInput = (c: number | null | undefined) => (c ? (c / 100).toFixed(2).replace(/\.00$/, '') : '');

export const BUCKET_OPTIONS: { value: Bucket; label: string }[] = [
  { value: 'FIXED', label: 'Fijos' },
  { value: 'FUN', label: 'Gustos' },
  { value: 'SAVINGS', label: 'Ahorro' },
];

function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: fk.all });
}

/** Última cuenta usada (comodidad en este dispositivo; la fuente de verdad es el servidor). */
const LAST_ACCOUNT = 'ordo.lastAccount';
const lastAccount = () => {
  try {
    return localStorage.getItem(LAST_ACCOUNT);
  } catch {
    return null;
  }
};
const rememberAccount = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST_ACCOUNT, id);
  } catch {
    /* sin almacenamiento */
  }
};

// --- Gasto --------------------------------------------------------------------------

function ExpenseSheet({ open, onOpenChange, onClose, edit }: SheetProps & { edit?: FinTx }) {
  const accounts = useAccounts();
  const cats = useCategories();
  const sugg = useSuggestions();
  const qc = useQueryClient();
  const invalidate = useInvalidateFinance();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const [amount, setAmount] = React.useState(centsToInput(edit?.amountCents));
  const [concept, setConcept] = React.useState(edit?.concept ?? '');
  const [bucket, setBucket] = React.useState<Bucket>(edit && edit.bucket !== 'NONE' ? edit.bucket : 'FIXED');
  const [bucketTouched, setBucketTouched] = React.useState(Boolean(edit));
  const [categoryId, setCategoryId] = React.useState<string | null>(edit?.categoryId ?? null);
  const [accountId, setAccountId] = React.useState<string | null>(edit?.accountId ?? lastAccount());
  const [date, setDate] = React.useState(edit?.date ?? todayKey());
  const cents = parseAmount(amount);
  const accountValid = !accountId || active.some((a) => a.id === accountId);

  const save = useAction(
    async () => {
      const body = { amountCents: cents!, concept: concept.trim(), bucket, categoryId, accountId: accountValid ? accountId : null, date };
      if (edit) await api.patch(`/finance/transactions/${edit.id}`, body);
      else await api.post('/finance/transactions', { id: newId(), kind: 'EXPENSE', ...body });
      rememberAccount(body.accountId);
    },
    {
      invalidate: [],
      onSuccess: async () => {
        await invalidate();
        // Confirmación con lo que queda en ese presupuesto.
        const s = await qc.fetchQuery({ queryKey: fk.summary(undefined), queryFn: () => api.get<FinSummary>('/finance/summary') });
        const b = s.buckets[bucket];
        toast.success(b.remaining >= 0 ? `${BUCKET_LABEL[bucket]}: quedan ${formatMXN(b.remaining)}` : `${BUCKET_LABEL[bucket]}: excedido por ${formatMXN(-b.remaining)}`);
        onClose();
      },
    },
  );
  const del = useAction(() => api.del(`/finance/transactions/${edit!.id}`), { success: 'Gasto eliminado', invalidate: [fk.all], onSuccess: onClose });

  const pickCategory = (id: string) => {
    setCategoryId(id);
    const c = cats.data?.find((x) => x.id === id);
    if (c && !bucketTouched && c.defaultBucket !== 'NONE') setBucket(c.defaultBucket);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={edit ? 'Gasto' : 'Nuevo gasto'} onDone={() => save.mutate(undefined)} doneDisabled={!cents || !concept.trim() || save.isPending}>
      <BigNumber value={amount} onChange={setAmount} unit="MXN" decimal />
      <List>
        <TextItem placeholder="Concepto" value={concept} maxLength={120} onChange={(e) => setConcept(e.target.value)} autoFocus={false} />
      </List>
      {!edit && (sugg.data?.length ?? 0) > 0 && (
        <Chips
          value={null}
          onChange={(c) => {
            const s = sugg.data!.find((x) => x.concept === c)!;
            setConcept(s.concept);
            if (s.categoryId) setCategoryId(s.categoryId);
            if (s.bucket !== 'NONE') {
              setBucket(s.bucket);
              setBucketTouched(true);
            }
            if (!amount && s.lastAmountCents) setAmount(centsToInput(s.lastAmountCents));
          }}
          options={sugg.data!.map((s) => ({ value: s.concept, label: s.concept }))}
        />
      )}
      <Segmented
        value={bucket}
        onChange={(b) => {
          setBucket(b);
          setBucketTouched(true);
        }}
        options={BUCKET_OPTIONS}
      />
      {cats.data && <Chips value={categoryId} onChange={pickCategory} options={cats.data.map((c) => ({ value: c.id, label: c.name }))} />}
      {active.length > 0 && <Chips value={accountValid ? accountId : null} onChange={setAccountId} options={active.map((a) => ({ value: a.id, label: a.name }))} />}
      <List>
        <DateRow label="Fecha" value={date} onChange={setDate} />
        {edit && <Item label="Eliminar" destructive onClick={() => confirm('¿Eliminar este gasto?') && del.mutate(undefined)} />}
      </List>
    </Sheet>
  );
}

// --- Ingreso --------------------------------------------------------------------------

function IncomeSheet({ open, onOpenChange, onClose, edit, receive }: SheetProps & { edit?: FinIncome; receive?: boolean }) {
  const accounts = useAccounts();
  const summary = useFinSummary();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const [amount, setAmount] = React.useState(centsToInput(edit?.amountCents));
  const [name, setName] = React.useState(edit?.name ?? '');
  const [type, setType] = React.useState<IncomeType>(edit?.type ?? 'SALARY');
  const [status, setStatus] = React.useState<'RECEIVED' | 'PLANNED'>(receive ? 'RECEIVED' : edit?.status === 'PLANNED' ? 'PLANNED' : 'RECEIVED');
  const [date, setDate] = React.useState(edit?.receivedOn ?? edit?.expectedOn ?? todayKey());
  const [accountId, setAccountId] = React.useState<string | null>(edit?.accountId ?? lastAccount());
  const [custom, setCustom] = React.useState(Boolean(edit?.split));
  const [split, setSplit] = React.useState<Split>(edit?.split ?? summary.data?.rule ?? { savingsBp: 7000, fixedBp: 2000, funBp: 1000 });
  React.useEffect(() => {
    if (!custom && summary.data) setSplit(summary.data.rule);
  }, [summary.data, custom]);
  const cents = parseAmount(amount);
  const sum = split.savingsBp + split.fixedBp + split.funBp;
  const accountValid = !accountId || active.some((a) => a.id === accountId);
  const preview = cents && sum === 10000 ? allocate(cents, split) : null;

  const save = useAction(
    async () => {
      const body = {
        name: name.trim(),
        amountCents: cents,
        type,
        status,
        receivedOn: status === 'RECEIVED' ? date : null,
        expectedOn: status === 'PLANNED' ? date : (edit?.expectedOn ?? date),
        accountId: accountValid ? accountId : null,
        split: custom ? split : null,
      };
      if (edit) await api.patch(`/finance/incomes/${edit.id}`, body);
      else await api.post('/finance/incomes', { id: newId(), ...body });
      rememberAccount(body.accountId);
    },
    { success: status === 'RECEIVED' ? 'Ingreso registrado y distribuido' : 'Ingreso previsto guardado', invalidate: [fk.all], onSuccess: onClose },
  );
  const del = useAction(() => api.del(`/finance/incomes/${edit!.id}`), { success: 'Ingreso eliminado', invalidate: [fk.all], onSuccess: onClose });
  const pct = (bp: number) => String(bp / 100);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? 'Ingreso' : 'Nuevo ingreso'}
      onDone={() => save.mutate(undefined)}
      doneDisabled={!name.trim() || (status === 'RECEIVED' && !cents) || (custom && sum !== 10000) || save.isPending}
    >
      <BigNumber value={amount} onChange={setAmount} unit="MXN" decimal />
      <Segmented value={status} onChange={setStatus} options={[{ value: 'RECEIVED', label: 'Recibido' }, { value: 'PLANNED', label: 'Previsto' }]} />
      <List>
        <TextItem placeholder="Nombre (p. ej. Sueldo 23 oct)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <DateRow label={status === 'RECEIVED' ? 'Recibido el' : 'Esperado el'} value={date} onChange={setDate} />
      </List>
      <Chips value={type} onChange={setType} options={(Object.keys(INCOME_TYPE_LABEL) as IncomeType[]).map((t) => ({ value: t, label: INCOME_TYPE_LABEL[t] }))} />
      {active.length > 0 ? (
        <Chips value={accountValid ? accountId : null} onChange={setAccountId} options={active.map((a) => ({ value: a.id, label: a.name }))} />
      ) : (
        <p className="px-2 text-[15px] text-ink-2">Sin cuenta: se cuenta en tu presupuesto, pero no en tu saldo.</p>
      )}

      {/* Distribución inmediata */}
      {status === 'RECEIVED' && (
        <List header="Distribución">
          {preview ? (
            <>
              <Item label={`Ahorro · ${pct(split.savingsBp)} %`} detail={formatMXN(preview.SAVINGS)} />
              <Item label={`Gastos fijos · ${pct(split.fixedBp)} %`} detail={formatMXN(preview.FIXED)} />
              <Item label={`Gustos · ${pct(split.funBp)} %`} detail={formatMXN(preview.FUN)} />
            </>
          ) : (
            <Item label={<span className="text-ink-2">{sum !== 10000 ? `Los porcentajes suman ${sum / 100} %` : 'Escribe el importe'}</span>} />
          )}
          <Switch label="Porcentajes propios" checked={custom} onChange={setCustom} />
          {custom && (
            <div className="grid grid-cols-3 gap-2 px-4 pb-3">
              {(['savingsBp', 'fixedBp', 'funBp'] as const).map((k) => (
                <label key={k} className="rounded-[14px] bg-white/[0.08] px-3 py-2">
                  <span className="block text-[12px] text-ink-3">{k === 'savingsBp' ? 'Ahorro' : k === 'fixedBp' ? 'Fijos' : 'Gustos'}</span>
                  <input
                    inputMode="decimal"
                    value={pct(split[k])}
                    onChange={(e) => setSplit({ ...split, [k]: Math.round(Number(e.target.value.replace(/[^\d.]/g, '') || 0) * 100) })}
                    className="w-full bg-transparent text-[20px] font-semibold text-ink focus:outline-none"
                  />
                </label>
              ))}
            </div>
          )}
        </List>
      )}
      {edit && (
        <List>
          <Item label="Eliminar" destructive onClick={() => confirm('¿Eliminar este ingreso?') && del.mutate(undefined)} />
        </List>
      )}
    </Sheet>
  );
}

// --- Transferencia ----------------------------------------------------------------------

function TransferSheet({ open, onOpenChange, onClose }: SheetProps) {
  const accounts = useAccounts();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const [amount, setAmount] = React.useState('');
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(todayKey());
  const cents = parseAmount(amount);
  const toAcc = active.find((a) => a.id === to);
  const save = useAction(
    () =>
      api.post('/finance/transactions', {
        id: newId(),
        kind: 'TRANSFER',
        amountCents: cents,
        date,
        concept: toAcc?.type === 'SAVINGS' ? 'Ahorro separado' : toAcc?.type === 'CREDIT' ? 'Pago de tarjeta' : 'Transferencia',
        accountId: from,
        toAccountId: to,
      }),
    { success: 'Transferencia registrada', invalidate: [fk.all], onSuccess: onClose },
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Transferencia" onDone={() => save.mutate(undefined)} doneDisabled={!cents || !from || !to || from === to || save.isPending}>
      <BigNumber value={amount} onChange={setAmount} unit="MXN" decimal />
      {active.length < 2 ? (
        <p className="px-2 text-center text-[15px] text-ink-2">Necesitas al menos dos cuentas.</p>
      ) : (
        <>
          <p className="px-1 text-[13px] uppercase tracking-wide text-ink-3">Desde</p>
          <Chips value={from} onChange={setFrom} options={active.map((a) => ({ value: a.id, label: a.name }))} />
          <p className="px-1 text-[13px] uppercase tracking-wide text-ink-3">Hacia</p>
          <Chips value={to} onChange={setTo} options={active.filter((a) => a.id !== from).map((a) => ({ value: a.id, label: a.name }))} />
        </>
      )}
      <List>
        <DateRow label="Fecha" value={date} onChange={setDate} />
      </List>
    </Sheet>
  );
}

// --- Cuenta ------------------------------------------------------------------------------

function AccountSheet({ open, onOpenChange, onClose, edit }: SheetProps & { edit?: FinAccount }) {
  const [name, setName] = React.useState(edit?.name ?? '');
  const [type, setType] = React.useState<AccountType | null>(edit?.type ?? null);
  const [opening, setOpening] = React.useState(edit ? centsToInput(Math.abs(edit.openingBalanceCents)) : '');
  const [owes, setOwes] = React.useState(edit ? edit.openingBalanceCents < 0 : false);
  const openingCents = (() => {
    try {
      return toCents(opening || '0');
    } catch {
      return null;
    }
  })();
  const save = useAction(
    () =>
      edit
        ? api.patch(`/finance/accounts/${edit.id}`, { name: name.trim() })
        : api.post('/finance/accounts', { id: newId(), name: name.trim(), type, openingBalanceCents: (owes ? -1 : 1) * (openingCents ?? 0), openedOn: todayKey() }),
    { success: edit ? 'Cuenta actualizada' : 'Cuenta creada', invalidate: [fk.all], onSuccess: onClose },
  );
  const archive = useAction(() => api.patch(`/finance/accounts/${edit!.id}`, { archived: !edit!.archived }), {
    success: edit?.archived ? 'Cuenta restaurada' : 'Cuenta archivada',
    invalidate: [fk.all],
    onSuccess: onClose,
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={edit ? 'Cuenta' : 'Nueva cuenta'} onDone={() => save.mutate(undefined)} doneDisabled={!name.trim() || !type || openingCents === null || save.isPending}>
      <List>
        <TextItem autoFocus={!edit} placeholder="Nombre (p. ej. BBVA, Efectivo)" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </List>
      {!edit && (
        <>
          <Chips value={type} onChange={setType} options={(Object.keys(ACCOUNT_LABEL) as AccountType[]).map((t) => ({ value: t, label: ACCOUNT_LABEL[t] }))} />
          <p className="px-1 text-[13px] uppercase tracking-wide text-ink-3">Saldo actual real</p>
          <BigNumber value={opening} onChange={setOpening} unit="MXN" decimal />
          {type === 'CREDIT' && <Switch label="Es deuda (lo que debes en la tarjeta)" checked={owes} onChange={setOwes} />}
        </>
      )}
      {edit && (
        <List>
          <Item label={edit.archived ? 'Restaurar' : 'Archivar'} destructive={!edit.archived} onClick={() => archive.mutate(undefined)} />
        </List>
      )}
    </Sheet>
  );
}

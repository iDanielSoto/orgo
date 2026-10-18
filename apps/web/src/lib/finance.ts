import { useQuery } from '@tanstack/react-query';
import type { Allocation, Bucket, Split } from '@forma/core';
import { api } from './api';

export type AccountType = 'CASH' | 'BANK' | 'DEBIT' | 'SAVINGS' | 'WALLET' | 'CREDIT';
export type TxKind = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT';

export const ACCOUNT_LABEL: Record<AccountType, string> = {
  CASH: 'Efectivo',
  BANK: 'Cuenta bancaria',
  DEBIT: 'Débito',
  SAVINGS: 'Ahorro',
  WALLET: 'Billetera digital',
  CREDIT: 'Tarjeta de crédito',
};

export const INCOME_TYPE_LABEL = {
  SALARY: 'Sueldo',
  SCHOLARSHIP: 'Beca',
  PRIZE: 'Premio',
  SALE: 'Venta',
  FREELANCE: 'Independiente',
  GIFT: 'Regalo',
  REFUND: 'Reembolso',
  OTHER: 'Otro',
} as const;
export type IncomeType = keyof typeof INCOME_TYPE_LABEL;

export interface FinAccount {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceCents: number;
  openedOn: string;
  archived: boolean;
  balanceCents: number;
  movements: number;
}

export interface FinTx {
  id: string;
  kind: TxKind;
  amountCents: number;
  date: string;
  occurredAt: string;
  concept: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  category: string | null;
  bucket: Bucket | 'NONE';
  incomeId: string | null;
  notes: string | null;
}

export interface FinIncome {
  id: string;
  name: string;
  amountCents: number | null;
  type: IncomeType;
  frequency: 'ONCE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  status: 'PLANNED' | 'RECEIVED' | 'CANCELLED';
  expectedOn: string | null;
  receivedOn: string | null;
  accountId: string | null;
  split: Split | null;
  alloc: Allocation | null;
  notes: string | null;
}

export interface BucketState {
  assigned: number;
  used: number;
  remaining: number;
  usage: number | null;
  over: number;
  overCauses: { concept: string; amountCents: number; date: string }[];
}

export interface FinSummary {
  month: string;
  today: string;
  receivedCents: number;
  expectedCents: number;
  expectedUnknown: number;
  spentCents: number;
  buckets: Record<Bucket, BucketState>;
  savingsSeparatedCents: number;
  availableRealCents: number;
  creditDebtCents: number;
  balances: { id: string; name: string; type: AccountType; balanceCents: number }[];
  recent: FinTx[];
  upcoming: FinIncome[];
  rule: Split;
}

export interface FinCategory {
  id: string;
  name: string;
  defaultBucket: Bucket | 'NONE';
}

export const fk = {
  all: ['finance'] as const,
  summary: (month?: string) => ['finance', 'summary', month ?? 'now'] as const,
  accounts: ['finance', 'accounts'] as const,
  categories: ['finance', 'categories'] as const,
  txs: (month?: string, kind?: string, q?: string) => ['finance', 'txs', month ?? '', kind ?? '', q ?? ''] as const,
  incomes: ['finance', 'incomes'] as const,
  rule: ['finance', 'rule'] as const,
  suggestions: ['finance', 'suggestions'] as const,
};

export const useFinSummary = (month?: string) =>
  useQuery({ queryKey: fk.summary(month), queryFn: () => api.get<FinSummary>(`/finance/summary${month ? `?month=${month}` : ''}`) });
export const useAccounts = () => useQuery({ queryKey: fk.accounts, queryFn: () => api.get<FinAccount[]>('/finance/accounts') });
export const useCategories = () => useQuery({ queryKey: fk.categories, queryFn: () => api.get<FinCategory[]>('/finance/categories'), staleTime: 10 * 60_000 });
export const useTxs = (month?: string, kind?: string, q?: string) =>
  useQuery({
    queryKey: fk.txs(month, kind, q),
    queryFn: () => {
      const p = new URLSearchParams();
      if (month) p.set('month', month);
      if (kind) p.set('kind', kind);
      if (q) p.set('q', q);
      return api.get<FinTx[]>(`/finance/transactions?${p}`);
    },
  });
export const useIncomes = () => useQuery({ queryKey: fk.incomes, queryFn: () => api.get<FinIncome[]>('/finance/incomes') });
export const useRule = () => useQuery({ queryKey: fk.rule, queryFn: () => api.get<{ current: Split; history: (Split & { effectiveFrom: string })[] }>('/finance/rule') });
export const useSuggestions = () =>
  useQuery({
    queryKey: fk.suggestions,
    queryFn: () => api.get<{ concept: string; categoryId: string | null; bucket: Bucket | 'NONE'; lastAmountCents: number | null; uses: number }[]>('/finance/suggestions'),
  });

/** Mes en texto: "2026-10" → "octubre 2026". */
export const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const name = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(y, mo - 1, 15));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
};
export const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const d = new Date(y, mo - 1 + delta, 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const todayKey = () => new Date().toLocaleDateString('en-CA');

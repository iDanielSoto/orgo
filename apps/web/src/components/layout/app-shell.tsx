import {
  Activity,
  ArrowLeftRight,
  CupSoda,
  Droplet,
  House,
  Landmark,
  ListChecks,
  ListOrdered,
  MinusCircle,
  Moon,
  PieChart,
  Plus,
  PlusCircle,
  Scale,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useFin, type FinRequest } from '@/components/forms/finance-log';
import { useLog, type LogRequest } from '@/components/forms/log';
import { GlassRefraction } from '@/components/portfolio';
import { Sky } from '@/components/sky';
import { cn } from '@/lib/format';

type Area = 'salud' | 'finanzas';

const TABS: Record<Area, { to: string; label: string; icon: LucideIcon }[]> = {
  salud: [
    { to: '/salud', label: 'Hoy', icon: House },
    { to: '/salud/cuerpo', label: 'Cuerpo', icon: Scale },
    { to: '/salud/habitos', label: 'Hábitos', icon: ListChecks },
  ],
  finanzas: [
    { to: '/finanzas', label: 'Resumen', icon: PieChart },
    { to: '/finanzas/movimientos', label: 'Historial', icon: ListOrdered },
    { to: '/finanzas/cuentas', label: 'Cuentas', icon: Landmark },
  ],
};

const HEALTH_MENU: { label: string; icon: LucideIcon; req: LogRequest }[] = [
  { label: 'Agua', icon: Droplet, req: { kind: 'water' } },
  { label: 'Refresco', icon: CupSoda, req: { kind: 'soda' } },
  { label: 'Comida', icon: Utensils, req: { kind: 'meal' } },
  { label: 'Actividad', icon: Activity, req: { kind: 'activity' } },
  { label: 'Sueño', icon: Moon, req: { kind: 'sleep' } },
  { label: 'Peso', icon: Scale, req: { kind: 'weight' } },
];

const FINANCE_MENU: { label: string; icon: LucideIcon; req: FinRequest }[] = [
  { label: 'Gasto', icon: MinusCircle, req: { kind: 'expense' } },
  { label: 'Ingreso', icon: PlusCircle, req: { kind: 'income' } },
  { label: 'Transferencia', icon: ArrowLeftRight, req: { kind: 'transfer' } },
  { label: 'Cuenta', icon: Wallet, req: { kind: 'account' } },
];

export function Backdrop() {
  return (
    <>
      <Sky />
      <GlassRefraction />
    </>
  );
}

/** Marca de Ordo: anillo abierto con un punto. */
export function OrdoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <path d="M 256 112 A 150 150 0 1 0 402 230" fill="none" stroke="currentColor" strokeWidth="66" strokeLinecap="round" />
      <circle cx="364" cy="150" r="36" fill="currentColor" />
    </svg>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const log = useLog();
  const fin = useFin();
  const [menu, setMenu] = React.useState(false);
  React.useEffect(() => setMenu(false), [location.pathname]);
  const area: Area | null = location.pathname.startsWith('/finanzas') ? 'finanzas' : location.pathname.startsWith('/salud') ? 'salud' : null;

  const items =
    area === 'finanzas'
      ? FINANCE_MENU.map((m) => ({ label: m.label, icon: m.icon, run: () => fin(m.req) }))
      : HEALTH_MENU.map((m) => ({ label: m.label, icon: m.icon, run: () => log(m.req) }));

  return (
    <div className="min-h-dvh">
      <Backdrop />
      <main className={cn('mx-auto w-full max-w-[520px] px-5 pt-[calc(env(safe-area-inset-top)+14px)]', area ? 'pb-40' : 'pb-10')}>
        <div key={location.pathname} className="animate-[rise_280ms_cubic-bezier(0.16,1,0.3,1)]">
          <Outlet />
        </div>
      </main>

      {area && menu && <button aria-label="Cerrar menú" className="fixed inset-0 z-40" onClick={() => setMenu(false)} />}
      {area && menu && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-[max(1.25rem,calc(50%-240px))] z-50 w-56 origin-bottom-right animate-[rise_200ms_ease-out] glass glass-thick overflow-hidden rounded-[28px] py-1.5 [&>*+*]:border-t [&>*+*]:border-sep">
          {items.map((m) => (
            <button
              key={m.label}
              onClick={() => {
                setMenu(false);
                m.run();
              }}
              className="flex w-full items-center justify-between px-5 py-3 text-left text-[17px] active:bg-white/[0.08]"
            >
              {m.label}
              <m.icon className="size-5 text-ink-2" strokeWidth={1.8} aria-hidden />
            </button>
          ))}
        </div>
      )}

      {/* Barra del área: volver a Inicio · pestañas · registrar */}
      {area && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 mx-auto flex max-w-[520px] items-center gap-2.5 px-5">
          <button onClick={() => navigate('/')} aria-label="Inicio" className="glass press grid size-[62px] shrink-0 place-items-center rounded-full">
            <OrdoMark className="size-7 text-ink" />
          </button>
          <nav aria-label={area === 'salud' ? 'Salud' : 'Finanzas'} className="glass flex h-[62px] min-w-0 flex-1 items-center rounded-full p-1">
            {TABS[area].map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/salud' || t.to === '/finanzas'}
                className={({ isActive }) =>
                  cn('flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-ink-2 transition-colors', isActive && 'bg-white/[0.14] text-tint')
                }
              >
                <t.icon className="size-[22px]" strokeWidth={2} />
                <span className="max-w-full truncate px-1 text-[11px] font-medium">{t.label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Registrar"
            aria-expanded={menu}
            className="glass press grid size-[62px] shrink-0 place-items-center rounded-full"
          >
            <Plus className={cn('size-7 transition-transform', menu && 'rotate-45')} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}

import { Activity, CupSoda, Droplet, House, ListChecks, Moon, Plus, Scale, Utensils, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useLog, type LogRequest } from '@/components/forms/log';
import { AsciiSky, GlassRefraction } from '@/components/portfolio';
import { cn } from '@/lib/format';

const TABS = [
  { to: '/', label: 'Hoy', icon: House },
  { to: '/cuerpo', label: 'Cuerpo', icon: Scale },
  { to: '/habitos', label: 'Hábitos', icon: ListChecks },
];

const MENU: { label: string; icon: LucideIcon; req: LogRequest }[] = [
  { label: 'Agua', icon: Droplet, req: { kind: 'water' } },
  { label: 'Refresco', icon: CupSoda, req: { kind: 'soda' } },
  { label: 'Comida', icon: Utensils, req: { kind: 'meal' } },
  { label: 'Actividad', icon: Activity, req: { kind: 'activity' } },
  { label: 'Sueño', icon: Moon, req: { kind: 'sleep' } },
  { label: 'Peso', icon: Scale, req: { kind: 'weight' } },
];

export function Backdrop() {
  return (
    <>
      <AsciiSky />
      <GlassRefraction />
    </>
  );
}

export function AppShell() {
  const location = useLocation();
  const log = useLog();
  const [menu, setMenu] = React.useState(false);
  React.useEffect(() => setMenu(false), [location.pathname]);

  return (
    <div className="min-h-dvh">
      <Backdrop />
      <main className="mx-auto w-full max-w-[520px] px-5 pb-40 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div key={location.pathname} className="animate-[rise_280ms_cubic-bezier(0.16,1,0.3,1)]">
          <Outlet />
        </div>
      </main>

      {/* Menú del botón + (vidrio, como los menús de iOS) */}
      {menu && <button aria-label="Cerrar menú" className="fixed inset-0 z-40" onClick={() => setMenu(false)} />}
      {menu && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-[max(1.25rem,calc(50%-240px))] z-50 w-56 origin-bottom-right animate-[rise_200ms_ease-out] glass glass-thick overflow-hidden rounded-[28px] py-1.5 [&>*+*]:border-t [&>*+*]:border-sep">
          {MENU.map((m) => (
            <button
              key={m.label}
              onClick={() => {
                setMenu(false);
                log(m.req);
              }}
              className="flex w-full items-center justify-between px-5 py-3 text-left text-[17px] active:bg-white/[0.08]"
            >
              {m.label}
              <m.icon className="size-5 text-ink-2" strokeWidth={1.8} aria-hidden />
            </button>
          ))}
        </div>
      )}

      {/* Barra de pestañas flotante + botón aparte (iOS 27) */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 mx-auto flex max-w-[520px] items-center gap-3 px-5">
        <nav aria-label="Principal" className="glass flex h-[62px] flex-1 items-center rounded-full p-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                cn('flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-ink-2 transition-colors', isActive && 'bg-white/[0.14] text-tint')
              }
            >
              <t.icon className="size-[22px]" strokeWidth={2} />
              <span className="text-[11px] font-medium">{t.label}</span>
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
    </div>
  );
}

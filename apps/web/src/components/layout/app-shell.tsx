import {
  Activity,
  ArrowLeftRight,
  Dumbbell,
  CupSoda,
  Droplet,
  House,
  Landmark,
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
import { cn } from '@/lib/format';

type Area = 'salud' | 'finanzas';

const TABS: Record<Area, { to: string; label: string; icon: LucideIcon }[]> = {
  salud: [
    { to: '/salud', label: 'Hoy', icon: House },
    { to: '/salud/ejercicio', label: 'Ejercicio', icon: Dumbbell },
    { to: '/salud/comida', label: 'Comida', icon: Utensils },
    { to: '/salud/sueno', label: 'Sueño', icon: Moon },
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

/** Marca de Ordo: anillo abierto con un punto. */
export function OrdoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <path d="M 256 112 A 150 150 0 1 0 402 230" fill="none" stroke="currentColor" strokeWidth="66" strokeLinecap="round" />
      <circle cx="364" cy="150" r="36" fill="currentColor" />
    </svg>
  );
}

/** Profundidad de navegación: Inicio 0 · pestañas 1 · pantallas que se abren encima 2. */
const depthOf = (path: string) => (path === '/' ? 0 : Object.values(TABS).some((tabs) => tabs.some((t) => t.to === path)) ? 1 : 2);

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Deslizar desde el borde izquierdo para volver (la PWA instalada no tiene el gesto de Safari).
 * La pantalla sigue al dedo y, si la sueltas lejos o con impulso, se va.
 */
function useEdgeBack(target: React.RefObject<HTMLDivElement | null>, enabled: boolean, onBack: () => void) {
  const back = React.useRef(onBack);
  back.current = onBack;
  React.useEffect(() => {
    if (!enabled || !standalone()) return;
    let g: { x: number; y: number; t: number; dx: number; active: boolean } | null = null;
    const set = (dx: number, animate: boolean) => {
      const el = target.current;
      if (!el) return;
      el.style.transition = animate ? 'transform 220ms cubic-bezier(0.16,1,0.3,1)' : 'none';
      el.style.transform = dx ? `translateX(${dx}px)` : '';
    };
    const start = (e: TouchEvent) => {
      const p = e.touches[0]!;
      g = p.clientX < 24 ? { x: p.clientX, y: p.clientY, t: e.timeStamp, dx: 0, active: false } : null;
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const p = e.touches[0]!;
      const dx = p.clientX - g.x;
      if (!g.active) {
        if (Math.abs(p.clientY - g.y) > Math.abs(dx) && Math.abs(p.clientY - g.y) > 8) return void (g = null);
        if (dx < 10) return;
        g.active = true;
      }
      e.preventDefault();
      g.dx = Math.max(0, dx);
      set(g.dx, false);
    };
    const end = (e: TouchEvent) => {
      const s = g;
      g = null;
      if (!s?.active) return;
      if (s.dx > 110 || s.dx / Math.max(1, e.timeStamp - s.t) > 0.5) {
        set(window.innerWidth, true);
        setTimeout(() => back.current(), 160);
      } else set(0, true);
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
    };
  }, [enabled, target]);
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const log = useLog();
  const fin = useFin();
  const [menu, setMenu] = React.useState(false);
  React.useEffect(() => setMenu(false), [location.pathname]);
  const area: Area | null = location.pathname.startsWith('/finanzas') ? 'finanzas' : location.pathname.startsWith('/salud') ? 'salud' : null;

  // Transición según hacia dónde vas: entrar desliza desde la derecha, volver desde la izquierda,
  // entre pestañas sólo funde. Cada pantalla nueva empieza arriba.
  const depth = depthOf(location.pathname);
  const prev = React.useRef(location.pathname);
  const motion = React.useMemo(() => {
    const from = depthOf(prev.current);
    if (prev.current === location.pathname || depth === from) return 'animate-[fade_200ms_ease-out]';
    return depth > from ? 'animate-[push_380ms_cubic-bezier(0.16,1,0.3,1)]' : 'animate-[pop_380ms_cubic-bezier(0.16,1,0.3,1)]';
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    prev.current = location.pathname;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const page = React.useRef<HTMLDivElement>(null);
  useEdgeBack(page, depth > 0, () => {
    if (depth === 1) navigate('/');
    else if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(area ? TABS[area][0]!.to : '/', { replace: true });
  });

  const items =
    area === 'finanzas'
      ? FINANCE_MENU.map((m) => ({ label: m.label, icon: m.icon, run: () => fin(m.req) }))
      : HEALTH_MENU.map((m) => ({ label: m.label, icon: m.icon, run: () => log(m.req) }));

  return (
    <div className="min-h-dvh">
      <main className={cn('mx-auto w-full max-w-[520px] px-5 pt-[calc(env(safe-area-inset-top)+14px)]', area ? 'pb-32' : 'pb-10')}>
        <div key={location.pathname} ref={page} className={motion}>
          <Outlet />
        </div>
      </main>

      {area && menu && <button aria-label="Cerrar menú" className="fixed inset-0 z-40" onClick={() => setMenu(false)} />}
      {area && menu && (
        <div className="fixed bottom-[calc(max(12px,env(safe-area-inset-bottom)_-_10px)_+_68px)] right-[max(1.25rem,calc(50%-240px))] z-50 w-56 origin-bottom-right animate-[rise_200ms_ease-out] glass glass-thick overflow-hidden rounded-[28px] py-1.5 [&>*+*]:border-t [&>*+*]:border-sep">
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

      {/* Barra del área: volver a Inicio · pestañas · registrar. Va sobre la zona del indicador de
          inicio, como la barra flotante de iOS (en iPhone con Face ID queda a ~24 px del borde). */}
      {area && (
        <div className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom)_-_10px)] z-40 mx-auto flex max-w-[520px] items-center gap-2 px-4">
          <button onClick={() => navigate('/')} aria-label="Inicio" className="glass press grid size-[56px] shrink-0 place-items-center rounded-full">
            <OrdoMark className="size-6 text-ink" />
          </button>
          <nav aria-label={area === 'salud' ? 'Salud' : 'Finanzas'} className="glass flex h-[56px] min-w-0 flex-1 items-center rounded-full p-1">
            {TABS[area].map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/salud' || t.to === '/finanzas'}
                className={({ isActive }) =>
                  cn(
                    'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-ink-2 transition-colors',
                    // Cuerpo y Hábitos se abren desde Hoy: Hoy sigue marcado.
                    (isActive || (t.to === '/salud' && /^\/salud\/(cuerpo|habitos)/.test(location.pathname))) && 'bg-white/[0.14] text-tint',
                  )
                }
              >
                <t.icon className="size-[22px]" strokeWidth={2} />
                <span className="max-w-full truncate text-[10.5px] font-medium tracking-[-0.01em]">{t.label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Registrar"
            aria-expanded={menu}
            className="glass press grid size-[56px] shrink-0 place-items-center rounded-full"
          >
            <Plus className={cn('size-6 transition-transform', menu && 'rotate-45')} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}

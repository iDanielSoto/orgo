/** Recursos visuales de Alimentación: la mano como medida, el plato y el anillo de kcal. */
import { PORTION_KINDS, type MealType, type PortionKind, type Portions } from '@forma/core';
import { Apple, Coffee, MoonStar, Soup, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';

export const PORTION_COLOR: Record<PortionKind, string> = {
  PROTEIN: '#ff6b5e',
  CARBS: '#ffc53d',
  VEG: '#30d158',
  FAT: '#5ca0ff',
};

/** La parte de la mano que mide cada porción, dibujada (24 × 24). */
export function PortionIcon({ kind, className }: { kind: PortionKind; className?: string }) {
  const c = { fill: 'currentColor' };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {kind === 'PROTEIN' && (
        // Palma abierta: base y cuatro dedos, pulgar de lado.
        <g {...c}>
          <rect x="6" y="10.5" width="11.5" height="10.5" rx="4" />
          <rect x="6.3" y="4.5" width="2.5" height="8" rx="1.25" />
          <rect x="9.2" y="3" width="2.5" height="9" rx="1.25" />
          <rect x="12.1" y="3.4" width="2.5" height="9" rx="1.25" />
          <rect x="15" y="5.2" width="2.4" height="7.5" rx="1.2" />
          <rect x="2.2" y="10.6" width="2.5" height="7" rx="1.25" transform="rotate(-38 3.4 14.1)" />
        </g>
      )}
      {kind === 'CARBS' && (
        // Puño cerrado: nudillos marcados.
        <g {...c}>
          <rect x="5" y="6.5" width="14" height="13" rx="5" />
          <rect x="3.2" y="10" width="4.6" height="7.5" rx="2.3" />
          <path d="M9.5 9.3h7M9.5 12.6h7M9.5 15.9h7" stroke="var(--bg)" strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
        </g>
      )}
      {kind === 'VEG' && (
        // Brócoli: un puño de verdura.
        <g {...c}>
          <circle cx="8" cy="9.5" r="4" />
          <circle cx="12" cy="7" r="4.6" />
          <circle cx="16" cy="9.5" r="4" />
          <rect x="10.6" y="11" width="2.8" height="10" rx="1.4" />
          <rect x="8" y="14.2" width="2.2" height="5" rx="1.1" transform="rotate(-35 9.1 16.7)" />
        </g>
      )}
      {kind === 'FAT' && (
        // Pulgar arriba.
        <g {...c}>
          <rect x="9.2" y="2.8" width="4.6" height="10" rx="2.3" />
          <rect x="6" y="10" width="13" height="10.5" rx="4" />
          <path d="M10.5 13.6h6.5M10.5 16.8h6.5" stroke="var(--bg)" strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
        </g>
      )}
    </svg>
  );
}

/** Ícono en un círculo con el color de su porción. */
export function PortionBadge({ kind, size = 40 }: { kind: PortionKind; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `${PORTION_COLOR[kind]}26`, color: PORTION_COLOR[kind] }}>
      <PortionIcon kind={kind} className="size-[60%]" />
    </span>
  );
}

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`;
};

/** Plato visto desde arriba que se reparte por colores según las porciones. */
export function Plate({ portions, size = 128 }: { portions: Partial<Portions>; size?: number }) {
  const total = PORTION_KINDS.reduce((a, k) => a + (portions[k] ?? 0), 0);
  let a = 0;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className="shrink-0">
      <circle cx="60" cy="60" r="57" fill="var(--fill)" stroke="var(--sep)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="var(--sep)" strokeWidth="1" />
      {total === 0 ? (
        <circle cx="60" cy="60" r="38" fill="none" stroke="var(--sep)" strokeWidth="2" strokeDasharray="4 5" />
      ) : (
        PORTION_KINDS.filter((k) => (portions[k] ?? 0) > 0).map((k) => {
          const span = ((portions[k] ?? 0) / total) * Math.PI * 2;
          const d = span >= Math.PI * 2 - 1e-6 ? null : arc(60, 60, 42, a, a + span);
          a += span;
          return d ? (
            <path key={k} d={d} fill={PORTION_COLOR[k]} opacity=".85" stroke="var(--bg)" strokeWidth="1.5" className="transition-all duration-300" />
          ) : (
            <circle key={k} cx="60" cy="60" r="42" fill={PORTION_COLOR[k]} opacity=".85" />
          );
        })
      )}
    </svg>
  );
}

export const MEAL_ICON: Record<MealType, LucideIcon> = { BREAKFAST: Coffee, LUNCH: Soup, DINNER: MoonStar, SNACK: Apple };

export function MealBadge({ type, size = 40, muted }: { type: MealType; size?: number; muted?: boolean }) {
  const Icon = MEAL_ICON[type];
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full', muted ? 'bg-fill text-ink-3' : 'bg-star/20 text-star')} style={{ width: size, height: size }} aria-hidden>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
    </span>
  );
}

/** Anillo grande con las kcal del día contra la meta. */
export function KcalRing({ kcal, goal, size = 200 }: { kcal: number; goal: number | null; size?: number }) {
  const r = 84;
  const c = 2 * Math.PI * r;
  const pct = goal ? Math.min(1, kcal / goal) : 0;
  const over = goal !== null && kcal > goal * 1.05;
  return (
    <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--fill)" strokeWidth="16" />
        {goal !== null && kcal > 0 && (
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={over ? 'var(--red)' : 'var(--green)'}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        )}
      </svg>
      <div className="relative text-center">
        <p className="text-[46px] font-semibold leading-none tracking-[-0.04em] tabular">{kcal.toLocaleString('es-MX')}</p>
        <p className="mt-1.5 text-[15px] text-ink-2">{goal !== null ? `de ${goal.toLocaleString('es-MX')} kcal` : 'kcal hoy'}</p>
      </div>
    </div>
  );
}

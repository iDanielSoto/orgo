/** Piezas comunes de las zonas de Salud (Ejercicio, Comida, Sueño). */
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import * as React from 'react';
import { cn } from '@/lib/format';

export const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Los 7 días (lunes a domingo) de la semana de `today`. */
export function weekOf(today: string) {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
}

/** La cifra principal de la zona, grande y centrada. */
export function Hero({ value, unit, sub, tone }: { value: React.ReactNode; unit?: string; sub?: React.ReactNode; tone?: 'tint' | 'green' }) {
  return (
    <div className="py-2 text-center">
      <p className={cn('text-[72px] font-semibold leading-none tracking-[-0.05em] tabular', tone === 'tint' && 'text-tint', tone === 'green' && 'text-green')}>
        {value}
        {unit && <span className="ml-1.5 text-[26px] tracking-[-0.02em] text-ink-2">{unit}</span>}
      </p>
      {sub && <p className="mt-3 text-[17px] text-ink-2">{sub}</p>}
    </div>
  );
}

/**
 * Barras de la semana con una línea de meta. `value` null = sin registro (no se dibuja barra);
 * los días que aún no llegan quedan atenuados.
 */
export function WeekBars({
  days,
  today,
  value,
  goal,
  max,
  label,
}: {
  days: string[];
  today: string;
  value: (d: string) => number | null;
  goal?: number;
  max: number;
  label: string;
}) {
  const H = 132;
  return (
    <div role="img" aria-label={label} className="relative mt-8">
      {goal !== undefined && (
        <span className="absolute inset-x-0 border-t border-dashed border-white/30" style={{ top: H - (goal / max) * H }} aria-hidden />
      )}
      <div className="grid grid-cols-7 items-end gap-3" style={{ height: H }}>
        {days.map((d) => {
          const v = value(d);
          return (
            <span key={d} className="flex h-full items-end justify-center">
              {v !== null && v > 0 && (
                <span
                  className={cn('block w-full max-w-7 rounded-full transition-[height] duration-500', goal !== undefined && v >= goal ? 'bg-tint' : 'bg-white/35')}
                  style={{ height: Math.max(10, Math.min(1, v / max) * H) }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-3 text-center text-[12px] font-medium">
        {days.map((d, i) => (
          <span key={d} className={cn(d === today ? 'text-tint' : 'text-ink-3', d > today && 'opacity-40')}>
            {WEEKDAYS[i]}
          </span>
        ))}
      </div>
    </div>
  );
}

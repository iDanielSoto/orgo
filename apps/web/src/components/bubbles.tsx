/** Burbujas de vidrio vivas (glass-bubble del portafolio) con recursos visuales. */
import * as React from 'react';
import { cn } from '@/lib/format';

/** Burbuja de vidrio (132 px) con capas de fondo y una etiqueta al centro. */
export function GlassBubble({
  children,
  label,
  sub,
  onClick,
  ariaLabel,
  className,
  labelClassName,
}: {
  children?: React.ReactNode;
  label: React.ReactNode;
  sub?: string;
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className={cn('glass press relative grid size-[min(132px,33vw)] shrink-0 place-items-center overflow-hidden rounded-full', className)}>
      {children}
      <span className="relative text-center">
        <span className={cn('block text-[26px] font-semibold leading-none tracking-[-0.03em] tabular', labelClassName)}>{label}</span>
        {sub && <span className="mt-1 block text-[13px] text-ink-2">{sub}</span>}
      </span>
    </button>
  );
}

/** Líquido con ola animada; `fizz` agrega burbujitas que suben (refresco). */
export function Liquid({ pct, color, fizz }: { pct: number; color: string; fizz?: boolean }) {
  const level = Math.max(0.04, Math.min(1, pct)) * 100;
  return (
    <>
      <span className="absolute inset-x-0 bottom-0 transition-[height] duration-700" style={{ height: `${level}%`, background: color }} />
      <span className="absolute left-0 w-[200%] animate-[wave_5s_linear_infinite]" style={{ bottom: `calc(${level}% - 7px)` }} aria-hidden>
        <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="block h-[14px] w-full">
          <path d="M0 7 Q 25 0 50 7 T 100 7 T 150 7 T 200 7 V14 H0Z" fill={color} />
        </svg>
      </span>
      {fizz &&
        [12, 30, 48, 63, 78].map((x, i) => (
          <span
            key={x}
            aria-hidden
            className="absolute size-[5px] rounded-full bg-white/60 animate-[fizz_2.6s_ease-in_infinite]"
            style={{ left: `${x}%`, bottom: 4, animationDelay: `${i * 0.5}s`, ['--rise' as string]: `-${Math.max(18, level * 1.2)}px` }}
          />
        ))}
    </>
  );
}

/** Cielo nocturno dentro de la burbuja: luna creciente y estrellas. */
export function NightFill() {
  return (
    <span aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 120%, rgba(60,80,150,0.55), rgba(8,12,30,0.2) 70%)' }}>
      <span className="absolute right-[24%] top-[16%] size-7 rounded-full shadow-[inset_-7px_3px_0_0_#f4ead0]" />
      {[
        [22, 26],
        [34, 14],
        [70, 62],
        [18, 70],
        [80, 34],
        [56, 22],
      ].map(([x, y], i) => (
        <span key={i} className="absolute size-[3px] animate-[twinkle_3s_ease-in-out_infinite] rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.45}s` }} />
      ))}
    </span>
  );
}

/** Plato en tres partes (desayuno, comida, cena) que se llenan al registrarlas. */
export function PlateFill({ done }: { done: [boolean, boolean, boolean] }) {
  const on = 'rgba(92,160,255,0.55)';
  const off = 'var(--fill)';
  const bg = `conic-gradient(from -90deg, ${done[0] ? on : off} 0 118deg, transparent 118deg 120deg, ${done[1] ? on : off} 120deg 238deg, transparent 238deg 240deg, ${done[2] ? on : off} 240deg 358deg, transparent 358deg)`;
  return (
    <span aria-hidden className="absolute inset-[14px] rounded-full" style={{ background: bg, WebkitMask: 'radial-gradient(circle, transparent 55%, #000 56%)', mask: 'radial-gradient(circle, transparent 55%, #000 56%)' }} />
  );
}

/** Anillo de progreso (0–1) alrededor de la burbuja. */
export function RingFill({ pct, color }: { pct: number; color: string }) {
  const deg = Math.max(0, Math.min(1, pct)) * 360;
  return (
    <span
      aria-hidden
      className="absolute inset-[10px] rounded-full transition-[background] duration-700"
      style={{
        background: `conic-gradient(from 0deg, ${color} 0 ${deg}deg, var(--fill) ${deg}deg 360deg)`,
        WebkitMask: 'radial-gradient(circle, transparent 82%, #000 83%)',
        mask: 'radial-gradient(circle, transparent 82%, #000 83%)',
      }}
    />
  );
}

/** Pulso lento, como respiración (día de descanso). */
export function BreathFill() {
  return <span aria-hidden className="absolute inset-[22px] animate-[breathe_5s_ease-in-out_infinite] rounded-full bg-tint/25" />;
}


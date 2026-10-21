/**
 * Piezas del portafolio de Daniel (danielsoto.dev), portadas a React:
 * - HeatWord: cada letra se enciende en azul según qué tan cerca pasa el dedo.
 */
import * as React from 'react';

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Palabra de calor
// ---------------------------------------------------------------------------

const POP = [
  [238, 241, 250],
  [60, 90, 230],
  [43, 89, 255],
  [92, 160, 255],
  [170, 215, 255],
];
// Tema claro plano (Finanzas): letras oscuras que se encienden en azul.
const INK = [
  [11, 11, 15],
  [30, 60, 200],
  [30, 90, 240],
  [47, 124, 246],
  [92, 160, 255],
];
const palette = () => {
  const d = document.documentElement.dataset;
  return d.theme === 'light' ? INK : POP;
};
const mix = (t: number, palette: number[][]) => {
  const x = Math.min(Math.max(t, 0), 1) * (palette.length - 1);
  const i = Math.min(Math.floor(x), palette.length - 2);
  const f = x - i;
  return palette[i]!.map((v, k) => Math.round(v + (palette[i + 1]![k]! - v) * f));
};

export function HeatWord({ text, className }: { text: string; className?: string }) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    const word = ref.current!;
    const chars = [...word.querySelectorAll<HTMLElement>('[data-c]')];
    if (!chars.length || still()) return;
    const heat = chars.map(() => 0);
    let px = -1e4;
    let py = -1e4;
    let live = 0;
    const move = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      live = performance.now();
    };
    addEventListener('pointermove', move);
    addEventListener('pointerdown', move);
    let raf = 0;
    const tick = (t: number) => {
      const box = word.getBoundingClientRect();
      let x = px;
      let y = py;
      if (t - live > 2500) {
        x = box.left + box.width * (0.5 + 0.48 * Math.sin(t / 1400));
        y = box.top + box.height * (0.5 + 0.3 * Math.sin(t / 900));
      }
      const R = chars[0]!.offsetHeight * 0.45 * 2.5;
      chars.forEach((c, i) => {
        const b = c.getBoundingClientRect();
        const d = Math.hypot(b.left + b.width / 2 - x, b.top + b.height / 2 - y);
        const target = Math.max(0, 1 - d / R) ** 1.4;
        heat[i]! += (target - heat[i]!) * (target > heat[i]! ? 0.25 : 0.06);
        const [r, g, bl] = mix(heat[i]!, palette());
        c.style.color = `rgb(${r} ${g} ${bl})`;
        c.style.fontWeight = String(Math.round(600 + heat[i]! * 300));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', move);
      removeEventListener('pointerdown', move);
    };
  }, [text]);

  return (
    <h1 ref={ref} aria-label={text} className={className}>
      {text.split(' ').map((w, wi) => (
        <span key={wi} aria-hidden className="inline-block whitespace-nowrap">
          {[...w].map((c, ci) => (
            <span key={ci} data-c className="inline-block">
              {c}
            </span>
          ))}
          {wi < text.split(' ').length - 1 && ' '}
        </span>
      ))}
    </h1>
  );
}

/**
 * Piezas del portafolio de Daniel (danielsoto.dev), portadas a React:
 * - HeatWord: cada letra se enciende en azul según qué tan cerca pasa el dedo.
 * - GlassRefraction: filtro de refracción para cada `.glass` (glass-bubble, bend 100, fringe 40).
 *   Sólo Chromium lo soporta; en Safari/iPhone el vidrio queda esmerilado.
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
        const [r, g, bl] = mix(heat[i]!, POP);
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

// ---------------------------------------------------------------------------
// Refracción del vidrio
// ---------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';
const dispMap = (w: number, h: number, r: number, bend: number) => {
  const b = Math.min(w, h) * 0.12;
  const svg = `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="r" x1="100%" x2="0%"><stop offset="0" stop-color="#0000"/><stop offset="1" stop-color="red"/></linearGradient><linearGradient id="b" y1="0%" y2="100%" x2="0%"><stop offset="0" stop-color="#0000"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="${w}" height="${h}" fill="black"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#r)"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#b)" style="mix-blend-mode:difference"/><rect x="${b}" y="${b}" width="${w - b * 2}" height="${h - b * 2}" rx="${Math.max(r - b, 0)}" fill="hsl(0 0% 50% / ${1 - bend / 1000})" style="filter:blur(${b * 0.7}px)"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
};

export function GlassRefraction() {
  const ref = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    const ok = /Chrome\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url(#x)');
    if (!ok) return;
    document.documentElement.classList.add('glass-refract');
    const defs = ref.current!;
    let n = 0;
    const build = (el: HTMLElement) => {
      const { width: w, height: h } = el.getBoundingClientRect();
      if (!w || !h) return;
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, Math.min(w, h) / 2);
      const id = el.dataset.glassId || `glass-${n++}`;
      el.dataset.glassId = id;
      const s = -Math.min(w, h) * 0.9;
      const fringe = 40;
      const ch = (c: string, k: number, m: string) =>
        `<feDisplacementMap in="SourceGraphic" in2="map" scale="${s * k}" xChannelSelector="R" yChannelSelector="B" result="d${c}"/><feColorMatrix in="d${c}" result="${c}" values="${m}"/>`;
      defs.querySelector(`#${id}`)?.remove();
      defs.insertAdjacentHTML(
        'beforeend',
        `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feImage href="${dispMap(Math.round(w), Math.round(h), r, 100)}" x="0" y="0" width="${w}" height="${h}" result="map"/>${ch('R', 1, '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0')}${ch('G', 1 - fringe / 400, '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0')}${ch('B', 1 - fringe / 200, '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0')}<feBlend in="R" in2="G" mode="screen" result="RG"/><feBlend in="RG" in2="B" mode="screen" result="out"/><feGaussianBlur in="out" stdDeviation="0.6"/></filter>`,
      );
      el.style.setProperty('--glass-filter', `url(#${id})`);
    };
    const ro = new ResizeObserver((es) => es.forEach((e) => build(e.target as HTMLElement)));
    const watch = () => document.querySelectorAll<HTMLElement>('.glass').forEach((el) => ro.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return <svg ref={ref} aria-hidden width="0" height="0" className="absolute" />;
}

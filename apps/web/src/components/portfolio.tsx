/**
 * Piezas del portafolio de Daniel (danielsoto.dev), portadas a React:
 * - AsciiSky: tablero ASCII oscuro con estrellas amarillas que se deslizan y ráfagas de viento.
 * - HeatWord: cada letra se enciende en azul según qué tan cerca pasa el dedo.
 * - GlassRefraction: filtro de refracción para cada `.glass` (glass-bubble, bend 100, fringe 40).
 *   Sólo Chromium lo soporta; en Safari/iPhone el vidrio queda esmerilado.
 */
import * as React from 'react';
import { currentHour, skyAt } from '@/lib/sky';

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Cielo ASCII según la hora (noche con estrellas y luna; día con sol y nubes)
// ---------------------------------------------------------------------------

export function AsciiSky() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [sky, setSky] = React.useState(() => skyAt(currentHour()));
  const skyRef = React.useRef(sky);

  // El cielo cambia poco a poco: se recalcula cada minuto.
  React.useEffect(() => {
    const id = setInterval(() => setSky(skyAt(currentHour())), 60_000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    skyRef.current = sky;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sky.top);
  }, [sky]);

  React.useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const CW = 12;
    const CH = 16;
    const BASE = ['.', '.', '.', '·', ':', ' '];
    const RAMP = ['.', ':', '+', '*', '#'];
    const CLOUD = ['.', ':', 'o', 'O', '@'];
    const WIND = ['-', '~', '=', '~', '-'];
    let cols = 0;
    let rows = 0;
    let base: string[] = [];
    let heat = new Float32Array(0);
    let wind = new Float32Array(0);
    let cloud = new Float32Array(0);
    let sunBuf = new Float32Array(0);
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      cols = Math.ceil(innerWidth / CW);
      rows = Math.ceil(innerHeight / CH);
      seed = 11;
      base = Array.from({ length: cols * rows }, () => BASE[Math.floor(rnd() * BASE.length)]!);
      heat = new Float32Array(cols * rows);
      wind = new Float32Array(cols * rows);
      cloud = new Float32Array(cols * rows);
      sunBuf = new Float32Array(cols * rows);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `600 ${CH - 4}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    };

    const STAR = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.42 : 1;
      return [Math.cos(a) * r, Math.sin(a) * r] as const;
    });
    const inside = (x: number, y: number) => {
      let hit = false;
      for (let i = 0, j = 9; i < 10; j = i++) {
        const [xi, yi] = STAR[i]!;
        const [xj, yj] = STAR[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };

    type Star = { x: number; y: number; r: number; vx: number; vy: number; ph: number };
    const spawn = (anywhere: boolean): Star => {
      const r = 3 + Math.random() * 4;
      return { x: anywhere ? Math.random() * cols : -r * 2, y: Math.random() * rows, r, vx: 0.8 + Math.random() * 1.6, vy: (Math.random() - 0.5) * 0.5, ph: Math.random() * Math.PI * 2 };
    };
    type Gust = { x: number; y: number; len: number; v: number; amp: number; ph: number };
    const gust = (anywhere: boolean): Gust => ({
      x: anywhere ? Math.random() * cols : -Math.random() * 30,
      y: Math.random() * rows,
      len: 8 + Math.random() * 18,
      v: 9 + Math.random() * 10,
      amp: 0.4 + Math.random() * 1.4,
      ph: Math.random() * Math.PI * 2,
    });
    // Nube: varios círculos encimados que avanzan despacio con el viento.
    type Cloud = { x: number; y: number; v: number; puffs: { dx: number; dy: number; r: number }[] };
    const makeCloud = (anywhere: boolean): Cloud => {
      const n = 3 + Math.floor(Math.random() * 3);
      const w = 6 + Math.random() * 8;
      return {
        x: anywhere ? Math.random() * cols : -w * 2,
        y: 2 + Math.random() * rows * 0.6,
        v: 0.25 + Math.random() * 0.4,
        puffs: Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * (w / n) * 1.3, dy: (Math.random() - 0.5) * 1.2, r: 2.2 + Math.random() * 2.6 })),
      };
    };

    const force = (t: number) => 0.25 + 0.75 * Math.max(0, Math.sin(t / 5200)) ** 2;
    const blow = (g: Gust) => {
      for (let i = 0; i < g.len; i++) {
        const x = Math.floor(g.x - i);
        const y = Math.round(g.y + Math.sin((g.x - i) / 6 + g.ph) * g.amp);
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        const k = y * cols + x;
        wind[k] = Math.max(wind[k]!, 1 - i / g.len);
      }
    };

    resize();
    const stars: Star[] = Array.from({ length: Math.max(4, Math.round((cols * rows) / 900)) }, () => spawn(true));
    const gusts: Gust[] = Array.from({ length: Math.max(6, Math.round(rows / 3)) }, () => gust(true));
    const clouds: Cloud[] = Array.from({ length: Math.max(3, Math.round(cols / 7)) }, () => makeCloud(true));
    const SUB = [1 / 6, 0.5, 5 / 6];
    const AR = CW / CH; // las celdas son más altas que anchas

    const stamp = (s: Star, t: number) => {
      const pulse = 0.75 + 0.25 * Math.sin(t / 600 + s.ph);
      const ry = s.r * AR;
      const x0 = Math.max(0, Math.floor(s.x - s.r));
      const x1 = Math.min(cols - 1, Math.ceil(s.x + s.r));
      const y0 = Math.max(0, Math.floor(s.y - ry));
      const y1 = Math.min(rows - 1, Math.ceil(s.y + ry));
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          let cov = 0;
          for (const sy of SUB) for (const sx of SUB) if (inside((cx + sx - s.x) / s.r, (cy + sy - s.y) / ry)) cov++;
          if (!cov) continue;
          const k = cy * cols + cx;
          heat[k] = Math.max(heat[k]!, (cov / 9) * pulse);
        }
    };

    /** Disco suave (sol, luna, nubes) en un búfer; `cut` resta otro disco (luna creciente). */
    const disc = (buf: Float32Array, x: number, y: number, r: number, value: number, cut?: { x: number; y: number; r: number }) => {
      const ry = r * AR;
      for (let cy = Math.max(0, Math.floor(y - ry - 1)); cy <= Math.min(rows - 1, Math.ceil(y + ry + 1)); cy++)
        for (let cx = Math.max(0, Math.floor(x - r - 1)); cx <= Math.min(cols - 1, Math.ceil(x + r + 1)); cx++) {
          const d = Math.hypot((cx + 0.5 - x) / r, (cy + 0.5 - y) / ry);
          if (d > 1) continue;
          if (cut && Math.hypot((cx + 0.5 - cut.x) / cut.r, (cy + 0.5 - cut.y) / (cut.r * AR)) < 1) continue;
          const k = cy * cols + cx;
          buf[k] = Math.max(buf[k]!, value * Math.min(1, (1 - d) * 3));
        }
    };

    const draw = (t: number) => {
      const sky = skyRef.current;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      sunBuf.fill(0);
      cloud.fill(0);
      let sunRGB: number[] = [255, 230, 160];
      let sx = 0;
      let sy = 0;
      if (sky.sun) {
        sx = sky.sun.x * cols;
        sy = rows * (0.8 - 0.62 * sky.sun.alt);
        sunRGB = sky.sun.color;
        disc(sunBuf, sx, sy, 5 + 0.3 * Math.sin(t / 900), 1);
      } else if (sky.moon > 0) {
        const mx = cols * 0.74;
        const my = rows * 0.17;
        disc(sunBuf, mx, my, 4, sky.moon, { x: mx + 1.6, y: my - 0.6, r: 3.6 });
      }
      if (sky.clouds > 0.02) for (const c of clouds) for (const p of c.puffs) disc(cloud, c.x + p.dx, c.y + p.dy, p.r, sky.clouds);

      const [cr, cg, cb] = sky.cloud.map(Math.round);
      const day = sky.sun ? sky.sun.alt : 0;
      for (let cy = 0; cy < rows; cy++)
        for (let cx = 0; cx < cols; cx++) {
          const k = cy * cols + cx;
          const px = cx * CW + CW / 2;
          const py = cy * CH + CH / 2;
          const sb = sunBuf[k]!;
          const h = heat[k]! * sky.stars;
          const c = cloud[k]!;
          const w = wind[k]!;
          if (sb > 0.05) {
            const col = sky.sun ? sunRGB : [232, 236, 255];
            ctx.fillStyle = `rgba(${col.map(Math.round).join(',')}, ${Math.min(1, 0.25 + sb)})`;
            ctx.fillText(RAMP[Math.min(RAMP.length - 1, Math.floor(sb * RAMP.length))]!, px, py);
          } else if (c > 0.05) {
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(0.9, 0.15 + c * 0.8)})`;
            ctx.fillText(CLOUD[Math.min(CLOUD.length - 1, Math.floor(c * CLOUD.length))]!, px, py);
          } else if (h > 0.04) {
            ctx.fillStyle = `rgba(255, 210, 63, ${Math.min(1, 0.15 + h)})`;
            ctx.fillText(RAMP[Math.min(RAMP.length - 1, Math.floor(h * RAMP.length))]!, px, py);
          } else if (w > 0.05) {
            ctx.fillStyle = `rgba(238, 241, 250, ${0.08 + w * 0.32})`;
            ctx.fillText(WIND[Math.min(WIND.length - 1, Math.floor(w * WIND.length))]!, px, py);
          } else if (base[k] !== ' ') {
            // Rayos de sol: el tablero brilla un poco cerca del sol.
            const glow = sky.sun ? Math.max(0, 1 - Math.hypot(cx - sx, (cy - sy) / AR) / 16) * 0.35 : 0;
            ctx.fillStyle = glow > 0.02 ? `rgba(${sunRGB.map(Math.round).join(',')}, ${0.08 + glow})` : `rgba(238, 241, 250, ${0.05 + 0.04 * day + 0.04 * Math.sin(t / 1800 + k * 1.37)})`;
            ctx.fillText(base[k]!, px, py);
          }
        }
    };

    let last = 0;
    let raf = 0;
    const step = (t: number, dt: number) => {
      for (let i = 0; i < heat.length; i++) {
        heat[i]! *= 0.82;
        wind[i]! *= 0.6;
      }
      const f = force(t);
      gusts.forEach((g, i) => {
        g.x += g.v * f * dt * 1.6;
        if (g.x - g.len > cols) gusts[i] = gust(false);
        if (i / gusts.length < 0.3 + f * 0.7) blow(gusts[i]!);
      });
      clouds.forEach((c, i) => {
        c.x += c.v * (0.6 + f) * dt;
        if (c.x - 20 > cols) clouds[i] = makeCloud(false);
      });
      if (skyRef.current.stars > 0.02)
        stars.forEach((s, i) => {
          s.x += s.vx * (0.6 + f * 1.4) * dt;
          s.y += s.vy * dt;
          if (s.x - s.r > cols || s.y < -s.r * 2 || s.y > rows + s.r * 2) stars[i] = spawn(false);
          stamp(stars[i]!, t);
        });
    };
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      if (t - last >= 50) {
        step(t, dt);
        draw(t);
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    const paintStill = () => {
      step(0, 0);
      draw(0);
    };
    const onResize = () => {
      resize();
      if (still()) paintStill();
    };
    addEventListener('resize', onResize);
    if (still()) paintStill();
    else
      raf = requestAnimationFrame((t) => {
        last = t;
        raf = requestAnimationFrame(tick);
      });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 transition-[background] duration-[2000ms]"
        style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.mid} 55%, ${sky.bot} 100%)` }}
      />
      <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen" />
    </>
  );
}

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
// De día el azul se pierde contra el cielo: el calor se vuelve dorado (estrellas del portafolio).
const SUN = [
  [238, 241, 250],
  [255, 236, 170],
  [255, 210, 63],
  [255, 186, 40],
  [255, 236, 170],
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
        const [r, g, bl] = mix(heat[i]!, (skyAt(currentHour()).sun?.alt ?? 0) > 0.12 ? SUN : POP);
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

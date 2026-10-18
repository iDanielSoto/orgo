/**
 * Cielo del fondo: realista y con el clima del momento.
 * - El color sale de la altura del sol, calculada con la salida y puesta reales del lugar.
 * - Brillo del sol cerca del horizonte, estrellas de noche.
 * - Cielo cubierto (se agrisa según la nubosidad real), lluvia, tormenta y niebla. Sin nubes dibujadas.
 * En desarrollo se puede forzar con ?hora=18.5&clima=lluvia|nublado|parcial|despejado|tormenta|niebla.
 */
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { api } from '@/lib/api';

export interface Weather {
  place: string;
  code: number;
  cloudCover: number;
  precipitation: number;
  windKmh: number;
  temperatureC: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
}

type RGB = [number, number, number];

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a = 1) => `rgba(${c.map((v) => Math.round(v)).join(',')},${a})`;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Colores del cielo (arriba, medio, horizonte) según la altura del sol (−1 noche … 1 mediodía). */
const KEYS: { e: number; c: [RGB, RGB, RGB] }[] = [
  { e: -1, c: [hex('#02040b'), hex('#060b18'), hex('#0d1528')] },
  { e: -0.5, c: [hex('#040814'), hex('#0b1430'), hex('#1b2546')] },
  { e: -0.2, c: [hex('#0b1638'), hex('#2a3566'), hex('#6a4c6e')] },
  { e: 0, c: [hex('#1d3163'), hex('#7a5a86'), hex('#f08a52')] },
  { e: 0.08, c: [hex('#2c4f94'), hex('#a77f8f'), hex('#f6b46e')] },
  { e: 0.2, c: [hex('#3466b6'), hex('#7fa6d6'), hex('#f1d3a8')] },
  { e: 0.45, c: [hex('#2d68c6'), hex('#69a0de'), hex('#b9d8f2')] },
  { e: 1, c: [hex('#1f5fc4'), hex('#5b97df'), hex('#a8cff4')] },
];

function skyColors(e: number): [RGB, RGB, RGB] {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.e <= e) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const t = clamp((e - a.e) / (b.e - a.e));
  return [mixRGB(a.c[0], b.c[0], t), mixRGB(a.c[1], b.c[1], t), mixRGB(a.c[2], b.c[2], t)];
}

/** Altura del sol y su posición horizontal (0–1) con la salida y puesta reales. */
function sunAt(now: number, sunrise: number, sunset: number) {
  if (now >= sunrise && now <= sunset) {
    const p = (now - sunrise) / (sunset - sunrise);
    return { elev: Math.sin(Math.PI * p), x: 0.08 + 0.84 * p };
  }
  const afterSunset = (now - sunset + 1440) % 1440;
  const beforeSunrise = (sunrise - now + 1440) % 1440;
  const near = Math.min(afterSunset, beforeSunrise);
  return { elev: -clamp(near / 90), x: afterSunset < beforeSunrise ? 0.95 : 0.05 };
}

type Kind = 'clear' | 'rain' | 'storm' | 'fog';
const kindOf = (code: number): Kind =>
  code >= 95 ? 'storm' : code === 45 || code === 48 ? 'fog' : (code >= 51 && code <= 67) || (code >= 80 && code <= 86) || (code >= 71 && code <= 77) ? 'rain' : 'clear';

const FORCED: Record<string, Partial<Weather>> = {
  despejado: { code: 0, cloudCover: 3, windKmh: 8 },
  parcial: { code: 2, cloudCover: 45, windKmh: 12 },
  nublado: { code: 3, cloudCover: 95, windKmh: 14 },
  lluvia: { code: 63, cloudCover: 100, precipitation: 3, windKmh: 18 },
  tormenta: { code: 95, cloudCover: 100, precipitation: 6, windKmh: 30 },
  niebla: { code: 45, cloudCover: 100, windKmh: 3 },
};

function useNowMinutes() {
  const get = () => {
    if (import.meta.env.DEV) {
      const h = new URLSearchParams(location.search).get('hora');
      if (h !== null && !Number.isNaN(Number(h))) return (((Number(h) % 24) + 24) % 24) * 60;
    }
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = React.useState(get);
  React.useEffect(() => {
    const id = setInterval(() => setNow(get()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useWeather() {
  return useQuery({ queryKey: ['weather'], queryFn: () => api.get<Weather>('/weather'), staleTime: 10 * 60_000, refetchInterval: 10 * 60_000, retry: 1 });
}

interface Scene {
  top: RGB;
  mid: RGB;
  bot: RGB;
  sun: { x: number; elev: number; color: RGB; glow: number };
  stars: number;
  cloudCover: number;
  overcast: number;
  cloudLit: RGB;
  cloudShade: RGB;
  kind: Kind;
  intensity: number;
  wind: number;
}

function buildScene(now: number, w: Weather | undefined): Scene {
  const forced = import.meta.env.DEV ? FORCED[new URLSearchParams(location.search).get('clima') ?? ''] : undefined;
  const weather = { code: 0, cloudCover: 10, precipitation: 0, windKmh: 8, sunrise: '06:45', sunset: '18:30', ...w, ...forced };
  const sun = sunAt(now, mins(weather.sunrise), mins(weather.sunset));
  const kind = kindOf(weather.code);
  const overcast = clamp((weather.cloudCover - 45) / 55) * (kind === 'clear' ? 0.75 : 1);
  const wet = kind === 'rain' || kind === 'storm' ? 1 : 0;
  // Nubes grises: el cielo pierde color y se oscurece un poco.
  const grey = (c: RGB): RGB => {
    const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    return mixRGB(c, [l * 0.92, l * 0.95, l], overcast * 0.8).map((v) => v * (1 - 0.28 * wet - 0.1 * overcast)) as RGB;
  };
  const [top, mid, bot] = skyColors(sun.elev).map(grey) as [RGB, RGB, RGB];
  const low = clamp(1 - sun.elev / 0.35);
  const night = clamp(-sun.elev * 1.6);
  return {
    top,
    mid,
    bot,
    sun: { ...sun, color: mixRGB([255, 236, 205], [255, 140, 72], low), glow: (sun.elev > -0.18 ? lerp(0.22, 0.6, low) : 0) * (1 - overcast * 0.9) },
    stars: night * (1 - (weather.cloudCover / 100) * 0.9),
    cloudCover: weather.cloudCover / 100,
    overcast,
    cloudLit: night > 0.6 ? [62, 70, 92] : mixRGB([255, 255, 255], [255, 186, 150], low * (sun.elev > -0.1 ? 1 : 0)).map((v, i) => lerp(v, [62, 70, 92][i]!, night)) as RGB,
    cloudShade: mixRGB(mixRGB([196, 206, 222], [140, 104, 132], low * (sun.elev > -0.1 ? 1 : 0)), [26, 31, 46], night),
    kind,
    intensity: kind === 'storm' ? 1 : kind === 'rain' ? clamp(0.35 + weather.precipitation / 6, 0.35, 1) : 0,
    wind: weather.windKmh,
  };
}

export function Sky() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const now = useNowMinutes();
  const weather = useWeather();
  const scene = React.useMemo(() => buildScene(now, weather.data), [now, weather.data]);
  const sceneRef = React.useRef(scene);
  React.useEffect(() => {
    sceneRef.current = scene;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', rgba(scene.top));
    // Cielo claro u oscuro: el CSS ajusta contraste del texto y la palabra de calor su color.
    const lum = 0.3 * scene.mid[0] + 0.59 * scene.mid[1] + 0.11 * scene.mid[2];
    document.documentElement.dataset.sky = lum > 95 ? 'light' : 'dark';
  }, [scene]);

  React.useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth;
      H = innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 170 }, () => ({ x: rnd(), y: rnd() * 0.72, r: 0.4 + rnd() * 1.1, a: 0.35 + rnd() * 0.65, ph: rnd() * 6.28, sp: 0.6 + rnd() * 1.6 }));
    const drops = Array.from({ length: 160 }, () => ({ x: rnd(), y: rnd(), l: 14 + rnd() * 10, v: 0.75 + rnd() * 0.4 }));
    let flash = 0;
    let nextFlash = 3000 + Math.random() * 8000;

    const draw = (t: number, dt: number) => {
      const s = sceneRef.current;
      // Cielo
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(s.top));
      g.addColorStop(0.55, rgba(s.mid));
      g.addColorStop(1, rgba(s.bot));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Estrellas
      if (s.stars > 0.02) {
        for (const st of stars) {
          const a = s.stars * st.a * (0.7 + 0.3 * Math.sin((t / 1000) * st.sp + st.ph));
          ctx.fillStyle = `rgba(235,240,255,${a})`;
          ctx.beginPath();
          ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Brillo del sol (más amplio y cálido cerca del horizonte)
      if (s.sun.glow > 0.01) {
        const sx = s.sun.x * W;
        const sy = H * (0.86 - 0.7 * Math.max(0, s.sun.elev));
        const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.75);
        rg.addColorStop(0, rgba(s.sun.color, s.sun.glow));
        rg.addColorStop(0.35, rgba(s.sun.color, s.sun.glow * 0.35));
        rg.addColorStop(1, rgba(s.sun.color, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
        if (s.sun.elev > 0.02 && s.overcast < 0.6) {
          const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
          core.addColorStop(0, rgba([255, 252, 240], 0.55 * (1 - s.overcast)));
          core.addColorStop(1, rgba(s.sun.color, 0));
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(sx, sy, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Cielo cubierto: sólo se agrisa, sin dibujar nubes.
      if (s.overcast > 0.05) {
        ctx.fillStyle = rgba(s.cloudShade, s.overcast * 0.45);
        ctx.fillRect(0, 0, W, H);
      }

      // Lluvia
      if (s.intensity > 0) {
        const count = Math.round(drops.length * s.intensity);
        const slant = 0.15 + s.wind / 200;
        ctx.strokeStyle = 'rgba(205,218,238,0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const d = drops[i]!;
          d.y += (d.v * dt) / 1000 * 1.2;
          d.x += (d.v * slant * dt) / 1000 * 1.2 * (H / W);
          if (d.y > 1.05) {
            d.y = -0.05;
            d.x = Math.random();
          }
          if (d.x > 1.05) d.x -= 1.1;
          const x = d.x * W;
          const y = d.y * H;
          ctx.moveTo(x, y);
          ctx.lineTo(x - d.l * slant, y - d.l);
        }
        ctx.stroke();
      }

      // Relámpagos
      if (s.kind === 'storm' && !still) {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flash = 1;
          nextFlash = 6000 + Math.random() * 9000;
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(230,236,255,${flash * 0.35})`;
          ctx.fillRect(0, 0, W, H);
          flash = Math.max(0, flash - dt / 220);
        }
      }

      // Niebla
      if (s.kind === 'fog') {
        const fg = ctx.createLinearGradient(0, H, 0, H * 0.25);
        fg.addColorStop(0, rgba(mixRGB(s.cloudLit, [200, 205, 215], 0.5), 0.55));
        fg.addColorStop(1, rgba(mixRGB(s.cloudLit, [200, 205, 215], 0.5), 0));
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
      }

      // Sombra suave arriba (título y fecha) para que se lean con el cielo claro.
      const lightness = clamp(s.sun.elev * 2.5);
      const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.32);
      topShade.addColorStop(0, `rgba(4,14,40,${0.32 * lightness})`);
      topShade.addColorStop(1, 'rgba(4,14,40,0)');
      ctx.fillStyle = topShade;
      ctx.fillRect(0, 0, W, H * 0.32);

      // Sombra suave abajo para que la barra y el texto se lean con el cielo claro.
      const shade = ctx.createLinearGradient(0, H * 0.7, 0, H);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, `rgba(0,0,0,${0.15 + 0.2 * clamp(s.sun.elev)})`);
      ctx.fillStyle = shade;
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
    };

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(100, t - last);
      if (dt >= 33) {
        draw(t, dt);
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    const onResize = () => {
      resize();
      if (still) draw(0, 0);
    };
    addEventListener('resize', onResize);
    if (still) draw(0, 0);
    else raf = requestAnimationFrame(loop);
    // Con la app en segundo plano no se dibuja.
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!still) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Con movimiento reducido, se repinta sólo cuando cambia la escena.
  React.useEffect(() => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    dispatchEvent(new Event('resize'));
  }, [scene]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}

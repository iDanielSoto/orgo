/**
 * Cielo según la hora local del teléfono: colores del degradado, estrellas, nubes y sol
 * interpolados entre momentos clave del día (noche, amanecer, mañana, tarde, atardecer).
 */

type RGB = [number, number, number];

interface Key {
  h: number;
  top: RGB;
  mid: RGB;
  bot: RGB;
  stars: number;
  clouds: number;
  cloud: RGB;
}

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

const NIGHT: Omit<Key, 'h'> = { top: hex('#05070f'), mid: hex('#0a0e1f'), bot: hex('#121b36'), stars: 1, clouds: 0.12, cloud: [150, 160, 195] };

const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 5, ...NIGHT },
  { h: 6.2, top: hex('#0f1838'), mid: hex('#3b3f70'), bot: hex('#c26b5c'), stars: 0.45, clouds: 0.3, cloud: [230, 170, 160] },
  { h: 7.3, top: hex('#33579e'), mid: hex('#d99a7c'), bot: hex('#f4c08e'), stars: 0, clouds: 0.5, cloud: [255, 222, 205] },
  { h: 9.5, top: hex('#2a66cc'), mid: hex('#4f8edf'), bot: hex('#93c0ee'), stars: 0, clouds: 0.75, cloud: [255, 255, 255] },
  { h: 15.5, top: hex('#285fc2'), mid: hex('#4d88d6'), bot: hex('#9fc3e8'), stars: 0, clouds: 0.7, cloud: [255, 255, 255] },
  { h: 17.6, top: hex('#34539c'), mid: hex('#c98559'), bot: hex('#f0ad66'), stars: 0, clouds: 0.6, cloud: [255, 214, 175] },
  { h: 18.8, top: hex('#25285a'), mid: hex('#8f4570'), bot: hex('#ec7448'), stars: 0.1, clouds: 0.45, cloud: [250, 160, 140] },
  { h: 19.9, top: hex('#0c1230'), mid: hex('#26285a'), bot: hex('#563860'), stars: 0.65, clouds: 0.25, cloud: [170, 150, 190] },
  { h: 21, ...NIGHT },
  { h: 24, ...NIGHT },
];

const SUNRISE = 6.6;
const SUNSET = 19.2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB) => `rgb(${c.map(Math.round).join(' ')})`;

export interface SkyState {
  hour: number;
  top: string;
  mid: string;
  bot: string;
  stars: number;
  clouds: number;
  cloud: RGB;
  /** Sol: posición relativa (0–1) y altura (0 en el horizonte, 1 al mediodía); null si es de noche. */
  sun: { x: number; alt: number; color: RGB } | null;
  /** Luna visible de noche. */
  moon: number;
}

/** Hora decimal local; en desarrollo se puede forzar con ?hora=18.5 para revisar. */
export function currentHour(now = new Date()) {
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(location.search).get('hora');
    if (forced !== null && !Number.isNaN(Number(forced))) return ((Number(forced) % 24) + 24) % 24;
  }
  return now.getHours() + now.getMinutes() / 60;
}

export function skyAt(hour: number): SkyState {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.h <= hour) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const t = (hour - a.h) / (b.h - a.h || 1);
  const sunT = (hour - SUNRISE) / (SUNSET - SUNRISE);
  const sun =
    sunT > -0.02 && sunT < 1.02
      ? {
          x: 0.1 + 0.8 * sunT,
          alt: Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, sunT)))),
          color: lerpRGB([255, 140, 70], [255, 236, 170], Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, sunT))) * 1.6)),
        }
      : null;
  const stars = lerp(a.stars, b.stars, t);
  return {
    hour,
    top: css(lerpRGB(a.top, b.top, t)),
    mid: css(lerpRGB(a.mid, b.mid, t)),
    bot: css(lerpRGB(a.bot, b.bot, t)),
    stars,
    clouds: lerp(a.clouds, b.clouds, t),
    cloud: lerpRGB(a.cloud, b.cloud, t),
    sun,
    moon: Math.max(0, (stars - 0.5) * 2),
  };
}

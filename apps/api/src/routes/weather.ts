import { Router } from 'express';
import { uid } from '../lib/auth';
import { HttpError } from '../lib/http';
import { num } from '../lib/serialize';
import { loadContext } from '../services/context';

/**
 * Clima actual y salida/puesta del sol para pintar el cielo del fondo.
 * Fuente: Open-Meteo (gratuito, sin llave). Sólo se envían coordenadas aproximadas
 * (2 decimales ≈ 1 km), nunca datos del usuario.
 */
export const weatherRouter = Router();

interface Weather {
  place: string;
  code: number;
  cloudCover: number;
  precipitation: number;
  windKmh: number;
  temperatureC: number;
  isDay: boolean;
  sunrise: string; // HH:mm local del lugar
  sunset: string;
  fetchedAt: string;
}

const cache = new Map<string, { at: number; data: Omit<Weather, 'place'> }>();
const TTL = 10 * 60_000;

weatherRouter.get('/weather', async (req, res) => {
  const ctx = await loadContext(uid(req));
  const lat = Number(num(ctx.settings.weatherLatitude)!.toFixed(2));
  const lon = Number(num(ctx.settings.weatherLongitude)!.toFixed(2));
  const key = `${lat},${lon}`;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > TTL) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=weather_code,cloud_cover,is_day,precipitation,wind_speed_10m,temperature_2m&daily=sunrise,sunset&timezone=auto&forecast_days=1';
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (!r?.ok) {
      if (hit) return void res.json({ place: ctx.settings.weatherPlace, ...hit.data });
      throw new HttpError(502, 'No se pudo consultar el clima');
    }
    const j = (await r.json()) as {
      current: { weather_code: number; cloud_cover: number; is_day: number; precipitation: number; wind_speed_10m: number; temperature_2m: number };
      daily: { sunrise: string[]; sunset: string[] };
    };
    hit = {
      at: Date.now(),
      data: {
        code: j.current.weather_code,
        cloudCover: j.current.cloud_cover,
        precipitation: j.current.precipitation,
        windKmh: j.current.wind_speed_10m,
        temperatureC: j.current.temperature_2m,
        isDay: j.current.is_day === 1,
        sunrise: j.daily.sunrise[0]!.slice(11, 16),
        sunset: j.daily.sunset[0]!.slice(11, 16),
        fetchedAt: new Date().toISOString(),
      },
    };
    cache.set(key, hit);
  }
  res.setHeader('Cache-Control', 'private, max-age=600');
  res.json({ place: ctx.settings.weatherPlace, ...hit.data } satisfies Weather);
});

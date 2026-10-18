import { clsx, type ClassValue } from 'clsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

export const fmtKg = (kg: number | null | undefined, digits: 1 | 2 = 1) =>
  kg === null || kg === undefined ? '—' : `${(digits === 1 ? nf1 : nf2).format(kg)} kg`;

export const fmtSignedKg = (kg: number | null | undefined) => {
  if (kg === null || kg === undefined) return '—';
  const s = nf1.format(Math.abs(kg));
  return kg === 0 ? '0 kg' : `${kg < 0 ? '−' : '+'}${s} kg`;
};

export const fmtLiters = (ml: number) => `${nf1.format(ml / 1000)} L`;
export const fmtNum = (n: number) => nf1.format(n);

export const fmtDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

/** Claves YYYY-MM-DD → texto en español de México. */
export const fmtDate = (key: string, pattern = "EEEE d 'de' MMMM") => format(parseISO(key), pattern, { locale: es });
export const fmtShortDate = (key: string) => format(parseISO(key), 'd MMM', { locale: es });
export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** Valor para <input type="datetime-local"> en hora local del dispositivo. */
export function toLocalInput(date: Date = new Date()) {
  const off = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - off).toISOString().slice(0, 16);
}
export const fromLocalInput = (value: string) => new Date(value).toISOString();

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function greeting(minutes: number) {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return 'Buenos días';
  if (minutes >= 12 * 60 && minutes < 19 * 60) return 'Buenas tardes';
  return 'Buenas noches';
}

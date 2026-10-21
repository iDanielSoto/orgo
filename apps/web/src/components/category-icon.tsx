/** Ícono por categoría de gasto (por nombre, para que también sirva con las que crees tú). */
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Car,
  CircleEllipsis,
  Clapperboard,
  CreditCard,
  GraduationCap,
  Heart,
  HeartPulse,
  Lightbulb,
  Repeat,
  ShoppingBag,
  Tag,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/format';

const RULES: [RegExp, LucideIcon][] = [
  [/aliment|comida|super|restaur|cafe/, Utensils],
  [/transport|gasolin|uber|auto|carro/, Car],
  [/servicio|luz|agua|gas\b/, Lightbulb],
  [/internet|telefon|celular/, Wifi],
  [/salud|medic|farmac/, HeartPulse],
  [/educa|escuela|curso|libro/, GraduationCap],
  [/compra|ropa|tienda/, ShoppingBag],
  [/entreten|cine|juego|salida/, Clapperboard],
  [/pareja|novi|regalo/, Heart],
  [/deuda|tarjeta|credito|prestamo/, CreditCard],
  [/suscrip|netflix|spotify/, Repeat],
  [/otro/, CircleEllipsis],
];

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  const n = plain(name);
  return RULES.find(([re]) => re.test(n))?.[1] ?? Tag;
}

/** Círculo con el ícono; los ingresos van en verde y las transferencias neutras. */
export function CategoryBadge({ name, kind, size = 40, className }: { name: string | null; kind?: 'INCOME' | 'TRANSFER' | 'EXPENSE' | 'ADJUSTMENT'; size?: number; className?: string }) {
  const Icon = kind === 'INCOME' ? ArrowDownLeft : kind === 'TRANSFER' ? ArrowLeftRight : categoryIcon(name);
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full', kind === 'INCOME' ? 'bg-green/15 text-green' : 'bg-fill text-ink', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
    </span>
  );
}

import { UserRound } from 'lucide-react';
import { cn } from '@/lib/format';

/** Foto de perfil con esquinas al 20 % (como en el portafolio) o silueta si no hay foto. */
export function Avatar({ version, size, className }: { version: number | null | undefined; size: number; className?: string }) {
  const style = { width: size, height: size, borderRadius: '20%' };
  if (!version) {
    return (
      <span style={style} className={cn('glass grid shrink-0 place-items-center text-ink-2', className)} aria-hidden>
        <UserRound style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={1.6} />
      </span>
    );
  }
  return <img src={`/api/profile/avatar?v=${version}`} alt="Tu foto de perfil" style={style} className={cn('shrink-0 object-cover shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)]', className)} />;
}

/** Anillo de cumplimiento de un día (0–1), como los de Actividad de iOS. */
export function DayRing({ score, size = 44, track = true }: { score: number | undefined; size?: number; track?: boolean }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className="-rotate-90" aria-hidden>
      {track && <circle cx="22" cy="22" r={r} fill="none" stroke="var(--sep)" strokeWidth="3" />}
      {score !== undefined && score > 0 && (
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--tint)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * score} ${c}`} className="transition-[stroke-dasharray] duration-500" />
      )}
    </svg>
  );
}

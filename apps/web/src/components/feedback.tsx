/** Retroalimentación común (Finanzas y Salud): píldora de estado y tarjetas de consejo. */
import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';

export type Tone = 'good' | 'calm' | 'bad';

const TONE: Record<Tone, { icon: LucideIcon; cls: string }> = {
  good: { icon: CircleCheck, cls: 'bg-green/15 text-green' },
  calm: { icon: TriangleAlert, cls: 'bg-star/15 text-star' },
  bad: { icon: CircleX, cls: 'bg-red/15 text-red' },
};

export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold', t.cls, className)}>
      <t.icon className="size-[18px]" strokeWidth={2.2} />
      {label}
    </span>
  );
}

export interface Tip {
  icon: LucideIcon;
  text: string;
  action?: { label: string; run: () => void };
}

/** Hasta tres consejos, en el orden en que llegan (del más urgente al más amable). */
export function TipList({ tips, title = 'Consejos' }: { tips: Tip[]; title?: string }) {
  if (!tips.length) return null;
  return (
    <section>
      <h2 className="text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 space-y-3">
        {tips.slice(0, 3).map((t) => (
          <article key={t.text} className="glass flex gap-3.5 rounded-[26px] p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-tint/15 text-tint">
              <t.icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] leading-snug">{t.text}</p>
              {t.action && (
                <button onClick={t.action.run} className="press mt-2 text-[15px] font-semibold text-tint">
                  {t.action.label}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

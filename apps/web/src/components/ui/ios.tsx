/** Controles con la forma de iOS 27, sobre el vidrio del portafolio. */
import { ChevronRight } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import * as React from 'react';
import { HeatWord } from '@/components/portfolio';
import { cn } from '@/lib/format';

// --- Títulos -------------------------------------------------------------------

export function LargeTitle({ text, trailing }: { text: string; trailing?: React.ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-3 pt-3">
      <HeatWord text={text} className="text-[40px] font-bold leading-none tracking-[-0.035em]" />
      {trailing}
    </header>
  );
}

// --- Vidrio --------------------------------------------------------------------

export function GlassCircle({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('glass press grid size-11 place-items-center rounded-full [&_svg]:size-5', className)} {...props} />;
}

/** Burbuja de vidrio (glass-bubble del portafolio) con un dato. */
export function Bubble({
  label,
  value,
  icon,
  onClick,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  tone?: 'tint' | 'star';
}) {
  return (
    <button onClick={onClick} className="glass press flex aspect-square w-full flex-col items-center justify-center rounded-full">
      {icon && (
        <span className={cn('mb-2.5 text-ink-2 [&_svg]:size-[26px]', tone === 'tint' && 'text-tint', tone === 'star' && 'text-star')} aria-hidden>
          {icon}
        </span>
      )}
      <span className={cn('text-[30px] font-semibold leading-none tracking-[-0.03em] tabular', tone === 'tint' && 'text-tint', tone === 'star' && 'text-star')}>{value}</span>
      <span className="mt-2 text-[15px] text-ink-2">{label}</span>
    </button>
  );
}

export function Capsule({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('glass press inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[17px] font-semibold [&_svg]:size-5', className)} {...props} />;
}

// --- Listas agrupadas ----------------------------------------------------------

export function List({ header, children }: { header?: string; children: React.ReactNode }) {
  return (
    <section>
      {header && <h2 className="mb-1.5 ml-5 text-[13px] uppercase tracking-wide text-ink-3">{header}</h2>}
      <div className="overflow-hidden rounded-[26px] bg-[rgba(8,12,30,0.32)] backdrop-blur-xl [&>*+*]:border-t [&>*+*]:border-sep">{children}</div>
    </section>
  );
}

export function Item({ label, detail, onClick, destructive }: { label: React.ReactNode; detail?: React.ReactNode; onClick?: () => void; destructive?: boolean }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('flex min-h-[52px] w-full items-center gap-3 px-5 py-3 text-left', onClick && 'active:bg-white/[0.06]')}>
      <span className={cn('flex-1 text-[17px]', destructive && 'text-red')}>{label}</span>
      {detail !== undefined && <span className="text-[17px] text-ink-2 tabular">{detail}</span>}
      {onClick && !destructive && <ChevronRight className="-mr-1 size-4 text-ink-3" strokeWidth={2.5} />}
    </Comp>
  );
}

// --- Hoja (Cancelar · Título · Guardar) ----------------------------------------

export function Sheet({
  open,
  onOpenChange,
  title,
  onDone,
  doneLabel = 'Guardar',
  doneDisabled,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-[fade_180ms_ease-out]" />
        <D.Content className="fixed inset-x-2 bottom-2 z-50 mx-auto max-h-[90dvh] max-w-[520px] overflow-y-auto glass glass-thick rounded-[38px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 data-[state=open]:animate-[sheet-up_320ms_cubic-bezier(0.16,1,0.3,1)]">
          <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-white/25" />
          <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center">
            <D.Close className="glass press justify-self-start rounded-full px-4 py-2 text-[16px]">Cancelar</D.Close>
            <D.Title className="text-[17px] font-semibold">{title}</D.Title>
            {onDone ? (
              <button
                onClick={onDone}
                disabled={doneDisabled}
                className="press justify-self-end rounded-full bg-tint px-4 py-2 text-[16px] font-semibold text-[#06102a] disabled:opacity-35"
              >
                {doneLabel}
              </button>
            ) : (
              <span />
            )}
          </div>
          <D.Description className="sr-only">{title}</D.Description>
          <div className="space-y-6">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

// --- Controles -----------------------------------------------------------------

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="flex rounded-full bg-white/[0.08] p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-9 flex-1 whitespace-nowrap rounded-full px-2 text-[15px] font-medium text-ink-2 transition-colors', value === o.value && 'bg-white/[0.22] text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-[52px] items-center gap-3 px-5 py-2">
      <span className="flex-1 text-[17px]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-[31px] w-[51px] rounded-full transition-colors', checked ? 'bg-green' : 'bg-white/[0.16]')}
      >
        <span className={cn('absolute top-[2px] size-[27px] rounded-full bg-white shadow transition-[left]', checked ? 'left-[22px]' : 'left-[2px]')} />
      </button>
    </label>
  );
}

/** Número grande al centro, teclado numérico (como en Salud de iOS). */
export function BigNumber({ value, onChange, unit, decimal }: { value: string; onChange: (v: string) => void; unit: string; decimal?: boolean }) {
  return (
    <label className="flex items-baseline justify-center gap-2 py-6">
      <input
        autoFocus
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, '').replace(',', '.'))}
        className="w-[5ch] bg-transparent text-right text-[64px] font-semibold leading-none tracking-[-0.04em] text-ink caret-tint tabular focus:outline-none"
      />
      <span className="text-[24px] font-semibold text-ink-2">{unit}</span>
    </label>
  );
}

/** Fila con una hora (rueda nativa de iOS). */
export function TimeItem({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-h-[52px] items-center gap-3 px-5 py-2">
      <span className="flex-1 text-[17px]">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-[10px] bg-white/[0.1] px-3 py-1.5 text-[17px] text-ink tabular" />
    </label>
  );
}

export function TextItem(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="h-[52px] w-full bg-transparent px-5 text-[17px] text-ink placeholder:text-ink-3 focus:outline-none" />;
}

/** Texto largo dentro de una lista: etiqueta pequeña arriba y el contenido debajo. */
export function TextBlock({ label, text }: { label: string; text: React.ReactNode }) {
  return (
    <div className="px-5 py-3">
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="mt-0.5 text-[16px] leading-snug text-ink">{text}</p>
    </div>
  );
}

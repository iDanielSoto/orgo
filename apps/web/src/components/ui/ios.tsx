/** Controles con la forma de iOS 27, sobre el vidrio del portafolio. */
import { ChevronLeft, ChevronRight, Delete } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import * as React from 'react';
import { useNavigate } from 'react-router';
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

/** Atrás; si la pantalla se abrió directo (sin historial), vuelve a `fallback`. */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate();
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(fallback, { replace: true }));
  return (
    <GlassCircle aria-label="Atrás" onClick={back} className="mb-2">
      <ChevronLeft className="-ml-0.5" />
    </GlassCircle>
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
      <div className="overflow-hidden rounded-[26px] bg-[var(--card)] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.18)] [html[data-theme=light]_&]:shadow-[0_0_0_0.5px_rgba(0,0,0,0.05)] backdrop-blur-xl [&>*+*]:border-t [&>*+*]:border-sep">{children}</div>
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

/**
 * Arrastrar la hoja hacia abajo para cerrarla, como en iOS: sigue al dedo cuando su contenido
 * está arriba del todo y se cierra si bajas lo suficiente o la sueltas con impulso.
 */
function useDragToClose(close: () => void) {
  const content = React.useRef<HTMLDivElement>(null);
  const overlay = React.useRef<HTMLDivElement>(null);
  const g = React.useRef<{ y: number; t: number; dy: number; active: boolean } | null>(null);

  const set = (dy: number, animate: boolean) => {
    const el = content.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 260ms cubic-bezier(0.16,1,0.3,1)' : 'none';
    el.style.transform = dy ? `translateY(${dy}px)` : '';
    if (overlay.current) overlay.current.style.opacity = String(Math.max(0, 1 - dy / 400));
  };

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const el = content.current;
      if (!el || el.scrollTop > 0 || (e.target as HTMLElement).closest('input, textarea, [data-no-drag]')) return;
      g.current = { y: e.touches[0]!.clientY, t: e.timeStamp, dy: 0, active: false };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = g.current;
      if (!s) return;
      const dy = e.touches[0]!.clientY - s.y;
      if (!s.active && (dy < 6 || (content.current?.scrollTop ?? 0) > 0)) {
        if (dy < 0) g.current = null; // va hacia arriba: es scroll
        return;
      }
      s.active = true;
      s.dy = Math.max(0, dy);
      set(s.dy, false);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = g.current;
      g.current = null;
      if (!s?.active) return;
      const speed = s.dy / Math.max(1, e.timeStamp - s.t);
      if (s.dy > 140 || speed > 0.6) {
        set(content.current?.offsetHeight ?? 600, true);
        setTimeout(close, 200);
      } else set(0, true);
    },
  };
  return { content, overlay, handlers };
}

/**
 * Con el teclado del iPhone abierto (al escribir texto), la hoja se apoya justo encima de él en
 * vez de que iOS empuje toda la página: se mide con visualViewport.
 */
function useKeyboardInset(open: boolean) {
  const [vv, setVv] = React.useState<{ inset: number; height: number } | null>(null);
  React.useEffect(() => {
    const v = window.visualViewport;
    if (!open || !v) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - v.height - v.offsetTop);
      setVv(inset > 80 ? { inset, height: v.height } : null);
    };
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    update();
    return () => {
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
      setVv(null);
    };
  }, [open]);
  return vv;
}

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
  const drag = useDragToClose(() => onOpenChange(false));
  const kb = useKeyboardInset(open);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay ref={drag.overlay} className="fixed inset-0 z-50 bg-[#000]/20 data-[state=open]:animate-[fade_180ms_ease-out]" />
        <D.Content
          ref={drag.content}
          {...drag.handlers}
          style={kb ? { bottom: kb.inset + 8, maxHeight: kb.height - 16 } : undefined}
          className="fixed inset-x-2 bottom-2 z-50 mx-auto max-h-[90dvh] max-w-[520px] overflow-y-auto overscroll-contain glass glass-thick rounded-[38px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 data-[state=open]:animate-[sheet-up_320ms_cubic-bezier(0.16,1,0.3,1)]"
        >
          <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-white/25" />
          <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <D.Close className="glass press h-9 justify-self-start whitespace-nowrap rounded-full px-3.5 text-[15px]">Cancelar</D.Close>
            <D.Title className="max-w-[44vw] truncate whitespace-nowrap text-[17px] font-semibold">{title}</D.Title>
            {onDone ? (
              <button
                onClick={onDone}
                disabled={doneDisabled}
                className="press h-9 justify-self-end whitespace-nowrap rounded-full bg-tint px-3.5 text-[15px] font-semibold text-[#06102a] disabled:opacity-35"
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
        <span className={cn('absolute top-[2px] size-[27px] rounded-full bg-[#fff] shadow transition-[left]', checked ? 'left-[22px]' : 'left-[2px]')} />
      </button>
    </label>
  );
}

/**
 * Número grande al centro con su teclado propio: nunca abre el teclado del iPhone, así que la
 * página no se mueve. Con `keypad={false}` sólo muestra el número (el teclado va aparte).
 */
export function BigNumber({
  value,
  onChange,
  unit,
  prefix,
  decimal,
  keypad = true,
}: {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  prefix?: string;
  decimal?: boolean;
  keypad?: boolean;
}) {
  const [int, dec] = (value || '0').split('.');
  const shown = Number(int || '0').toLocaleString('es-MX') + (dec !== undefined ? `.${dec}` : '');
  return (
    <div>
      <p className="flex items-baseline justify-center gap-1.5 py-3 text-[60px] font-semibold leading-none tracking-[-0.045em] tabular" aria-live="polite">
        {prefix && <span className="text-ink-3">{prefix}</span>}
        <span className={value ? 'text-ink' : 'text-ink-3'}>{shown}</span>
        {unit && <span className="ml-1 text-[22px] tracking-[-0.01em] text-ink-2">{unit}</span>}
      </p>
      {keypad && (
        <div className="mt-3">
          <Keypad value={value} onChange={onChange} decimal={decimal} />
        </div>
      )}
    </div>
  );
}

/** Teclado numérico propio (como el de Apple Cash). */
export function Keypad({ value, onChange, decimal = true }: { value: string; onChange: (v: string) => void; decimal?: boolean }) {
  const press = (k: string) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    const [int = '', dec] = value.split('.');
    if (k === '.') return dec === undefined && onChange((value || '0') + '.');
    if (dec !== undefined ? dec.length >= 2 : int.length >= 7) return;
    onChange(value === '0' ? k : value + k);
  };
  return (
    <div className="grid grid-cols-3 gap-2" data-no-drag>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? '.' : '', '0', 'del'].map((k, i) =>
        k ? (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === 'del' ? 'Borrar' : k === '.' ? 'Punto decimal' : k}
            className="grid h-[52px] place-items-center rounded-2xl bg-fill text-[26px] font-medium tabular active:bg-white/[0.14]"
          >
            {k === 'del' ? <Delete className="size-6" strokeWidth={1.8} /> : k}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
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

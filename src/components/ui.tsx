import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, GearIcon } from './icons';

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start gap-2 pb-4 pt-2">
      {back && (
        <Link href={back} className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full text-muted" aria-label="Tilbage">
          <ChevronLeft />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {subtitle && <p className="text-[0.9rem] text-muted">{subtitle}</p>}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">{title}</h1>
      </div>
      {action ??
        (!back && (
          <Link href="/indstillinger" className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted" aria-label="Indstillinger">
            <GearIcon />
          </Link>
        ))}
    </header>
  );
}

export function Section({ title, hint, children, className = '' }: { title?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2 className="font-display text-[1.15rem] font-semibold">{title}</h2>}
      {hint && <p className="hint mt-0.5">{hint}</p>}
      <div className={title || hint ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

/** Tekstfelt der vokser med indholdet. */
export function AutoTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; ref?: Ref<HTMLTextAreaElement | null> },
) {
  const { minRows = 2, className = '', ref: outerRef, ...rest } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(outerRef, () => ref.current as HTMLTextAreaElement, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={minRows} className={`field resize-none leading-relaxed ${className}`} {...rest} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-sand p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 whitespace-nowrap rounded-full px-2 text-[0.88rem] font-medium transition ${
            value === o.value ? 'bg-card text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SaveStatus({ status }: { status: 'idle' | 'pending' | 'saved' }) {
  return (
    <span aria-live="polite" className="shrink-0 whitespace-nowrap text-[0.85rem] text-muted">
      {status === 'pending' ? 'Gemmer …' : status === 'saved' ? 'Gemt ✓' : ''}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-16 shrink-0 items-center justify-center"
    >
      <span className={`relative h-8 w-14 rounded-full transition ${checked ? 'bg-sage' : 'bg-sand'}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-card shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  );
}

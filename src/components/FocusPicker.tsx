import { FOCUS_AREAS, type FocusArea } from '../data/focus';
import { CheckIcon } from './icons';

export function FocusPicker({ value, onChange, max = 3 }: { value: FocusArea[]; onChange: (v: FocusArea[]) => void; max?: number }) {
  const toggle = (id: FocusArea) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (value.length < max) onChange([...value, id]);
  };
  return (
    <div className="grid gap-2">
      {FOCUS_AREAS.map((f) => {
        const on = value.includes(f.id);
        const disabled = !on && value.length >= max;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(f.id)}
            className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left transition ${
              on ? 'border-sage bg-sage-soft' : 'border-line bg-card'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <span className="font-medium">{f.label}</span>
            <span className={`flex size-7 items-center justify-center rounded-full ${on ? 'bg-sage text-on-sage' : 'border border-line'}`}>
              {on && <CheckIcon width={18} height={18} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

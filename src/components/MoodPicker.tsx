export const MOODS = [
  { value: 1, emoji: '😞', label: 'Tungt' },
  { value: 2, emoji: '🙁', label: 'Lidt svært' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Godt' },
  { value: 5, emoji: '😄', label: 'Rigtig godt' },
];

export function MoodPicker({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label="Humør" className="grid grid-cols-5 gap-1.5">
      {MOODS.map((m) => {
        const on = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            onClick={() => onChange(on ? undefined : m.value)}
            className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border transition ${
              on ? 'border-sage bg-sage-soft' : 'border-transparent bg-bg'
            }`}
          >
            <span className={`text-[1.9rem] leading-none transition ${on ? 'scale-110' : value ? 'opacity-55' : ''}`}>{m.emoji}</span>
            <span className="text-[0.7rem] leading-tight text-muted">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EnergyPicker({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label="Energi" className="flex items-center gap-1.5">
      <span className="w-10 text-[0.8rem] text-muted">Lav</span>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value === n;
        const filled = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`Energi ${n} af 5`}
            onClick={() => onChange(on ? undefined : n)}
            className="flex min-h-11 flex-1 items-center justify-center"
          >
            <span className={`h-3 w-full rounded-full transition ${filled ? 'bg-sage' : 'bg-sand'}`} />
          </button>
        );
      })}
      <span className="w-10 text-right text-[0.8rem] text-muted">Høj</span>
    </div>
  );
}

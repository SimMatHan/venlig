import { useState } from 'react';
import { PlusIcon, XIcon } from './icons';

export const VALUE_SUGGESTIONS = ['Venlighed', 'Nærvær', 'Ærlighed', 'Mod', 'Familie', 'Kreativitet', 'Ro', 'Nysgerrighed', 'Sundhed', 'Fællesskab'];

export function ValuesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (v: string) => {
    const t = v.trim();
    if (!t || value.length >= 5 || value.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setDraft('');
  };
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {value.map((v) => (
          <li key={v} className="chip chip-on gap-1 pr-1">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Fjern ${v}`} className="flex size-9 items-center justify-center rounded-full">
              <XIcon width={16} height={16} />
            </button>
          </li>
        ))}
      </ul>
      {value.length < 5 && (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add(draft);
            }}
          >
            <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Skriv en værdi" maxLength={40} aria-label="Ny værdi" />
            <button type="submit" className="btn btn-soft shrink-0 px-4" aria-label="Tilføj værdi">
              <PlusIcon />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {VALUE_SUGGESTIONS.filter((s) => !value.includes(s)).slice(0, 6).map((s) => (
              <button key={s} type="button" className="chip text-muted" onClick={() => add(s)}>
                + {s}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="hint mt-3">{value.length < 3 ? `Vælg gerne 3–5 værdier (${value.length} valgt).` : `${value.length} af højst 5 værdier.`}</p>
    </div>
  );
}

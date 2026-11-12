import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'wouter';
import { isSunday, todayKey, weekSunday } from '../lib/dates';
import { db, type ValueReflection } from '../lib/db';
import { useSettings } from '../lib/settings';
import { AutoTextarea } from './ui';

const ANSWERS: { value: ValueReflection['answer']; label: string }[] = [
  { value: 'ja', label: 'Ja, for det meste' },
  { value: 'delvist', label: 'Delvist' },
  { value: 'lidt', label: 'Ikke så meget' },
];

const REPLIES: Record<ValueReflection['answer'], string> = {
  ja: 'Hvor fint. Læg mærke til, hvordan det føles.',
  delvist: 'Delvist er også en vej. Hvad hjalp dig, når det lykkedes?',
  lidt: 'Det er helt okay – nogle uger er bare sådan. En ny uge er en ny begyndelse.',
};

/** "Mine værdier" + søndagens lille refleksion. */
export function ValuesSection() {
  const settings = useSettings();
  const today = todayKey();
  const week = weekSunday(today);
  const reflection = useLiveQuery(() => db.valueReflections.get(week), [week]);
  const [note, setNote] = useState<string | null>(null);
  const values = settings?.values ?? [];

  const answer = (a: ValueReflection['answer']) =>
    db.valueReflections.put({ week, answer: a, note: reflection?.note ?? '', createdAt: reflection?.createdAt ?? Date.now() });

  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[1.15rem] font-semibold">Mine værdier</h2>
        <Link href="/indstillinger#vaerdier" className="min-h-11 content-center px-1 text-[0.9rem] text-sage">
          Rediger
        </Link>
      </div>
      {values.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v} className="rounded-full bg-sage-soft px-4 py-2 text-[0.95rem]">
              {v}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint mt-1">Du har ikke valgt nogen værdier endnu. Tilføj 3–5 under Rediger.</p>
      )}

      {isSunday(today) && values.length > 0 && (
        <div className="mt-5 rounded-2xl bg-bg p-4">
          <p className="font-medium">Levede du i tråd med dine værdier denne uge?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ANSWERS.map((a) => (
              <button key={a.value} type="button" aria-pressed={reflection?.answer === a.value} onClick={() => answer(a.value)} className={`chip ${reflection?.answer === a.value ? 'chip-on' : ''}`}>
                {a.label}
              </button>
            ))}
          </div>
          {reflection && (
            <>
              <p className="mt-3 text-[0.95rem] text-muted">{REPLIES[reflection.answer]}</p>
              <AutoTextarea
                className="mt-3"
                value={note ?? reflection.note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note != null && db.valueReflections.update(week, { note })}
                placeholder="Et øjeblik, hvor du mærkede en af dine værdier … (valgfrit)"
                aria-label="Note til ugens refleksion"
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

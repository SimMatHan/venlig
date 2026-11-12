import { useState } from 'react';
import { addDays, formatLong, formatMonth, toKey, todayKey } from '../lib/dates';
import { ChevronLeft, ChevronRight } from './icons';

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const LEVEL_TEXT = ['Ingen registrering', 'Lidt registreret', 'Noget registreret', 'Meget registreret', 'Rigtig meget registreret'];

/** Månedskalender, hvor farven viser, hvor meget man registrerede – aldrig humøret. */
export function Heatmap({ levelFor, onMonthChange }: { levelFor: (date: string) => number; onMonthChange?: (y: number, m: number) => void }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayKey();

  const first = toKey(new Date(ym.y, ym.m, 1));
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();

  const go = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() };
    setYm(next);
    setSelected(null);
    onMonthChange?.(next.y, next.m);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className="flex size-11 items-center justify-center rounded-full text-muted" aria-label="Forrige måned">
          <ChevronLeft />
        </button>
        <p className="font-medium">{formatMonth(ym.y, ym.m)}</p>
        <button type="button" onClick={() => go(1)} disabled={isCurrent} className="flex size-11 items-center justify-center rounded-full text-muted disabled:opacity-30" aria-label="Næste måned">
          <ChevronRight />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[3px] text-center text-[0.75rem] text-muted" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]" role="grid" aria-label={`Registreringer i ${formatMonth(ym.y, ym.m)}`}>
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = addDays(first, i);
          const future = key > today;
          const level = future ? 0 : levelFor(key);
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              disabled={future}
              onClick={() => setSelected(selected === key ? null : key)}
              aria-label={`${formatLong(key)}: ${LEVEL_TEXT[level]}`}
              aria-selected={selected === key}
              className={`flex aspect-square items-center justify-center rounded-lg text-[0.78rem] transition ${
                selected === key ? 'ring-2 ring-ink ring-offset-1 ring-offset-card' : ''
              } ${future ? 'opacity-40' : ''} ${key === today ? 'font-bold' : ''}`}
              style={{ background: `var(--heat-${level})`, color: level >= 3 ? 'var(--on-sage)' : 'var(--ink)' }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-6 text-[0.88rem] text-muted" aria-live="polite">
        {selected ? `${formatLong(selected)} · ${LEVEL_TEXT[levelFor(selected)]}` : ''}
      </p>
      <div className="mt-1 flex items-center justify-end gap-1.5 text-[0.75rem] text-muted">
        <span>Mindre</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-3.5 rounded" style={{ background: `var(--heat-${l})` }} />
        ))}
        <span>Mere</span>
      </div>
    </div>
  );
}

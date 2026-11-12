import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Heatmap } from '../components/Heatmap';
import { MoodChart, type ChartPoint } from '../components/MoodChart';
import { PageHeader, Section, Segmented } from '../components/ui';
import { addDays, formatLong, formatShort, monthKey, todayKey, weekStart } from '../lib/dates';
import { db, hasContent } from '../lib/db';
import { careLevel, entriesByDate, memories, type Memory } from '../lib/stats';

type Period = 'week' | 'month';

export function OverviewPage() {
  const data = useLiveQuery(async () => {
    const [checkIns, entries, habits] = await Promise.all([db.checkins.toArray(), db.entries.toArray(), db.habits.orderBy('order').toArray()]);
    return { checkIns, entries, habits };
  }, []);
  const [period, setPeriod] = useState<Period>('week');
  const [seed, setSeed] = useState(() => Math.random());
  const today = todayKey();

  const derived = useMemo(() => {
    if (!data) return null;
    const byDate = new Map(data.checkIns.map((c) => [c.date, c]));
    const entryCount = entriesByDate(data.entries);
    const month = monthKey(today);
    const registered = new Set<string>();
    for (const c of data.checkIns) if (hasContent(c)) registered.add(c.date);
    for (const d of entryCount.keys()) registered.add(d);
    const daysThisMonth = [...registered].filter((d) => monthKey(d) === month).length;
    const entriesThisMonth = data.entries.filter((e) => monthKey(e.date) === month).length;
    return { byDate, entryCount, daysThisMonth, entriesThisMonth, totalDays: registered.size, mem: memories(data.checkIns, today) };
  }, [data, today]);

  if (!data || !derived) return null;
  const { byDate, entryCount, daysThisMonth, entriesThisMonth, totalDays, mem } = derived;

  const days = period === 'week' ? 7 : 30;
  const start = addDays(today, -(days - 1));
  const points: ChartPoint[] = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const c = byDate.get(date);
    return { date, mood: c?.mood, energy: c?.energy };
  });

  const enabledHabits = data.habits.filter((h) => h.enabled);
  const habitRows = enabledHabits.map((h) => {
    let count = 0;
    for (let i = 0; i < days; i++) if (byDate.get(addDays(start, i))?.habits[h.id]?.done) count++;
    let pages = 0;
    if (h.tracksPages) for (let i = 0; i < days; i++) pages += byDate.get(addDays(start, i))?.habits[h.id]?.pages ?? 0;
    return { h, count, pages };
  });
  const maxCount = Math.max(1, ...habitRows.map((r) => r.count));
  const thisWeekStart = weekStart(today);

  const pick = pickMemories(mem, seed);

  return (
    <>
      <PageHeader title="Overblik" subtitle="Det du har gjort for dig selv" />

      <div className="card mb-4 bg-sage-soft">
        <p className="font-display text-[1.25rem] font-semibold leading-snug">
          {daysThisMonth === 0
            ? 'En ny måned er en blid start.'
            : `Du har registreret ${daysThisMonth} ${daysThisMonth === 1 ? 'dag' : 'dage'} denne måned.`}
        </p>
        <p className="mt-1 text-[0.95rem] text-muted">
          {entriesThisMonth > 0 && `Og skrevet ${entriesThisMonth} ${entriesThisMonth === 1 ? 'dagbogstekst' : 'dagbogstekster'}. `}
          {totalDays > 0 ? `${totalDays} ${totalDays === 1 ? 'dag' : 'dage'} i alt med Venlig.` : 'Hver gang du kigger forbi, tæller.'}
        </p>
      </div>

      <div className="space-y-4">
        <Section title="Kalender" hint="Jo mørkere, jo mere har du registreret den dag.">
          <Heatmap levelFor={(d) => careLevel(byDate.get(d), entryCount.get(d) ?? 0)} />
        </Section>

        <Segmented
          label="Periode"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: 'Sidste 7 dage' },
            { value: 'month', label: 'Sidste 30 dage' },
          ]}
        />

        <Section title="Humør og energi">
          <MoodChart points={points} />
          <details className="mt-2 text-[0.9rem]">
            <summary className="min-h-11 cursor-pointer content-center text-sage">Vis som tabel</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 font-medium">Dato</th>
                  <th className="py-1 font-medium">Humør</th>
                  <th className="py-1 font-medium">Energi</th>
                </tr>
              </thead>
              <tbody>
                {points
                  .filter((p) => p.mood != null || p.energy != null)
                  .map((p) => (
                    <tr key={p.date} className="border-t border-line">
                      <td className="py-1.5">{formatShort(p.date)}</td>
                      <td className="py-1.5">{p.mood ?? '–'}</td>
                      <td className="py-1.5">{p.energy ?? '–'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </Section>

        <Section title="Vaner" hint={period === 'week' ? 'Sidste 7 dage' : 'Sidste 30 dage'}>
          {habitRows.length === 0 && <p className="hint">Du har ingen aktive vaner.</p>}
          <ul className="space-y-3.5">
            {habitRows.map(({ h, count, pages }) => {
              const weekly = h.frequency.kind === 'weekly';
              let weekDone = 0;
              if (weekly) for (let i = 0; i < 7; i++) if (byDate.get(addDays(thisWeekStart, i))?.habits[h.id]?.done) weekDone++;
              return (
                <li key={h.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[0.95rem]">
                    <span className="min-w-0 truncate">
                      <span aria-hidden="true">{h.icon}</span> {h.name}
                    </span>
                    <span className="shrink-0 text-[0.85rem] text-muted">
                      {count} {count === 1 ? 'gang' : 'gange'}
                      {pages > 0 && ` · ${pages} sider`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-sage" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  {weekly && h.frequency.kind === 'weekly' && (
                    <p className="mt-1 text-[0.8rem] text-muted">
                      Denne uge: {weekDone} af {h.frequency.times}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Tilbageblik" hint="Små glimt fra dine tidligere dage.">
          {pick.length === 0 ? (
            <p className="text-muted">Når du har skrevet gode ting ned et par dage, dukker de op her som små påmindelser.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {pick.map((m) => (
                  <li key={`${m.date}-${m.text}`} className="rounded-2xl bg-bg p-4">
                    <p className="text-[0.8rem] text-muted">
                      {formatLong(m.date)} · {m.kind === 'good' ? 'En god ting' : 'Det gjorde jeg godt'}
                    </p>
                    <p className="mt-1 font-display text-[1.05rem] leading-snug">{m.text}</p>
                  </li>
                ))}
              </ul>
              {mem.length > pick.length && (
                <button type="button" className="btn btn-ghost mt-2 -ml-3" onClick={() => setSeed(Math.random())}>
                  Vis andre
                </button>
              )}
            </>
          )}
        </Section>

        <footer className="px-2 pb-4 pt-4 text-[0.85rem] leading-relaxed text-muted">
          <p>
            Venlig er et redskab til egenomsorg og erstatter ikke professionel hjælp. Hvis du har det svært, så tal med din læge, eller find
            hjælp og viden hos{' '}
            <a href="https://psykiatrifonden.dk/" target="_blank" rel="noopener noreferrer" className="text-sage underline">
              Psykiatrifonden
            </a>
            . Har du tanker om selvmord, kan du ringe til{' '}
            <a href="https://www.livslinien.dk/" target="_blank" rel="noopener noreferrer" className="text-sage underline">
              Livslinien
            </a>{' '}
            på <a href="tel:70201201" className="text-sage underline">70 201 201</a>.
          </p>
        </footer>
      </div>
    </>
  );
}

function pickMemories(all: Memory[], seed: number): Memory[] {
  if (all.length <= 3) return all;
  // Deterministisk "tilfældig" udvælgelse ud fra seed, så listen ikke skifter ved hver gengivelse.
  let s = Math.floor(seed * 2 ** 31) || 1;
  const rand = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 3);
}

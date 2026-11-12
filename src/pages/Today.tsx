import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'wouter';
import { CheckIcon, ChevronLeft, ChevronRight } from '../components/icons';
import { EnergyPicker, MoodPicker } from '../components/MoodPicker';
import { AutoTextarea, PageHeader, SaveStatus, Section } from '../components/ui';
import { greeting } from '../data/microcopy';
import { addDays, relativeDay, todayKey, weekStart, type DateKey } from '../lib/dates';
import { db, emptyCheckIn, type CheckIn, type Habit } from '../lib/db';
import { useAutosave } from '../lib/hooks';

export function TodayPage() {
  const today = todayKey();
  const [date, setDate] = useState<DateKey>(today);
  const loaded = useLiveQuery(async () => ({ date, checkIn: await db.checkins.get(date) }), [date]);

  return (
    <>
      <PageHeader title={greeting()} subtitle={relativeDay(date, today)} />
      <div className="mb-4 flex items-center justify-between rounded-full bg-sand/70 p-1">
        <button type="button" onClick={() => setDate(addDays(date, -1))} className="flex size-11 items-center justify-center rounded-full text-muted" aria-label="Forrige dag">
          <ChevronLeft />
        </button>
        <span className="text-[0.95rem] font-medium">{date === today ? 'Dagens tjek-in' : `Tjek-in for ${relativeDay(date, today).toLowerCase()}`}</span>
        <button
          type="button"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          className="flex size-11 items-center justify-center rounded-full text-muted disabled:opacity-30"
          aria-label="Næste dag"
        >
          <ChevronRight />
        </button>
      </div>
      {loaded && loaded.date === date && <CheckInForm key={date} initial={loaded.checkIn ?? emptyCheckIn(date)} />}
    </>
  );
}

function CheckInForm({ initial }: { initial: CheckIn }) {
  const [c, setC] = useState<CheckIn>(initial);
  const status = useAutosave(c, (v) => db.checkins.put({ ...v, updatedAt: Date.now() }));
  const habits = useLiveQuery(() => db.habits.orderBy('order').filter((h) => h.enabled).toArray(), []);
  const ws = weekStart(c.date);
  const weekCheckIns = useLiveQuery(
    () => db.checkins.where('date').between(ws, addDays(ws, 6), true, true).toArray(),
    [ws],
  );

  const set = (patch: Partial<CheckIn>) => setC((prev) => ({ ...prev, ...patch }));
  const setGood = (i: number, text: string) => setC((prev) => ({ ...prev, goodThings: prev.goodThings.map((g, j) => (j === i ? text : g)) }));
  const toggleHabit = (id: string) =>
    setC((prev) => {
      const cur = prev.habits[id];
      return { ...prev, habits: { ...prev.habits, [id]: { ...cur, done: !cur?.done } } };
    });
  const setPages = (id: string, pages: number | undefined) =>
    setC((prev) => ({ ...prev, habits: { ...prev.habits, [id]: { ...prev.habits[id], done: true, pages } } }));

  const weeklyCount = (h: Habit) => {
    const others = (weekCheckIns ?? []).filter((w) => w.date !== c.date && w.habits[h.id]?.done).length;
    return others + (c.habits[h.id]?.done ? 1 : 0);
  };

  const anyGood = c.goodThings.some((g) => g.trim());
  const doneCount = Object.values(c.habits).filter((h) => h.done).length;

  return (
    <div className="space-y-4">
      <Section title="Hvordan har du det?">
        <MoodPicker value={c.mood} onChange={(mood) => set({ mood })} />
        <p className="label mt-5 text-[0.95rem]">
          Energi <span className="font-normal text-muted">(valgfrit)</span>
        </p>
        <EnergyPicker value={c.energy} onChange={(energy) => set({ energy })} />
      </Section>

      <Section title="Tre gode ting" hint="Små ting tæller også – en kop kaffe, et smil, solen.">
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 text-center font-display font-semibold text-sage">{i + 1}</span>
              <input
                className="field"
                value={c.goodThings[i] ?? ''}
                onChange={(e) => setGood(i, e.target.value)}
                placeholder={['Noget der gjorde mig glad', 'Noget jeg er taknemmelig for', 'Et lille lyspunkt'][i]}
                aria-label={`God ting ${i + 1}`}
                enterKeyHint="next"
              />
            </div>
          ))}
        </div>
        {anyGood && (
          <div className="mt-4">
            <label className="hint mb-1.5 block" htmlFor="why">
              Hvorfor gik det godt? <span>(valgfrit)</span>
            </label>
            <AutoTextarea id="why" value={c.whyGood} onChange={(e) => set({ whyGood: e.target.value })} placeholder="Hvad bidrog du selv med?" />
          </div>
        )}
      </Section>

      <Section title="Det gjorde jeg godt i dag">
        <AutoTextarea
          value={c.didWell}
          onChange={(e) => set({ didWell: e.target.value })}
          placeholder="Også hvis det bare var at komme igennem dagen."
          aria-label="Det gjorde jeg godt i dag"
        />
      </Section>

      <Section
        title="Vaner"
        hint={doneCount ? `${doneCount} ting for dig selv i dag` : 'Kryds af, hvad du har gjort for dig selv.'}
      >
        <ul className="-mx-2">
          {(habits ?? []).map((h) => {
            const log = c.habits[h.id];
            const done = !!log?.done;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  aria-pressed={done}
                  onClick={() => toggleHabit(h.id)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition ${done ? 'bg-sage-soft' : ''}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg text-[1.3rem]">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">{h.name}</span>
                    {(h.hint || h.frequency.kind === 'weekly') && (
                      <span className="block text-[0.82rem] text-muted">
                        {h.frequency.kind === 'weekly' ? `${weeklyCount(h)} af ${h.frequency.times} gange denne uge` : h.hint}
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      done ? 'border-sage bg-sage text-on-sage' : 'border-line'
                    }`}
                  >
                    {done && <CheckIcon width={18} height={18} />}
                  </span>
                </button>
                {h.tracksPages && done && (
                  <div className="flex items-center gap-3 px-2 pb-2 pl-15">
                    <label htmlFor={`pages-${h.id}`} className="text-[0.9rem] text-muted">
                      Antal sider
                    </label>
                    <input
                      id={`pages-${h.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="field w-24 py-2"
                      value={log?.pages ?? ''}
                      onChange={(e) => setPages(h.id, e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <Link href="/vaner" className="btn btn-ghost mt-2 -ml-2 px-2 text-[0.95rem]">
          Tilpas vaner
        </Link>
      </Section>

      <div className="flex items-center justify-between px-2 pb-2">
        <p className="text-[0.95rem] text-muted">
          {c.mood != null && anyGood ? 'Fint klaret. Tak fordi du tog dig tid til dig selv.' : 'Alt gemmes automatisk.'}
        </p>
        <SaveStatus status={status} />
      </div>
    </div>
  );
}

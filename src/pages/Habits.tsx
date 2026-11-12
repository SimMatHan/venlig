import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { PlusIcon, TrashIcon } from '../components/icons';
import { PageHeader, Segmented, Toggle } from '../components/ui';
import { HABIT_ICONS } from '../data/habits';
import { db, uid, type Habit } from '../lib/db';

export function HabitsPage() {
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray(), []);
  const [editing, setEditing] = useState<string | null>(null);

  const addHabit = async () => {
    const id = uid();
    const order = (habits?.at(-1)?.order ?? 0) + 1;
    await db.habits.add({ id, name: '', icon: '🌱', frequency: { kind: 'daily' }, enabled: true, builtin: false, order });
    setEditing(id);
  };

  const move = async (h: Habit, dir: -1 | 1) => {
    if (!habits) return;
    const i = habits.findIndex((x) => x.id === h.id);
    const other = habits[i + dir];
    if (!other) return;
    await db.transaction('rw', db.habits, async () => {
      await db.habits.update(h.id, { order: other.order });
      await db.habits.update(other.id, { order: h.order });
    });
  };

  return (
    <>
      <PageHeader title="Dine vaner" subtitle="Tilpas listen, så den passer til dig" back="/" />
      <ul className="space-y-3">
        {(habits ?? []).map((h, i) =>
          editing === h.id ? (
            <HabitEditor key={h.id} habit={h} onDone={() => setEditing(null)} />
          ) : (
            <li key={h.id} className="card flex items-center gap-3 py-3 pr-3">
              <span className="text-[1.4rem]">{h.icon}</span>
              <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEditing(h.id)}>
                <span className={`block leading-snug ${h.enabled ? '' : 'text-muted'}`}>{h.name || 'Unavngivet vane'}</span>
                <span className="block text-[0.82rem] text-muted">
                  {h.frequency.kind === 'daily' ? 'Dagligt' : `${h.frequency.times} gange om ugen`} · tryk for at redigere
                </span>
              </button>
              <div className="flex flex-col">
                <button type="button" onClick={() => move(h, -1)} disabled={i === 0} className="h-6 w-8 text-muted disabled:opacity-20" aria-label={`Flyt ${h.name} op`}>
                  ▲
                </button>
                <button type="button" onClick={() => move(h, 1)} disabled={i === (habits?.length ?? 0) - 1} className="h-6 w-8 text-muted disabled:opacity-20" aria-label={`Flyt ${h.name} ned`}>
                  ▼
                </button>
              </div>
              <Toggle checked={h.enabled} onChange={(enabled) => db.habits.update(h.id, { enabled })} label={`Vis ${h.name}`} />
            </li>
          ),
        )}
      </ul>
      <button type="button" onClick={addHabit} className="btn btn-soft mt-4 w-full">
        <PlusIcon /> Ny vane
      </button>
      <p className="hint mt-4 px-2">Slåede-fra vaner skjules fra I dag, men din historik gemmes.</p>
    </>
  );
}

function HabitEditor({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const [h, setH] = useState(habit);
  const save = async () => {
    await db.habits.put({ ...h, name: h.name.trim() || 'Min vane' });
    onDone();
  };
  const cancel = async () => {
    // En ny vane, der aldrig fik et navn, skal ikke blive liggende.
    if (!habit.name) await db.habits.delete(habit.id);
    onDone();
  };
  const remove = async () => {
    if (!confirm(`Slet vanen "${h.name || 'Unavngivet'}"? Afkrydsninger i tidligere tjek-ins bliver liggende.`)) return;
    await db.habits.delete(h.id);
    onDone();
  };
  return (
    <li className="card space-y-4">
      <div>
        <label className="label" htmlFor="habit-name">
          Navn
        </label>
        <input id="habit-name" className="field" value={h.name} autoFocus onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="Fx Drak et glas vand" maxLength={60} />
      </div>
      <div>
        <p className="label">Ikon</p>
        <div className="flex flex-wrap gap-1.5">
          {HABIT_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setH({ ...h, icon })}
              aria-pressed={h.icon === icon}
              className={`size-11 rounded-xl text-[1.3rem] ${h.icon === icon ? 'bg-sage-soft ring-2 ring-sage' : 'bg-bg'}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Hvor ofte?</p>
        <Segmented
          label="Frekvens"
          value={h.frequency.kind}
          onChange={(kind) => setH({ ...h, frequency: kind === 'daily' ? { kind } : { kind, times: 3 } })}
          options={[
            { value: 'daily', label: 'Dagligt' },
            { value: 'weekly', label: 'X gange om ugen' },
          ]}
        />
        {h.frequency.kind === 'weekly' && (
          <div className="mt-3 flex items-center justify-center gap-4">
            <button type="button" className="btn btn-soft size-12 px-0" aria-label="Færre" onClick={() => setH({ ...h, frequency: { kind: 'weekly', times: Math.max(1, (h.frequency as { times: number }).times - 1) } })}>
              −
            </button>
            <span className="min-w-28 text-center font-medium">{h.frequency.times} gange/uge</span>
            <button type="button" className="btn btn-soft size-12 px-0" aria-label="Flere" onClick={() => setH({ ...h, frequency: { kind: 'weekly', times: Math.min(7, (h.frequency as { times: number }).times + 1) } })}>
              +
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        {!h.builtin && (
          <button type="button" className="btn btn-ghost px-3 text-clay" onClick={remove} aria-label="Slet vane">
            <TrashIcon />
          </button>
        )}
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost" onClick={cancel}>
          Annullér
        </button>
        <button type="button" className="btn btn-primary" onClick={save}>
          Gem
        </button>
      </div>
    </li>
  );
}

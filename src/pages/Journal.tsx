import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { PlusIcon, SearchIcon, XIcon } from '../components/icons';
import { TagChips } from '../components/TagChips';
import { PageHeader } from '../components/ui';
import { ValuesSection } from '../components/ValuesReflection';
import { DEFAULT_TAGS } from '../data/focus';
import { promptForDate } from '../data/prompts';
import { formatLong, todayKey } from '../lib/dates';
import { db } from '../lib/db';
import { useSettings } from '../lib/settings';

export function JournalPage() {
  const entries = useLiveQuery(() => db.entries.orderBy('date').reverse().toArray(), []);
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const allTags = useMemo(() => {
    const used = new Set((entries ?? []).flatMap((e) => e.tags));
    return [...new Set([...DEFAULT_TAGS, ...(settings?.customTags ?? []), ...used])];
  }, [entries, settings?.customTags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter(
      (e) =>
        (!q || e.text.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q))) &&
        tags.every((t) => e.tags.includes(t)) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to),
    );
  }, [entries, query, tags, from, to]);

  const filtering = !!(query || tags.length || from || to);
  const prompt = promptForDate(todayKey());

  return (
    <>
      <PageHeader title="Dagbog" subtitle="Plads til det, der fylder" />

      <Link href="/dagbog/ny" className="card mb-4 block active:scale-[0.99]">
        <p className="hint">Dagens skriveprompt</p>
        <p className="mt-1 font-display text-[1.2rem] font-medium leading-snug">{prompt}</p>
        <span className="btn btn-primary mt-4 w-full">
          <PlusIcon /> Skriv i dag
        </span>
      </Link>

      <div className="mb-4">
        <ValuesSection />
      </div>

      <div className="mb-3 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Søg i dagbogen</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" width={20} height={20} />
          <input type="search" className="field pl-12" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søg i dine tekster" />
        </label>
        <button type="button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className={`btn shrink-0 px-4 ${showFilters || tags.length || from || to ? 'btn-primary' : 'btn-soft'}`}>
          Filtre
        </button>
      </div>

      {showFilters && (
        <div className="card mb-4 space-y-4">
          <div>
            <p className="label text-[0.95rem]">Tags</p>
            <TagChips tags={allTags} selected={tags} onToggle={(t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="hint mb-1 block">Fra</span>
              <input type="date" className="field" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              <span className="hint mb-1 block">Til</span>
              <input type="date" className="field" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          {filtering && (
            <button
              type="button"
              className="btn btn-ghost -ml-3"
              onClick={() => {
                setQuery('');
                setTags([]);
                setFrom('');
                setTo('');
              }}
            >
              <XIcon width={18} height={18} /> Nulstil filtre
            </button>
          )}
        </div>
      )}

      {entries && entries.length === 0 && (
        <p className="px-2 py-6 text-center text-muted">Din dagbog er tom endnu. Den første tekst behøver ikke være lang.</p>
      )}
      {entries && entries.length > 0 && filtered.length === 0 && (
        <p className="px-2 py-6 text-center text-muted">Ingen tekster matcher. Prøv en anden søgning.</p>
      )}
      {filtering && filtered.length > 0 && <p className="hint mb-2 px-2">{filtered.length} {filtered.length === 1 ? 'tekst' : 'tekster'}</p>}

      <ul className="space-y-3">
        {filtered.map((e) => (
          <li key={e.id}>
            <Link href={`/dagbog/${e.id}`} className="card block active:scale-[0.99]">
              <p className="text-[0.85rem] text-muted">{formatLong(e.date)}</p>
              {e.prompt && <p className="mt-1 text-[0.9rem] italic text-muted">{e.prompt}</p>}
              <p className="mt-1 line-clamp-3 whitespace-pre-line">{e.text || <span className="text-muted">(tom)</span>}</p>
              {e.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.tags.map((t) => (
                    <span key={t} className="rounded-full bg-sand px-3 py-1 text-[0.8rem]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

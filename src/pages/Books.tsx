import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BookCover, ProgressBar, progressPercent, STATUS_LABEL } from '../components/BookBits';
import { PlusIcon, SparkIcon } from '../components/icons';
import { PageHeader, Segmented } from '../components/ui';
import { addDays, todayKey } from '../lib/dates';
import { db, newBook, uid, type BookStatus } from '../lib/db';
import { recommend } from '../lib/recommend';
import { useSettings } from '../lib/settings';

type Filter = 'all' | Exclude<BookStatus, 'none'>;

export function BooksPage() {
  const settings = useSettings();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const since = addDays(todayKey(), -13);

  // Egne bøger, der blev oprettet men aldrig fik en titel, ryddes væk.
  useEffect(() => {
    void db.books.filter((b) => !b.builtin && !b.title.trim()).delete();
  }, []);

  const data = useLiveQuery(async () => {
    const [books, recentEntries, recentCheckIns] = await Promise.all([
      db.books.toArray(),
      db.entries.where('date').aboveOrEqual(since).toArray(),
      db.checkins.where('date').aboveOrEqual(since).toArray(),
    ]);
    return { books, recentEntries, recentCheckIns };
  }, [since]);

  if (!data || !settings) return null;
  const rec = recommend({ ...data, focusAreas: settings.focusAreas });
  const books = data.books
    .filter((b) => filter === 'all' || b.status === filter)
    .sort((a, b) => order(a.status) - order(b.status) || Number(a.builtin === false) - Number(b.builtin === false));

  const addBook = async () => {
    const id = uid();
    await db.books.add(newBook({ id, title: '', author: '' }));
    navigate(`/boeger/${id}?ny=1`);
  };

  return (
    <>
      <PageHeader title="Bøger" subtitle="Læsning, der er venlig mod dig" />

      {rec && (
        <Link href={`/boeger/${rec.book.id}`} className="card mb-5 block bg-sage-soft active:scale-[0.99]">
          <p className="flex items-center gap-1.5 text-[0.9rem] font-medium text-sage">
            <SparkIcon width={18} height={18} /> Hvad skal jeg læse næste gang?
          </p>
          <div className="mt-3 flex gap-4">
            <BookCover book={rec.book} />
            <div className="min-w-0">
              <p className="font-display text-[1.15rem] font-semibold leading-snug">{rec.book.title}</p>
              <p className="text-[0.9rem] text-muted">{rec.book.author}</p>
              <p className="mt-2 text-[0.95rem] leading-snug">{rec.reason}</p>
            </div>
          </div>
        </Link>
      )}

      <Segmented
        label="Vis bøger"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Alle' },
          { value: 'want', label: 'Vil læse' },
          { value: 'reading', label: 'Læser' },
          { value: 'read', label: 'Læst' },
        ]}
      />

      <ul className="mt-4 space-y-3">
        {books.map((b) => {
          const pct = progressPercent(b);
          return (
            <li key={b.id}>
              <Link href={`/boeger/${b.id}`} className="card flex gap-4 active:scale-[0.99]">
                <BookCover book={b} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold leading-snug">{b.title || 'Uden titel'}</p>
                  <p className="text-[0.88rem] text-muted">{b.author}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.78rem]">
                    {b.status !== 'none' && <span className="rounded-full bg-sage-soft px-2.5 py-0.5 font-medium">{STATUS_LABEL[b.status]}</span>}
                    {b.themes && <span className="text-muted">{b.themes}</span>}
                  </div>
                  {b.status === 'reading' && (
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={pct} />
                      <span className="text-[0.78rem] text-muted">{pct}%</span>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {books.length === 0 && <p className="px-2 py-6 text-center text-muted">Ingen bøger her endnu.</p>}
      </ul>

      <button type="button" onClick={addBook} className="btn btn-soft mt-4 w-full">
        <PlusIcon /> Tilføj egen bog
      </button>
    </>
  );
}

function order(s: BookStatus): number {
  return { reading: 0, want: 1, none: 2, read: 3 }[s];
}

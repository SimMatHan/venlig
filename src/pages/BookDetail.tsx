import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { BookCover, ProgressBar, progressPercent } from '../components/BookBits';
import { FocusPicker } from '../components/FocusPicker';
import { PlusIcon, TrashIcon, XIcon } from '../components/icons';
import { AutoTextarea, PageHeader, SaveStatus, Segmented } from '../components/ui';
import { focusLabel } from '../data/focus';
import { db, type Book, type BookStatus } from '../lib/db';
import { useAutosave } from '../lib/hooks';

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const book = useLiveQuery(async () => (await db.books.get(id)) ?? null, [id]);
  if (book === undefined) return null;
  if (book === null)
    return (
      <>
        <PageHeader title="Bogen findes ikke" back="/boeger" />
      </>
    );
  return <BookEditor key={book.id} initial={book} />;
}

function BookEditor({ initial }: { initial: Book }) {
  const [, navigate] = useLocation();
  const isNew = new URLSearchParams(useSearch()).has('ny');
  const [b, setB] = useState(initial);
  const [quote, setQuote] = useState('');
  const deleted = useRef(false);
  const status = useAutosave(b, async (v) => {
    if (!deleted.current) await db.books.put({ ...v, updatedAt: Date.now() });
  });
  const set = (patch: Partial<Book>) => setB((p) => ({ ...p, ...patch }));

  const setStatus = (status: BookStatus) => {
    const patch: Partial<Book> = { status };
    if (status === 'read' && b.progressMode === 'pages' && b.totalPages) patch.currentPage = b.totalPages;
    if (status === 'read' && b.progressMode === 'percent') patch.percent = 100;
    set(patch);
  };

  const addQuote = () => {
    const q = quote.trim();
    if (!q) return;
    set({ quotes: [...b.quotes, q] });
    setQuote('');
  };

  const remove = async () => {
    if (!confirm(`Slet "${b.title || 'bogen'}" med noter og citater?`)) return;
    deleted.current = true;
    await db.books.delete(b.id);
    navigate('/boeger', { replace: true });
  };

  const pct = progressPercent(b);

  return (
    <>
      <PageHeader
        title={b.builtin ? b.title : isNew && !b.title ? 'Ny bog' : b.title || 'Bog'}
        subtitle={b.author}
        back="/boeger"
        action={
          !b.builtin ? (
            <button type="button" onClick={remove} className="-mr-2 flex size-12 items-center justify-center rounded-full text-muted" aria-label="Slet bog">
              <TrashIcon />
            </button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {b.builtin ? (
          <div className="card flex gap-4">
            <BookCover book={b} size="lg" />
            <div className="min-w-0">
              <p className="leading-relaxed">{b.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.focus.map((f) => (
                  <span key={f} className="rounded-full bg-sage-soft px-3 py-1 text-[0.8rem]">
                    {focusLabel(f)}
                  </span>
                ))}
                <span className="rounded-full bg-sand px-3 py-1 text-[0.8rem]">{b.difficulty === 'let' ? 'Let' : 'Mellem'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card space-y-4">
            <label className="block">
              <span className="label">Titel</span>
              <input className="field" value={b.title} autoFocus={isNew} onChange={(e) => set({ title: e.target.value })} maxLength={120} />
            </label>
            <label className="block">
              <span className="label">Forfatter</span>
              <input className="field" value={b.author} onChange={(e) => set({ author: e.target.value })} maxLength={120} />
            </label>
            <label className="block">
              <span className="label">Kort beskrivelse</span>
              <AutoTextarea value={b.description} onChange={(e) => set({ description: e.target.value })} placeholder="Hvad handler den om? (valgfrit)" />
            </label>
            <div>
              <p className="label">Fokusområder</p>
              <FocusPicker value={b.focus} onChange={(focus) => set({ focus })} max={5} />
            </div>
            <div>
              <p className="label">Sværhedsgrad</p>
              <Segmented label="Sværhedsgrad" value={b.difficulty} onChange={(difficulty) => set({ difficulty })} options={[{ value: 'let', label: 'Let' }, { value: 'mellem', label: 'Mellem' }]} />
            </div>
          </div>
        )}

        <div className="card space-y-4">
          <div>
            <p className="label">Status</p>
            <Segmented
              label="Status"
              value={b.status === 'none' ? ('' as BookStatus) : b.status}
              onChange={setStatus}
              options={[
                { value: 'want', label: 'Vil læse' },
                { value: 'reading', label: 'Læser nu' },
                { value: 'read', label: 'Læst' },
              ]}
            />
          </div>
          {b.status !== 'none' && b.status !== 'want' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Fremskridt</p>
                <span className="text-[0.9rem] text-muted">{pct}%</span>
              </div>
              <ProgressBar value={pct} />
              <div className="mt-3">
                <Segmented
                  label="Mål fremskridt i"
                  value={b.progressMode}
                  onChange={(progressMode) => set({ progressMode, percent: progressMode === 'percent' ? pct : b.percent })}
                  options={[{ value: 'pages', label: 'Sider' }, { value: 'percent', label: 'Procent' }]}
                />
              </div>
              {b.progressMode === 'pages' ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="field"
                    aria-label="Side"
                    value={b.currentPage || ''}
                    placeholder="Side"
                    onChange={(e) => set({ currentPage: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="text-muted">af</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="field"
                    aria-label="Sider i alt"
                    value={b.totalPages ?? ''}
                    placeholder="I alt"
                    onChange={(e) => set({ totalPages: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
                  />
                </div>
              ) : (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={b.percent}
                  aria-label="Procent læst"
                  onChange={(e) => set({ percent: Number(e.target.value) })}
                  className="mt-4 h-11 w-full accent-[var(--sage)]"
                />
              )}
            </div>
          )}
        </div>

        <div className="card">
          <label className="label" htmlFor="notes">
            Noter
          </label>
          <AutoTextarea id="notes" minRows={3} value={b.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Tanker, øvelser du vil huske, hvad bogen satte i gang …" />
        </div>

        <div className="card">
          <p className="label">Yndlingscitater</p>
          {b.quotes.length > 0 && (
            <ul className="mb-3 space-y-2">
              {b.quotes.map((q, i) => (
                <li key={i} className="flex items-start gap-2 rounded-2xl bg-bg p-3">
                  <p className="flex-1 font-display italic leading-relaxed">“{q}”</p>
                  <button type="button" className="flex size-10 shrink-0 items-center justify-center text-muted" aria-label="Fjern citat" onClick={() => set({ quotes: b.quotes.filter((_, j) => j !== i) })}>
                    <XIcon width={18} height={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <AutoTextarea minRows={1} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Skriv et citat" aria-label="Nyt citat" />
            <button type="button" className="btn btn-soft shrink-0 self-start px-4" onClick={addQuote} aria-label="Tilføj citat">
              <PlusIcon />
            </button>
          </div>
        </div>

        <div className="flex justify-end px-2">
          <SaveStatus status={status} />
        </div>
      </div>
    </>
  );
}

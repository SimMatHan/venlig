import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { PlusIcon, SparkIcon, TrashIcon } from '../components/icons';
import { TagChips } from '../components/TagChips';
import { AutoTextarea, PageHeader, SaveStatus } from '../components/ui';
import { DEFAULT_TAGS } from '../data/focus';
import { JOURNAL_PROMPTS, promptForDate } from '../data/prompts';
import { todayKey } from '../lib/dates';
import { db, uid, type JournalEntry } from '../lib/db';
import { useAutosave } from '../lib/hooks';
import { updateSettings, useSettings } from '../lib/settings';

export function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'ny';
  const entry = useLiveQuery(async () => (isNew ? null : ((await db.entries.get(id)) ?? null)), [id]);

  // Et nyt indlæg får et rigtigt id, så snart der skrives noget.
  const fresh = useMemo<JournalEntry | null>(() => {
    if (!isNew) return null;
    const now = Date.now();
    return { id: uid(), date: todayKey(), text: '', tags: [], createdAt: now, updatedAt: now };
  }, [isNew]);

  // Adressen bliver på /dagbog/ny mens der skrives, så editoren (og tastaturet) ikke genstartes.
  if (isNew && fresh) return <Editor initial={fresh} isNew />;
  if (entry === undefined) return null;
  if (entry === null)
    return (
      <>
        <PageHeader title="Ikke fundet" back="/dagbog" />
        <p className="text-muted">Teksten findes ikke længere.</p>
      </>
    );
  return <Editor key={entry.id} initial={entry} />;
}

function Editor({ initial, isNew = false }: { initial: JournalEntry; isNew?: boolean }) {
  const [, navigate] = useLocation();
  const settings = useSettings();
  const [e, setE] = useState(initial);
  const [promptOffset, setPromptOffset] = useState(0);
  const [newTag, setNewTag] = useState('');
  const saved = useRef(!isNew);
  const [persisted, setPersisted] = useState(!isNew);

  const deleted = useRef(false);
  const status = useAutosave(e, async (v) => {
    if (deleted.current || (!v.text.trim() && !saved.current)) return;
    await db.entries.put({ ...v, updatedAt: Date.now() });
    if (!saved.current) {
      saved.current = true;
      setPersisted(true);
    }
  });

  const suggestion = promptForDate(e.date, promptOffset);
  const allTags = [...new Set([...DEFAULT_TAGS, ...(settings?.customTags ?? []), ...e.tags])];

  const toggleTag = (t: string) => setE((p) => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter((x) => x !== t) : [...p.tags, t] }));
  const addTag = async () => {
    const t = newTag.trim().toLowerCase();
    if (!t) return;
    if (!allTags.includes(t)) await updateSettings({ customTags: [...(settings?.customTags ?? []), t] });
    if (!e.tags.includes(t)) toggleTag(t);
    setNewTag('');
  };

  const remove = async () => {
    if (!confirm('Slet denne tekst? Det kan ikke fortrydes.')) return;
    deleted.current = true;
    await db.entries.delete(e.id);
    navigate('/dagbog', { replace: true });
  };

  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (isNew) textRef.current?.focus();
  }, [isNew]);

  return (
    <>
      <PageHeader
        title={isNew ? 'Ny tekst' : 'Dagbog'}
        back="/dagbog"
        action={
          persisted ? (
            <button type="button" onClick={remove} className="-mr-2 flex size-12 items-center justify-center rounded-full text-muted" aria-label="Slet tekst">
              <TrashIcon />
            </button>
          ) : undefined
        }
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2">
            <span className="sr-only">Dato</span>
            <input type="date" className="field w-auto py-2" value={e.date} max={todayKey()} onChange={(ev) => ev.target.value && setE({ ...e, date: ev.target.value })} />
          </label>
          <SaveStatus status={status} />
        </div>

        {e.prompt ? (
          <div className="flex items-start gap-2 rounded-2xl bg-sage-soft p-4">
            <p className="flex-1 font-display text-[1.1rem] font-medium">{e.prompt}</p>
            <button type="button" className="min-h-11 px-2 text-[0.85rem] text-muted" onClick={() => setE({ ...e, prompt: undefined })}>
              Fjern
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-4">
            <p className="hint flex items-center gap-1.5">
              <SparkIcon width={16} height={16} /> Brug for en idé?
            </p>
            <p className="mt-1 font-display text-[1.1rem] font-medium">{suggestion}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn btn-soft min-h-11 px-4 text-[0.9rem]" onClick={() => setE({ ...e, prompt: suggestion })}>
                Brug den
              </button>
              <button type="button" className="btn btn-ghost min-h-11 px-3 text-[0.9rem]" onClick={() => setPromptOffset((o) => (o + 1) % JOURNAL_PROMPTS.length)}>
                En anden
              </button>
            </div>
          </div>
        )}

        <AutoTextarea
          ref={textRef}
          minRows={8}
          value={e.text}
          onChange={(ev) => setE({ ...e, text: ev.target.value })}
          placeholder="Skriv frit. Ingen skal læse det andet end dig."
          aria-label="Dagbogstekst"
          className="bg-card text-[1.05rem]"
        />

        <div className="card">
          <p className="label">Tags</p>
          <TagChips tags={allTags} selected={e.tags} onToggle={toggleTag} />
          <form
            className="mt-3 flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              void addTag();
            }}
          >
            <input className="field" value={newTag} onChange={(ev) => setNewTag(ev.target.value)} placeholder="Nyt tag" maxLength={30} aria-label="Nyt tag" />
            <button type="submit" className="btn btn-soft shrink-0 px-4" aria-label="Tilføj tag">
              <PlusIcon />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

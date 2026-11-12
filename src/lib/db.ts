import Dexie, { type EntityTable } from 'dexie';
import { BOOK_CATALOG, type Difficulty } from '../data/books';
import type { FocusArea } from '../data/focus';
import { DEFAULT_HABITS } from '../data/habits';
import type { DateKey } from './dates';

export type HabitFrequency = { kind: 'daily' } | { kind: 'weekly'; times: number };

export interface Habit {
  id: string;
  name: string;
  hint?: string;
  icon: string;
  frequency: HabitFrequency;
  enabled: boolean;
  builtin: boolean;
  tracksPages?: boolean;
  order: number;
}

export interface HabitLog {
  done: boolean;
  pages?: number;
}

export interface CheckIn {
  date: DateKey;
  mood?: number;
  energy?: number;
  goodThings: string[];
  whyGood: string;
  didWell: string;
  habits: Record<string, HabitLog>;
  updatedAt: number;
}

export interface JournalEntry {
  id: string;
  date: DateKey;
  text: string;
  prompt?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type BookStatus = 'none' | 'want' | 'reading' | 'read';

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  themes: string;
  focus: FocusArea[];
  difficulty: Difficulty;
  builtin: boolean;
  status: BookStatus;
  progressMode: 'pages' | 'percent';
  totalPages?: number;
  currentPage: number;
  percent: number;
  notes: string;
  quotes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id: 'main';
  onboarded: boolean;
  focusAreas: FocusArea[];
  values: string[];
  theme: 'system' | 'light' | 'dark';
  reminder: { enabled: boolean; time: string };
  customTags: string[];
}

export interface ValueReflection {
  /** Søndagen i ugen. */
  week: DateKey;
  answer: 'ja' | 'delvist' | 'lidt';
  note: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  onboarded: false,
  focusAreas: [],
  values: [],
  theme: 'system',
  reminder: { enabled: false, time: '20:00' },
  customTags: [],
};

export class VenligDB extends Dexie {
  checkins!: EntityTable<CheckIn, 'date'>;
  habits!: EntityTable<Habit, 'id'>;
  entries!: EntityTable<JournalEntry, 'id'>;
  books!: EntityTable<Book, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  valueReflections!: EntityTable<ValueReflection, 'week'>;

  constructor(name = 'venlig') {
    super(name);
    this.version(1).stores({
      checkins: 'date',
      habits: 'id, order',
      entries: 'id, date, *tags',
      books: 'id, status',
      settings: 'id',
      valueReflections: 'week',
    });
  }
}

export const db = new VenligDB();

export const TABLES = ['checkins', 'habits', 'entries', 'books', 'settings', 'valueReflections'] as const;

export function newBook(fields: Partial<Book> & Pick<Book, 'id' | 'title' | 'author'>): Book {
  const now = Date.now();
  return {
    description: '',
    themes: '',
    focus: [],
    difficulty: 'let',
    builtin: false,
    status: 'want',
    progressMode: 'pages',
    currentPage: 0,
    percent: 0,
    notes: '',
    quotes: [],
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/**
 * Sørger for standardvaner, det indbyggede bibliotek og indstillinger.
 * Kører ved hver opstart: tilføjer det, der mangler, og opdaterer tekster på
 * indbyggede bøger – uden at røre brugerens status, noter og citater.
 */
export async function ensureSeed(database: VenligDB = db): Promise<void> {
  await database.transaction('rw', database.habits, database.books, database.settings, async () => {
    const habitIds = new Set(await database.habits.toCollection().primaryKeys());
    const habitCount = habitIds.size;
    const missingHabits = DEFAULT_HABITS.filter((h) => !habitIds.has(h.id));
    // Kun ved allerførste opstart – slettede standardvaner skal ikke komme igen.
    if (habitCount === 0) {
      await database.habits.bulkAdd(
        missingHabits.map((h, i) => ({ ...h, frequency: { kind: 'daily' }, enabled: true, builtin: true, order: i })),
      );
    }

    const existing = new Map((await database.books.toArray()).map((b) => [b.id, b]));
    for (const c of BOOK_CATALOG) {
      const current = existing.get(c.id);
      const { pages, ...meta } = c;
      if (!current) {
        await database.books.add(newBook({ ...meta, builtin: true, status: 'none', totalPages: pages }));
      } else {
        await database.books.update(c.id, meta);
      }
    }

    if (!(await database.settings.get('main'))) {
      await database.settings.add(DEFAULT_SETTINGS);
    }
  });
}

export function emptyCheckIn(date: DateKey): CheckIn {
  return { date, goodThings: ['', '', ''], whyGood: '', didWell: '', habits: {}, updatedAt: 0 };
}

export function hasContent(c: CheckIn | undefined): boolean {
  if (!c) return false;
  return (
    c.mood != null ||
    c.energy != null ||
    c.goodThings.some((g) => g.trim()) ||
    c.whyGood.trim() !== '' ||
    c.didWell.trim() !== '' ||
    Object.values(c.habits).some((h) => h.done)
  );
}

export function uid(): string {
  return crypto.randomUUID();
}

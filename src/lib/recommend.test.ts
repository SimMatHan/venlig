import { describe, expect, it } from 'vitest';
import { BOOK_CATALOG } from '../data/books';
import { emptyCheckIn, newBook, type Book, type JournalEntry } from './db';
import { recommend } from './recommend';

const books = (): Book[] =>
  BOOK_CATALOG.map(({ pages, ...c }) => newBook({ ...c, builtin: true, status: 'none', totalPages: pages }));

const entry = (tags: string[], date = '2026-11-10'): JournalEntry => ({ id: crypto.randomUUID(), date, text: '', tags, createdAt: 0, updatedAt: 0 });

describe('boganbefaling', () => {
  it('matcher på fokusområder', () => {
    const r = recommend({ books: books(), focusAreas: ['glaede'], recentEntries: [], recentCheckIns: [] })!;
    expect(r.book.id).toBe('little-book-of-lykke');
    expect(r.reason).toContain('mangel på glæde');
  });

  it('vægter tags fra de seneste dages dagbog og forklarer hvorfor', () => {
    const r = recommend({
      books: books(),
      focusAreas: ['glaede'],
      recentEntries: [entry(['selvkritik']), entry(['selvkritik', 'stress']), entry(['selvkritik'])],
      recentCheckIns: [],
    })!;
    expect(r.book.focus).toContain('selvkritik');
    expect(r.reason).toBe('Anbefalet fordi du har skrevet meget om selvkritik for nylig.');
  });

  it('foretrækker lettere bøger ved lavt humør', () => {
    const low = [1, 2, 2].map((mood, i) => ({ ...emptyCheckIn(`2026-11-0${i + 1}`), mood }));
    const r = recommend({ books: books(), focusAreas: ['svaere-tanker', 'selvkritik'], recentEntries: [], recentCheckIns: low })!;
    expect(r.book.difficulty).toBe('let');
    expect(r.reason).toContain('let at gå til');
  });

  it('udelukker læste bøger', () => {
    const list = books().map((b) => (b.id === 'little-book-of-lykke' ? { ...b, status: 'read' as const } : b));
    const r = recommend({ books: list, focusAreas: ['glaede'], recentEntries: [], recentCheckIns: [] })!;
    expect(r.book.id).not.toBe('little-book-of-lykke');
  });

  it('giver altid en anbefaling med begrundelse – også uden data og når alt er læst', () => {
    const none = recommend({ books: books(), focusAreas: [], recentEntries: [], recentCheckIns: [] })!;
    expect(none.reason.length).toBeGreaterThan(10);
    const allRead = recommend({ books: books().map((b) => ({ ...b, status: 'read' as const })), focusAreas: ['stress'], recentEntries: [], recentCheckIns: [] })!;
    expect(allRead.book).toBeDefined();
    expect(allRead.reason).toContain('genlæse');
  });
});

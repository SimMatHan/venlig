import { focusLabel, TAG_FOCUS, type FocusArea } from '../data/focus';
import type { Book, CheckIn, JournalEntry } from './db';

export interface Recommendation {
  book: Book;
  reason: string;
}

interface Input {
  books: Book[];
  focusAreas: FocusArea[];
  /** Dagbogsindlæg fra de seneste 14 dage. */
  recentEntries: JournalEntry[];
  /** Tjek-ins fra de seneste 14 dage. */
  recentCheckIns: CheckIn[];
}

const LOW_MOOD = 2.75;

/**
 * Regelbaseret anbefaling:
 *  - match på brugerens fokusområder
 *  - vægt tags fra de seneste 14 dages dagbog
 *  - ved lavt humør foretrækkes lettere bøger
 * Læste bøger udelukkes. Giver altid et svar, så længe der findes bøger.
 */
export function recommend({ books, focusAreas, recentEntries, recentCheckIns }: Input): Recommendation | null {
  if (books.length === 0) return null;

  // Hvor meget har brugeren skrevet om hvert fokusområde – og med hvilket tag.
  const tagSignal = new Map<FocusArea, { count: number; tag: string; tagCount: number }>();
  const tagCounts = new Map<string, number>();
  for (const entry of recentEntries) {
    for (const raw of entry.tags) {
      const tag = raw.toLowerCase();
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  for (const [tag, n] of tagCounts) {
    const focus = TAG_FOCUS[tag];
    if (!focus) continue;
    const s = tagSignal.get(focus) ?? { count: 0, tag, tagCount: 0 };
    s.count += n;
    if (n > s.tagCount) {
      s.tag = tag;
      s.tagCount = n;
    }
    tagSignal.set(focus, s);
  }

  const moods = recentCheckIns.map((c) => c.mood).filter((m): m is number => m != null);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const lowMood = avgMood != null && avgMood < LOW_MOOD;

  const unread = books.filter((b) => b.status !== 'read' && b.status !== 'reading');
  const reading = books.filter((b) => b.status === 'reading');
  const pool = unread.length ? unread : reading.length ? reading : books;
  const allRead = !unread.length && !reading.length;

  let best: { book: Book; score: number; focusHit?: FocusArea; tagHit?: FocusArea } | null = null;
  for (const book of pool) {
    let score = 0;
    let focusHit: FocusArea | undefined;
    let tagHit: FocusArea | undefined;
    for (const f of book.focus) {
      if (focusAreas.includes(f)) {
        score += 3;
        focusHit ??= f;
      }
      const t = tagSignal.get(f);
      if (t) {
        score += Math.min(t.count, 5) * 1.5;
        if (!tagHit || t.count > (tagSignal.get(tagHit)?.count ?? 0)) tagHit = f;
      }
    }
    if (lowMood) score += book.difficulty === 'let' ? 2 : -1;
    else if (book.difficulty === 'let') score += 0.25;
    if (book.status === 'want') score += 0.5;
    if (!best || score > best.score) best = { book, score, focusHit, tagHit };
  }

  const { book, focusHit, tagHit } = best!;
  const parts: string[] = [];
  if (tagHit && (tagSignal.get(tagHit)?.count ?? 0) >= 2) {
    parts.push(`du har skrevet meget om ${tagSignal.get(tagHit)!.tag} for nylig`);
  } else if (tagHit) {
    parts.push(`du har skrevet om ${tagSignal.get(tagHit)!.tag} for nylig`);
  } else if (focusHit) {
    parts.push(`du har valgt ${focusLabel(focusHit).toLowerCase()} som fokusområde`);
  }
  if (lowMood && book.difficulty === 'let') parts.push('den er let at gå til, når overskuddet er lavt');

  let reason: string;
  if (allRead) {
    reason = 'Du har læst alle bøgerne på listen – måske er det tid til at genlæse en god ven.';
  } else if (parts.length) {
    reason = `Anbefalet fordi ${parts.join(', og ')}.`;
  } else {
    reason = 'En god og blid start, hvis du vil i gang med at læse om selvmedfølelse.';
  }
  return { book, reason };
}

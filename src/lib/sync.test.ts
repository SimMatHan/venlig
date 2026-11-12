import { describe, expect, it } from 'vitest';
import { ensureSeed, VenligDB } from './db';
import { planSync } from './sync';

describe('sync-plan', () => {
  it('sender alt første gang, derefter kun ændringer og sletninger', async () => {
    const db = new VenligDB(`sync-${crypto.randomUUID()}`);
    await ensureSeed(db);
    await db.entries.put({ id: 'e1', date: '2026-11-12', text: 'Hej', tags: [], createdAt: 1, updatedAt: 1 });

    const first = await planSync({}, db);
    expect(first.replace).toBe(true);
    expect(first.upserts.some((u) => u.collection === 'entries' && u.id === 'e1')).toBe(true);
    expect(first.deletes).toEqual([]);

    const unchanged = await planSync(first.next, db);
    expect(unchanged.replace).toBe(false);
    expect(unchanged.upserts).toEqual([]);

    await db.entries.update('e1', { text: 'Hej igen' });
    await db.checkins.put({ date: '2026-11-12', mood: 4, goodThings: ['', '', ''], whyGood: '', didWell: '', habits: {}, updatedAt: 1 });
    await db.books.delete('feeling-good');
    const changed = await planSync(first.next, db);
    expect(changed.upserts.map((u) => `${u.collection}/${u.id}`).sort()).toEqual(['checkins/2026-11-12', 'entries/e1']);
    expect(changed.deletes).toEqual([{ collection: 'books', id: 'feeling-good' }]);
  });
});

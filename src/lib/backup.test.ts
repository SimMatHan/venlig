import { describe, expect, it } from 'vitest';
import { deleteAll, exportAll, importAll, parseBackup } from './backup';
import { ensureSeed, VenligDB } from './db';

describe('backup', () => {
  it('eksport → import genskaber alle data', async () => {
    const db = new VenligDB(`test-${crypto.randomUUID()}`);
    await ensureSeed(db);
    await db.checkins.put({
      date: '2026-11-12',
      mood: 4,
      energy: 3,
      goodThings: ['Kaffe i solen', 'En god snak', ''],
      whyGood: 'Jeg tog mig tid',
      didWell: 'Sagde nej til et ekstra møde',
      habits: { laeste: { done: true, pages: 12 }, gaatur: { done: true } },
      updatedAt: 1,
    });
    await db.entries.put({ id: 'e1', date: '2026-11-12', text: 'Æ, ø og å virker', prompt: 'Hvad har fyldt i dag?', tags: ['glæde'], createdAt: 1, updatedAt: 2 });
    await db.books.update('neff-self-compassion', { status: 'reading', currentPage: 40, notes: 'God', quotes: ['Vær venlig'] });
    await db.habits.add({ id: 'egen', name: 'Vand', icon: '💧', frequency: { kind: 'weekly', times: 3 }, enabled: true, builtin: false, order: 9 });
    await db.settings.update('main', { onboarded: true, focusAreas: ['stress'], values: ['Ro', 'Mod', 'Nærvær'], theme: 'dark' });
    await db.valueReflections.put({ week: '2026-11-15', answer: 'delvist', note: 'Okay uge', createdAt: 3 });

    const before = await exportAll(db);
    const json = JSON.stringify(before);

    await deleteAll(db);
    expect(await db.entries.count()).toBe(0);
    expect((await db.settings.get('main'))?.onboarded).toBe(false);

    await importAll(parseBackup(json), db);
    const after = await exportAll(db);
    expect(after.data).toEqual(before.data);
  });

  it('afviser filer, der ikke er en Venlig-backup', () => {
    expect(() => parseBackup('ikke json')).toThrow();
    expect(() => parseBackup('{"foo":1}')).toThrow(/Venlig/);
  });
});

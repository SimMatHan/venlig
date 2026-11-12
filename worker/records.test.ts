import { describe, expect, it } from 'vitest';
import { parseSyncPayload } from './records';

describe('sync-payload', () => {
  it('accepterer gyldige ændringer', () => {
    const p = parseSyncPayload({ replace: false, upserts: [{ collection: 'entries', id: 'e1', data: { text: 'x' } }], deletes: [], timezone: 'Europe/Copenhagen' });
    expect(p?.upserts).toHaveLength(1);
  });

  it('afviser ukendte samlinger og forkert form', () => {
    expect(parseSyncPayload({ replace: false, upserts: [{ collection: 'users', id: '1', data: {} }], deletes: [] })).toBeNull();
    expect(parseSyncPayload({ upserts: [], deletes: [] })).toBeNull();
    expect(parseSyncPayload(null)).toBeNull();
  });
});

import { migrate } from '@/platform/migrations';
import { DomainError } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';

import type { Fix } from '../../domain/fix';
import { RecordingSession } from '../../domain/recording-session';
import { SqliteRecordingSessionRepository } from '../sqlite-recording-session-repository';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const fix = (i: number): Fix => ({
  lat: 52.2 + (i * 5) / 111_195,
  lon: 21,
  t: T0 + i * 1000,
  accuracy: 5,
  alt: null,
  speed: null,
});

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  const repo = new SqliteRecordingSessionRepository(db);
  const s = RecordingSession.start('s1', 'run', T0);
  await repo.save(s, s.ingest([0, 1, 2].map(fix)));
  const status = async () =>
    (await db.first<{ status: string }>("SELECT status FROM rec_sessions WHERE id = 's1'"))?.status;
  const outbox = async () =>
    (await db.all<{ type: string }>('SELECT type FROM sys_outbox ORDER BY id')).map((r) => r.type);
  const points = async () => (await repo.pointsOf('s1')).length;
  return { repo, status, outbox, points };
}

describe('SqliteRecordingSessionRepository: an ended session is never revived', () => {
  it.each(['finish', 'discard'] as const)('refuses a stale save over a session after %s', async (end) => {
    const t = await setup();
    const stale = (await t.repo.getActive())!; // e.g. loaded by a background ingest
    const winner = (await t.repo.getActive())!;
    winner[end](T0 + 60_000);
    await t.repo.save(winner, []);

    const points = stale.ingest([3, 4].map(fix));
    const err = await t.repo.save(stale, points).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe('session.already-ended');

    // Rolled back: still ended, no extra points, no extra events.
    expect(await t.status()).toBe(end === 'finish' ? 'finished' : 'discarded');
    expect(await t.points()).toBe(3);
    expect(await t.outbox()).toEqual(['SessionStarted', end === 'finish' ? 'SessionFinished' : 'SessionDiscarded']);
    expect(await t.repo.getActive()).toBeNull();
  });

  it('still saves active → active and active → ended', async () => {
    const t = await setup();
    const s = (await t.repo.getActive())!;
    s.pause(T0 + 10_000);
    await t.repo.save(s, []);
    expect(await t.status()).toBe('paused');
    s.finish(T0 + 20_000);
    await t.repo.save(s, []);
    expect(await t.status()).toBe('finished');
  });
});

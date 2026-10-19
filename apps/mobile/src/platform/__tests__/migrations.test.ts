import { openNodeDatabase } from '@/test-support/node-database';

import { migrate } from '../migrations';

const version = async (db: ReturnType<typeof openNodeDatabase>) =>
  (await db.first<{ v: number }>('SELECT MAX(version) AS v FROM sys_schema_version'))!.v;

describe('migration v5 (outbox retries and dead letters)', () => {
  it('upgrades an existing v4 database without losing rows, and is idempotent', async () => {
    const db = openNodeDatabase();
    await migrate(db, 4);
    expect(await version(db)).toBe(4);

    // Data as a v0.2.0 install has it: delivered and pending events, a session, an activity.
    await db.run(
      'INSERT INTO sys_outbox (type, payload, created_at, processed_at) VALUES (\'SessionFinished\', \'{"type":"SessionFinished"}\', 1, 2)'
    );
    await db.run(
      'INSERT INTO sys_outbox (type, payload, created_at) VALUES (\'ActivityRecorded\', \'{"type":"ActivityRecorded"}\', 3)'
    );
    await db.run(
      "INSERT INTO rec_sessions (id, type, status, state, started_at, updated_at) VALUES ('s1', 'run', 'finished', '{}', 1, 2)"
    );
    await db.run(
      `INSERT INTO log_activities (id, type, name, started_at, ended_at, distance_m, moving_s, elapsed_s, splits, created_at)
       VALUES ('s1', 'run', 'Morning run', 1, 2, 5000, 1500, 1600, '[]', 3)`
    );

    await migrate(db);
    expect(await version(db)).toBe(7);

    const outbox = await db.all<Record<string, unknown>>('SELECT * FROM sys_outbox ORDER BY id');
    expect(outbox).toEqual([
      {
        id: 1,
        type: 'SessionFinished',
        payload: '{"type":"SessionFinished"}',
        created_at: 1,
        processed_at: 2,
        attempts: 0,
        last_error: null,
        next_attempt_at: null,
        dead_lettered_at: null,
      },
      {
        id: 2,
        type: 'ActivityRecorded',
        payload: '{"type":"ActivityRecorded"}',
        created_at: 3,
        processed_at: null,
        attempts: 0,
        last_error: null,
        next_attempt_at: null,
        dead_lettered_at: null,
      },
    ]);
    expect(await db.first('SELECT id, status FROM rec_sessions')).toEqual({ id: 's1', status: 'finished' });
    expect(await db.first('SELECT id, distance_m, estimated_m FROM log_activities')).toEqual({
      id: 's1',
      distance_m: 5000,
      estimated_m: 0,
    });

    // Second launch: nothing re-applied, no error, nothing lost.
    await migrate(db);
    expect(await version(db)).toBe(7);
    expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sys_schema_version'))!.n).toBe(7);
    expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sys_outbox'))!.n).toBe(2);
  });
});

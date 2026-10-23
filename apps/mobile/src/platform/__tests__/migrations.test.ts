import { openNodeDatabase } from '@/test-support/node-database';

import { LATEST_SCHEMA_VERSION, migrate } from '../migrations';

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
    expect(await version(db)).toBe(LATEST_SCHEMA_VERSION);

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
    expect(await version(db)).toBe(LATEST_SCHEMA_VERSION);
    expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sys_schema_version'))!.n).toBe(
      LATEST_SCHEMA_VERSION
    );
    expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sys_outbox'))!.n).toBe(2);
  });
});

describe('migration v8 (cloud backup)', () => {
  it('adds empty backup tables to a v7 database, keeping its data', async () => {
    const db = openNodeDatabase();
    await migrate(db, 7);
    await db.run(
      `INSERT INTO log_activities (id, type, name, started_at, ended_at, distance_m, moving_s, elapsed_s, splits, created_at)
       VALUES ('s1', 'run', 'Morning run', 1, 2, 5000, 1500, 1600, '[]', 3)`
    );
    await db.run("INSERT INTO ter_home_city (id, city_id, chosen_at) VALUES (1, 'pl-krakow', 5)");

    await migrate(db);
    expect(await version(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(await db.first('SELECT COUNT(*) AS n FROM cb_state')).toEqual({ n: 0 });
    expect(await db.first('SELECT COUNT(*) AS n FROM cb_activities')).toEqual({ n: 0 });
    expect(await db.first('SELECT id FROM log_activities')).toEqual({ id: 's1' });
    expect(await db.first('SELECT city_id FROM ter_home_city')).toEqual({ city_id: 'pl-krakow' });
  });

  it('allows one state row and only known statuses and operations', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await db.run('INSERT INTO cb_state (id) VALUES (1)');
    await expect(db.run('INSERT INTO cb_state (id) VALUES (2)')).rejects.toThrow();
    await db.run("INSERT INTO cb_activities (activity_id, started_at, status, op) VALUES ('a', 1, 'none', 'upload')");
    await expect(
      db.run("INSERT INTO cb_activities (activity_id, started_at, status) VALUES ('b', 1, 'synced')")
    ).rejects.toThrow();
    await expect(
      db.run("INSERT INTO cb_activities (activity_id, started_at, status, op) VALUES ('c', 1, 'none', 'patch')")
    ).rejects.toThrow();
  });
});

describe('migration v9 (time zone and rename time of an Activity)', () => {
  it('adds empty columns to a v8 database, keeping its activities', async () => {
    const db = openNodeDatabase();
    await migrate(db, 8);
    await db.run(
      `INSERT INTO log_activities (id, type, name, started_at, ended_at, distance_m, moving_s, elapsed_s, splits, created_at)
       VALUES ('s1', 'run', 'Morning run', 1, 2, 5000, 1500, 1600, '[]', 3)`
    );
    await migrate(db, 9);
    expect(await version(db)).toBe(9);
    expect(await db.first('SELECT id, name, time_zone, renamed_at FROM log_activities')).toEqual({
      id: 's1',
      name: 'Morning run',
      time_zone: null,
      renamed_at: null,
    });
  });
});

describe('migration v10 (cloud backup accounts, renames, gap checks)', () => {
  it('keeps backup rows of a v9 database and adds the new columns empty', async () => {
    const db = openNodeDatabase();
    await migrate(db, 9);
    await db.run('INSERT INTO cb_state (id, enabled) VALUES (1, 1)');
    await db.run("INSERT INTO cb_activities (activity_id, started_at, status) VALUES ('a', 1, 'backed-up')");
    await migrate(db, 10);
    expect(await db.first('SELECT enabled, account_key, home_city_sent_at FROM cb_state')).toEqual({
      enabled: 1,
      account_key: null,
      home_city_sent_at: null,
    });
    expect(await db.first('SELECT status, rename_pending, gaps_sent_at FROM cb_activities')).toEqual({
      status: 'backed-up',
      rename_pending: 0,
      gaps_sent_at: null,
    });
  });
});

describe('migration v11 (restore from the cloud backup)', () => {
  it('adds empty restore tables with one state row and known statuses only', async () => {
    const db = openNodeDatabase();
    await migrate(db, 10);
    await migrate(db, 11);
    expect(await db.first('SELECT COUNT(*) AS n FROM cb_restore_items')).toEqual({ n: 0 });
    await db.run("INSERT INTO cb_restore (id, status) VALUES (1, 'running')");
    await expect(db.run("INSERT INTO cb_restore (id, status) VALUES (2, 'running')")).rejects.toThrow();
    await expect(db.run("UPDATE cb_restore SET status = 'paused'")).rejects.toThrow();
  });
});

describe('migration v12 (declined restore offers)', () => {
  it('adds an empty table of activity ids, one row per id', async () => {
    const db = openNodeDatabase();
    await migrate(db, 11);
    await migrate(db, 12);
    expect(await db.first('SELECT COUNT(*) AS n FROM cb_restore_declined')).toEqual({ n: 0 });
    await db.run("INSERT INTO cb_restore_declined (activity_id) VALUES ('rec-1')");
    await expect(db.run("INSERT INTO cb_restore_declined (activity_id) VALUES ('rec-1')")).rejects.toThrow();
  });
});

describe('migration v13 (claim cells by cell)', () => {
  it('lets a release find the other claims of its cells through an index, not a table scan', async () => {
    const db = openNodeDatabase();
    await migrate(db, 12);
    await migrate(db, 13);
    // The join a release runs to recompute first_at / last_at (sqlite-territory-repository.ts).
    const plan = await db.all<{ detail: string }>(
      `EXPLAIN QUERY PLAN
       SELECT cc.cell FROM ter_claim_cells r
       JOIN ter_claim_cells cc ON cc.cell = r.cell AND cc.activity_id != r.activity_id
       WHERE r.activity_id = 'a1'`
    );
    const details = plan.map((p) => p.detail).join('\n');
    expect(details).toMatch(/idx_ter_claim_cells_cell/);
    expect(details).not.toMatch(/^SCAN cc\b/m);
  });
});

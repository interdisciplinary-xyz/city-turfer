/**
 * Daily goal through the real wiring and SQL: migration 15, upsert per day, outbox events, moving
 * time from Activity Log (Apple Health imports included, deleted activities dropped), offer flag.
 */
import { FakeHealthStore, straightRoute } from '@/contexts/health-sync/test-support/fake-health-store';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

import { goalStreak } from '../../index';
import { SqliteGoalRepository } from '../sqlite-goal-repository';

// Local wall-clock times (any machine time zone): Wednesday 11 November 2026.
const local = (day: number, h: number, min = 0) => new Date(2026, 10, day, h, min).getTime();
const DAY = 86_400_000;

function setup() {
  const db = openNodeDatabase();
  const health = new FakeHealthStore();
  let now = local(11, 18);
  let n = 0;
  const adapters = {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    ids: { next: () => `session-${++n}` },
    clock: { now: () => now },
    health,
  };
  return {
    db,
    health,
    adapters,
    setNow: (ms: number) => void (now = ms),
    async container() {
      await migrate(db);
      return wire('test', db, adapters);
    },
  };
}

const walk = (start: number, minutes: number, lat = 52.25) => straightRoute({ lat, lon: 21.01, t: start }, minutes);

const outboxTypes = async (db: ReturnType<typeof openNodeDatabase>) =>
  (await db.all<{ type: string }>('SELECT type FROM sys_outbox ORDER BY id')).map((r) => r.type);

describe('Goals on SQLite', () => {
  it('migration 15 creates the goal tables, empty', async () => {
    const t = setup();
    await t.container();
    expect(await t.db.all('SELECT * FROM goal_daily_targets')).toEqual([]);
    expect(await t.db.all('SELECT * FROM goal_state')).toEqual([]);
    await expect(
      t.db.run("INSERT INTO goal_daily_targets (effective_from, minutes, set_at) VALUES ('2026-11-11', -5, 0)")
    ).rejects.toThrow(/CHECK/);
  });

  it('a new Turfer has no goal and sees the offer; hiding it persists', async () => {
    const t = setup();
    const c = await t.container();
    const v = await c.goals.view.execute();
    expect(v).toMatchObject({ goalMinutes: null, offerHidden: false, today: { day: '2026-11-11', movingS: 0 } });
    expect(v.week).toHaveLength(7);

    await c.goals.hideOffer.execute();
    await c.goals.hideOffer.execute(); // no second event
    expect(await outboxTypes(t.db)).toEqual(['DailyGoalOfferHidden']);
    // A fresh container on the same database (next launch) still has it hidden.
    const again = wire('test', t.db, t.adapters);
    expect((await again.goals.view.execute()).offerHidden).toBe(true);
  });

  it('saves a change per day (upsert) with DailyGoalSet in the outbox; earlier days keep theirs', async () => {
    const t = setup();
    const c = await t.container();
    t.setNow(local(9, 9));
    await c.goals.set.execute(30);
    t.setNow(local(11, 9));
    await c.goals.set.execute(40);
    await c.goals.set.execute(45); // same day: replaces 40
    expect(await t.db.all('SELECT effective_from, minutes FROM goal_daily_targets ORDER BY effective_from')).toEqual([
      { effective_from: '2026-11-09', minutes: 30 },
      { effective_from: '2026-11-11', minutes: 45 },
    ]);
    const events = await t.db.all<{ payload: string }>("SELECT payload FROM sys_outbox WHERE type = 'DailyGoalSet'");
    expect(events.map((e) => JSON.parse(e.payload))).toEqual([
      { type: 'DailyGoalSet', v: 1, at: local(9, 9), effectiveFrom: '2026-11-09', minutes: 30 },
      { type: 'DailyGoalSet', v: 1, at: local(11, 9), effectiveFrom: '2026-11-11', minutes: 40 },
      { type: 'DailyGoalSet', v: 1, at: local(11, 9), effectiveFrom: '2026-11-11', minutes: 45 },
    ]);
    const v = await c.goals.view.execute();
    expect(v.goalMinutes).toBe(45);
    expect(v.offerHidden).toBe(true); // a goal was set: no offer any more
    expect(v.week.map((d) => d.goalMinutes)).toEqual([null, null, null, null, 30, 30, 45]);

    await c.goals.set.execute(null);
    expect((await c.goals.view.execute()).goalMinutes).toBeNull();
    expect((await c.goals.view.execute()).week.at(-2)!.goalMinutes).toBe(30);
    expect(await t.db.first('SELECT minutes FROM goal_daily_targets WHERE effective_from = ?', ['2026-11-11'])).toEqual(
      { minutes: 0 }
    );
  });

  it('rejects a goal outside the range and stores nothing', async () => {
    const t = setup();
    const c = await t.container();
    await expect(c.goals.set.execute(185)).rejects.toThrow('goal.minutes-invalid');
    await expect(c.goals.set.execute(12)).rejects.toThrow('goal.minutes-invalid');
    expect(await t.db.all('SELECT * FROM goal_daily_targets')).toEqual([]);
    expect(await outboxTypes(t.db)).toEqual([]);
  });

  it('counts Apple Health imports, on the day they started; a deleted activity drops out', async () => {
    const t = setup();
    const c = await t.container();
    t.setNow(local(1, 9));
    await c.goals.set.execute(30);
    await c.healthSync.connect.execute(); // before the workouts: older ones are not imported
    t.setNow(local(11, 18));
    t.health.add({ uuid: 'today' }, walk(local(11, 7), 25));
    t.health.add({ uuid: 'late' }, walk(local(10, 23, 40), 40, 52.26)); // 23:40–00:20
    t.health.add({ uuid: 'old' }, walk(local(11, 7) - 8 * DAY, 30, 52.27)); // before the week
    expect(await c.syncHealth()).toMatchObject({ imported: 3 });
    await c.dispatcher.dispatchPending();

    const listed = Object.fromEntries((await c.activityLog.list.execute(10)).map((a) => [a.id, a.movingS]));
    const v = await c.goals.view.execute();
    expect(v.today.movingS).toBe(listed['hk-today']);
    expect(v.week.at(-2)!.movingS).toBe(listed['hk-late']);
    expect(v.week.reduce((s, d) => s + d.movingS, 0)).toBe(listed['hk-today'] + listed['hk-late']);
    expect(listed['hk-late']).toBeGreaterThanOrEqual(1800); // 40 min walk: met, though it ended on the 11th
    expect(v.week.at(-2)).toMatchObject({ day: '2026-11-10', goalMinutes: 30, met: true });
    expect(v.today.met).toBe(listed['hk-today'] >= 1800);

    await c.activityLog.remove.execute('hk-today');
    expect((await c.goals.view.execute()).today.movingS).toBe(0);
  });

  it('reads back to the first goal day for the streak, past the 7 days shown', async () => {
    const t = setup();
    const c = await t.container();
    t.setNow(local(1, 9));
    await c.goals.set.execute(30);
    await c.healthSync.connect.execute(); // before the workouts: older ones are not imported
    t.setNow(local(11, 18));
    for (let day = 2; day <= 10; day++) {
      t.health.add({ uuid: `d${day}` }, walk(local(day, 8), 35, 52.25 + day / 1000));
    }
    await c.syncHealth();
    await c.dispatcher.dispatchPending();

    const v = await c.goals.view.execute();
    expect(v.today.met).toBe(false);
    expect(v.metBeforeWeek).toBe(3); // the 2nd, 3rd and 4th; the week shown starts on the 5th
    expect(goalStreak(v)).toBe(9);
  });

  it('counts estimated moving time across recording gaps', async () => {
    const t = setup();
    const c = await t.container();
    t.setNow(local(11, 6));
    await c.healthSync.connect.execute(); // before the workout: older ones are not imported
    t.setNow(local(11, 18));
    t.health.add({ uuid: 'gap' }, walk(local(11, 7), 10));
    await c.syncHealth();
    const before = (await c.goals.view.execute()).today.movingS;
    await t.db.run("UPDATE log_activities SET estimated_moving_s = 120 WHERE id = 'hk-gap'");
    expect((await c.goals.view.execute()).today.movingS).toBe(before + 120);
  });

  it('notifies the UI (dispatcher change) after set and hideOffer', async () => {
    const t = setup();
    const c = await t.container();
    let changes = 0;
    c.dispatcher.onChange(() => changes++);
    await c.goals.set.execute(30);
    await c.dispatcher.dispatchPending();
    expect(changes).toBe(1);
    await c.goals.hideOffer.execute();
    await c.dispatcher.dispatchPending();
    expect(changes).toBe(2);
  });

  it('keeps the newest row when an older save arrives late', async () => {
    const t = setup();
    await t.container();
    const repo = new SqliteGoalRepository(t.db);
    const stale = await repo.get();
    const fresh = await repo.get();
    fresh.set(60, '2026-11-11', 2);
    await repo.save(fresh);
    stale.set(30, '2026-11-11', 1);
    await repo.save(stale);
    expect((await repo.get()).goalOn('2026-11-11')).toBe(60);
  });
});

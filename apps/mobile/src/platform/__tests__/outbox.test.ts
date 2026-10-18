import { DomainError, type DomainEvent } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';

import type { Database } from '../database';
import { migrate } from '../migrations';
import { appendToOutbox, type DeadLetter, EventDispatcher, pruneOutbox } from '../outbox';

const DAY = 86_400_000;
type Row = {
  id: number;
  type: string;
  attempts: number;
  last_error: string | null;
  processed_at: number | null;
  next_attempt_at: number | null;
  dead_lettered_at: number | null;
};

async function setup(opts: { maxAttempts?: number } = {}) {
  const db = openNodeDatabase();
  await migrate(db);
  let now = Date.parse('2026-05-01T08:00:00Z');
  const dead: DeadLetter[] = [];
  const dispatcher = new EventDispatcher(db, {
    now: () => now,
    retryBaseMs: 1_000,
    maxAttempts: opts.maxAttempts,
    onDeadLetter: (d) => dead.push(d),
  });
  const delivered: string[] = [];
  return {
    db,
    dispatcher,
    dead,
    delivered,
    advance: (ms: number) => void (now += ms),
    now: () => now,
    append: (...events: DomainEvent[]) => db.transaction((tx) => appendToOutbox(tx, events, now)),
  };
}

const ev = (type: string, id: string): DomainEvent => ({ type, v: 1, at: 0, activityId: id }) as unknown as DomainEvent;
const idOf = (e: DomainEvent) => (e as unknown as { activityId: string }).activityId;
const rows = (db: Database) => db.all<Row>('SELECT * FROM sys_outbox ORDER BY id');

describe('EventDispatcher', () => {
  it('delivers in FIFO order and marks each event processed', async () => {
    const t = await setup();
    t.dispatcher.on('A', async (e) => void t.delivered.push(`A:${idOf(e)}`));
    t.dispatcher.on('B', async (e) => void t.delivered.push(`B:${idOf(e)}`));
    await t.append(ev('A', '1'), ev('B', '1'), ev('A', '2'));
    await t.dispatcher.dispatchPending();
    expect(t.delivered).toEqual(['A:1', 'B:1', 'A:2']);
    expect((await rows(t.db)).every((r) => r.processed_at === t.now() && r.attempts === 1)).toBe(true);
  });

  it('dead-letters a DomainError at once and continues with later events', async () => {
    const t = await setup();
    t.dispatcher.on('ActivityRecorded', async (e) => {
      if (idOf(e) === 'skewed') {
        throw new DomainError('claim.in-future', '52.1,21.0');
      }
      t.delivered.push(idOf(e));
    });
    await t.append(ev('ActivityRecorded', 'skewed'), ev('ActivityRecorded', 'next'));
    await t.dispatcher.dispatchPending();

    expect(t.delivered).toEqual(['next']);
    const [poisoned, next] = await rows(t.db);
    expect(poisoned.dead_lettered_at).toBe(t.now());
    expect(poisoned.processed_at).toBeNull();
    expect(poisoned.attempts).toBe(1);
    expect(poisoned.last_error).toContain('claim.in-future');
    expect(next.processed_at).not.toBeNull();
    // Diagnostics get the code only: never the message (it may carry coordinates).
    expect(t.dead).toEqual([{ id: poisoned.id, type: 'ActivityRecorded', attempts: 1, errorCode: 'claim.in-future' }]);
    expect(JSON.stringify(t.dead)).not.toContain('52.1');

    // A dead-lettered event is never delivered again.
    await t.dispatcher.dispatchPending();
    expect(t.delivered).toEqual(['next']);
  });

  it('dead-letters an unreadable payload and continues', async () => {
    const t = await setup();
    t.dispatcher.on('A', async () => void t.delivered.push('A'));
    await t.db.run("INSERT INTO sys_outbox (type, payload, created_at) VALUES ('A', '{not json', 0)");
    await t.append(ev('A', '1'));
    await t.dispatcher.dispatchPending();
    expect(t.delivered).toEqual(['A']);
    expect(t.dead.map((d) => d.errorCode)).toEqual(['SyntaxError']);
  });

  it('retries a transient failure with backoff, keeping later events behind it, then succeeds', async () => {
    const t = await setup();
    let failures = 2;
    t.dispatcher.on('A', async (e) => {
      if (idOf(e) === 'flaky' && failures-- > 0) {
        throw new Error('SQLITE_BUSY');
      }
      t.delivered.push(idOf(e));
    });
    await t.append(ev('A', 'flaky'), ev('A', 'later'));

    await t.dispatcher.dispatchPending();
    expect(t.delivered).toEqual([]); // FIFO: 'later' waits for the head
    let [head] = await rows(t.db);
    expect(head.attempts).toBe(1);
    expect(head.next_attempt_at).toBe(t.now() + 1_000);
    expect(head.last_error).toBe('Error: SQLITE_BUSY');

    await t.dispatcher.dispatchPending(); // still backing off: not even attempted
    expect((await rows(t.db))[0].attempts).toBe(1);

    t.advance(1_000);
    await t.dispatcher.dispatchPending();
    [head] = await rows(t.db);
    expect(head.attempts).toBe(2);
    expect(head.next_attempt_at).toBe(t.now() + 2_000); // exponential

    t.advance(2_000);
    await t.dispatcher.dispatchPending();
    expect(t.delivered).toEqual(['flaky', 'later']);
    [head] = await rows(t.db);
    expect(head.processed_at).not.toBeNull();
    expect(head.attempts).toBe(3);
    expect(t.dead).toEqual([]);
  });

  it('dead-letters after N failed attempts and then delivers the rest', async () => {
    const t = await setup({ maxAttempts: 3 });
    t.dispatcher.on('A', async (e) => {
      if (idOf(e) === 'broken') {
        throw new TypeError('x is undefined');
      }
      t.delivered.push(idOf(e));
    });
    await t.append(ev('A', 'broken'), ev('A', 'after'));
    for (let i = 0; i < 3; i++) {
      await t.dispatcher.dispatchPending();
      t.advance(60_000);
    }
    expect(t.delivered).toEqual(['after']);
    const [broken] = await rows(t.db);
    expect(broken.attempts).toBe(3);
    expect(broken.dead_lettered_at).not.toBeNull();
    expect(t.dead).toEqual([{ id: broken.id, type: 'A', attempts: 3, errorCode: 'TypeError' }]);
  });

  it('defaults to 5 attempts', async () => {
    const t = await setup();
    t.dispatcher.on('A', async () => {
      throw new Error('boom');
    });
    await t.append(ev('A', '1'));
    for (let i = 0; i < 4; i++) {
      await t.dispatcher.dispatchPending();
      t.advance(10 * 60_000);
    }
    expect(t.dead).toEqual([]);
    await t.dispatcher.dispatchPending();
    expect(t.dead.map((d) => d.attempts)).toEqual([5]);
  });

  it('keeps delivering when the dead-letter listener throws', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    const delivered: string[] = [];
    const d = new EventDispatcher(db, {
      onDeadLetter: () => {
        throw new Error('diagnostics down');
      },
    });
    d.on('A', async (e) => {
      if (idOf(e) === 'bad') {
        throw new DomainError('x');
      }
      delivered.push('ok');
    });
    await db.transaction((tx) => appendToOutbox(tx, [ev('A', 'bad'), ev('A', 'good')], 0));
    await d.dispatchPending();
    expect(delivered).toEqual(['ok']);
  });
});

describe('pruneOutbox', () => {
  it('drops processed rows after 30 days and dead letters after 90, never pending ones', async () => {
    const t = await setup();
    const now = t.now();
    const insert = (processed: number | null, dead: number | null) =>
      t.db.run(
        "INSERT INTO sys_outbox (type, payload, created_at, processed_at, dead_lettered_at) VALUES ('A', '{}', 0, ?, ?)",
        [processed, dead]
      );
    await insert(now - 31 * DAY, null); // 1 processed, old → pruned
    await insert(now - 29 * DAY, null); // 2 processed, recent → kept
    await insert(null, now - 91 * DAY); // 3 dead, old → pruned
    await insert(null, now - 60 * DAY); // 4 dead, recent → kept
    await insert(null, null); // 5 pending (created long ago) → kept
    await pruneOutbox(t.db, now);
    expect((await rows(t.db)).map((r) => r.id)).toEqual([2, 4, 5]);
  });
});

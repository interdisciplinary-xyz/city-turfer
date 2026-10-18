/**
 * The expo-sqlite adapter shares ONE native connection: a statement issued
 * while a transaction is open runs inside it. Reads must therefore wait for
 * open transactions, while the transaction's own `tx` reads must not
 * (deadlock).
 */
const log: string[] = [];
let releaseTx: () => void = () => undefined;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => void log.push(`exec ${sql.slice(0, 6)}`),
    runAsync: async (sql: string) => void log.push(`run ${sql}`),
    getAllAsync: async (sql: string) => {
      log.push(`all ${sql}`);
      return [];
    },
    getFirstAsync: async (sql: string) => {
      log.push(`first ${sql}`);
      return null;
    },
    withTransactionAsync: async (work: () => Promise<void>) => {
      log.push('BEGIN');
      await work();
      log.push('COMMIT');
    },
    closeAsync: async () => void log.push('close'),
  }),
}));

import { openExpoDatabase } from '../expo-database';

beforeEach(() => {
  log.length = 0;
});

it('reads issued during an open transaction run after it commits', async () => {
  const db = await openExpoDatabase('t.db');
  log.length = 0;
  const gate = new Promise<void>((r) => (releaseTx = r));
  const tx = db.transaction(async (t) => {
    await t.run('W1');
    await gate; // still open while other callers read
    await t.run('W2');
  });
  await new Promise((r) => setTimeout(r, 0));
  const first = db.first('R1');
  const all = db.all('R2');
  await new Promise((r) => setTimeout(r, 0));
  expect(log).toEqual(['BEGIN', 'run W1']);

  releaseTx();
  await Promise.all([tx, first, all]);
  expect(log).toEqual(['BEGIN', 'run W1', 'run W2', 'COMMIT', 'first R1', 'all R2']);
});

it('reads through the tx executor inside a transaction do not deadlock', async () => {
  const db = await openExpoDatabase('t.db');
  log.length = 0;
  const result = await db.transaction(async (t) => {
    await t.first('R-in-tx');
    await t.all('R2-in-tx');
    return 'done';
  });
  expect(result).toBe('done');
  expect(log).toEqual(['BEGIN', 'first R-in-tx', 'all R2-in-tx', 'COMMIT']);
});

it('a failed transaction does not block later reads', async () => {
  const db = await openExpoDatabase('t.db');
  await expect(
    db.transaction(async () => {
      throw new Error('boom');
    })
  ).rejects.toThrow('boom');
  await expect(db.first('R')).resolves.toBeNull();
});

it('close waits for an open transaction', async () => {
  const db = await openExpoDatabase('t.db');
  log.length = 0;
  const gate = new Promise<void>((r) => (releaseTx = r));
  const tx = db.transaction(async (t) => {
    await gate;
    await t.run('W');
  });
  const closed = db.close();
  await new Promise((r) => setTimeout(r, 0));
  expect(log).toEqual(['BEGIN']);
  releaseTx();
  await Promise.all([tx, closed]);
  expect(log).toEqual(['BEGIN', 'run W', 'COMMIT', 'close']);
});

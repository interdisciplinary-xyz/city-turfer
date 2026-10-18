import type { SqlExecutor, SqlParam } from './database';

/** Multi-row INSERT in chunks (SQLite allows 999 bound params per statement). */
export async function insertMany(
  tx: SqlExecutor,
  sqlPrefix: string, // e.g. 'INSERT OR IGNORE INTO t (a, b)'
  rows: readonly (readonly SqlParam[])[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const width = rows[0].length;
  const perChunk = Math.max(1, Math.floor(900 / width));
  const tuple = `(${new Array(width).fill('?').join(', ')})`;
  for (let i = 0; i < rows.length; i += perChunk) {
    const chunk = rows.slice(i, i + perChunk);
    await tx.run(`${sqlPrefix} VALUES ${chunk.map(() => tuple).join(', ')}`, chunk.flat());
  }
}

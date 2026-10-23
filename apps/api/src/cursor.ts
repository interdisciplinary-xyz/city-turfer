/** Opaque cursors: base64url JSON of a position the server checks with a guard (never trusted). */

export function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/** The position in `cursor` when it is base64url JSON that passes `guard`, else null. */
export function decodeCursor<T>(cursor: string, guard: (v: unknown) => v is T): T | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

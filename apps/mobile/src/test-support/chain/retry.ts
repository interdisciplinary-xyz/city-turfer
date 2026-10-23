/** Waits out one `rate-limited` answer (its `retryAfterS`, else a minute), then asks once more. */
export async function retryAfterWait<T extends { kind: string }>(call: () => Promise<T>): Promise<T> {
  const first = await call();
  if (first.kind !== 'rate-limited') {
    return first;
  }
  const { retryAfterS } = first as T & { retryAfterS?: number | null };
  // One code per address per minute (AUTH_LIMITS), as for a real user with a second phone.
  await new Promise((r) => setTimeout(r, ((retryAfterS ?? 60) + 1) * 1000));
  return call();
}

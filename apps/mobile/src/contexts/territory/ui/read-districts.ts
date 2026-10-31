import type { DistrictsView } from '../contract';

export type DistrictsState = DistrictsView | null | undefined;

/**
 * One read of the districts for `useDistricts`: the answer on success; on a failure `null`, unless
 * an earlier answer is on screen (kept). A use case that throws before returning its promise counts
 * as a failure. Returns the cancel for the effect's cleanup: it aborts the read's signal, so the use
 * case stops its scan at the next step, and a read that ends after it changes nothing.
 */
export function readDistricts(
  execute: (signal: { readonly aborted: boolean }) => Promise<DistrictsView>,
  set: (next: (cur: DistrictsState) => DistrictsState) => void
): () => void {
  const signal = { aborted: false };
  Promise.resolve()
    .then(() => execute(signal))
    .then(
      (r) => !signal.aborted && set(() => r),
      () => !signal.aborted && set((cur) => cur ?? null)
    );
  return () => {
    signal.aborted = true;
  };
}

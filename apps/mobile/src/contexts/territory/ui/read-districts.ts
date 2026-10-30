import type { DistrictsView } from '../contract';

export type DistrictsState = DistrictsView | null | undefined;

/**
 * One read of the districts for `useDistricts`: the answer on success; on a failure `null`, unless
 * an earlier answer is on screen (kept). A use case that throws before returning its promise counts
 * as a failure. Returns the cancel for the effect's cleanup: a read that ends after it changes
 * nothing.
 */
export function readDistricts(
  execute: () => Promise<DistrictsView>,
  set: (next: (cur: DistrictsState) => DistrictsState) => void
): () => void {
  let live = true;
  Promise.resolve()
    .then(execute)
    .then(
      (r) => live && set(() => r),
      () => live && set((cur) => cur ?? null)
    );
  return () => {
    live = false;
  };
}

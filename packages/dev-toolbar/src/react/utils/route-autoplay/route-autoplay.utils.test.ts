import { describe, expect, it } from 'vitest';

import { isPageSettled } from './route-autoplay.utils';

const entry = (overrides: Partial<PageSettleInput['entries'][number]> = {}): PageSettleInput['entries'][number] => ({
  page: '/pricing',
  status: 200,
  startedAt: 1_000,
  durationMs: 100,
  ...overrides,
});

type PageSettleInput = Parameters<typeof isPageSettled>[0];

const settled = (entries: PageSettleInput['entries'], now: number) =>
  isPageSettled({ entries, page: '/pricing', loadedAt: 0, now });

describe('isPageSettled', () => {
  it('waits for the minimum dwell even on a quiet page', () => {
    expect(settled([], 2_999)).toBe(false);
    expect(settled([], 3_000)).toBe(true);
  });

  it('waits while a request of this page is in flight', () => {
    expect(settled([entry({ status: 'pending' })], 5_000)).toBe(false);
  });

  it('waits for a quiet window after the last request finished', () => {
    // Finished at 4_100 → quiet from 6_100.
    const late = entry({ startedAt: 4_000, durationMs: 100 });
    expect(settled([late], 6_000)).toBe(false);
    expect(settled([late], 6_100)).toBe(true);
  });

  it('ignores other pages and requests from before this load', () => {
    const other = entry({ page: '/', status: 'pending' });
    const stale = entry({ startedAt: -5, status: 'pending' });
    expect(settled([other, stale], 3_000)).toBe(true);
  });

  it('leaves after the max dwell no matter what', () => {
    expect(settled([entry({ status: 'pending' })], 20_000)).toBe(true);
  });
});

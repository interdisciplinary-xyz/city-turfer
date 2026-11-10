import { endsAfterConnect, type ImportReport, lastImportAfter } from '../domain/health-sync-state';

const report = (r: Partial<ImportReport>): ImportReport => ({
  at: 1,
  imported: 0,
  withoutRoute: 0,
  duplicates: 0,
  beforeStart: 0,
  skipped: 0,
  ...r,
});

describe('endsAfterConnect', () => {
  it('counts workouts that end at or after the connection, not before', () => {
    expect(endsAfterConnect(1000, 1000)).toBe(true);
    expect(endsAfterConnect(1001, 1000)).toBe(true);
    expect(endsAfterConnect(999, 1000)).toBe(false);
  });
});

describe('lastImportAfter', () => {
  const importNow = report({ at: 1, beforeStart: 27 });

  it('keeps the previous report when a sync since the anchor found nothing to tell', () => {
    expect(lastImportAfter(importNow, report({ at: 2 }), false)).toBe(importNow);
    expect(lastImportAfter(importNow, report({ at: 2, skipped: 1 }), false)).toBe(importNow);
  });

  it('replaces it when the sync found something, on a full scan, or when there is none yet', () => {
    const found = report({ at: 2, imported: 1 });
    expect(lastImportAfter(importNow, found, false)).toBe(found);
    const noRoute = report({ at: 2, withoutRoute: 1 });
    expect(lastImportAfter(importNow, noRoute, false)).toBe(noRoute);
    const full = report({ at: 2 });
    expect(lastImportAfter(importNow, full, true)).toBe(full);
    expect(lastImportAfter(null, full, false)).toBe(full);
  });
});

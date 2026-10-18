import { RecordingSession } from '@/contexts/recording/domain/recording-session';
import { trackingProfileFor } from '@/contexts/recording/domain/tracking-profile';
import { loadFixes } from '@/test-support/fixtures';
import { oracleStats } from '@/test-support/oracle';

import { type ActivityType, analyzeTrack, trackFromPoints } from '..';

/**
 * Parity between the app (Fix Filter -> analyzeTrack) and the reference oracle
 * (tools/route-stats.mjs --json) on every fixture in tools/fixtures. Expected values come from the
 * oracle at test time, so a regenerated fixture is checked against fresh numbers.
 *
 * Known definition differences (tolerances below are sized for them; follow-ups, not fixed here):
 *  1. Distance in non-moving intervals: the oracle skips intervals slower than movingSpeed
 *     (stationary jitter); analyzeTrack adds every interval with dt > 0.
 *  2. Split timing: the oracle times a split by elapsed time between crossings (pauses included);
 *     analyzeTrack times it by moving seconds only.
 *  3. The oracle's Fix Filter is a reimplementation, so borderline fixes may be accepted by one
 *     and not the other.
 *  4. Oracle JSON values are rounded to whole metres/seconds.
 */
const DISTANCE_TOL = 0.03;
const MOVING_TOL = 0.05;
const SPLIT_TOL = 0.1;
const SPLIT_LOW_TOL = 0.3; // run fixture has a pause inside one split (difference 2)

const FIXTURES: [string, ActivityType][] = [
  ['walk-2k.gpx', 'walk'],
  ['run-5k-outliers-pause.gpx', 'run'],
  ['cycle-20k.gpx', 'cycle'],
];

describe.each(FIXTURES)('app vs oracle on %s', (file, type) => {
  const oracle = oracleStats(file);
  const fixes = loadFixes(file);
  const session = RecordingSession.start('s', type, fixes[0].t);
  const accepted = session.ingest(fixes);
  const stats = analyzeTrack(trackFromPoints(accepted), trackingProfileFor(type).movingSpeedMps);

  it('oracle reports the fixture type', () => expect(oracle.type).toBe(type));

  it('distance within tolerance', () => {
    expect(Math.abs(stats.distanceM - oracle.distanceM) / oracle.distanceM).toBeLessThan(DISTANCE_TOL);
  });

  it('session snapshot distance within tolerance', () => {
    expect(Math.abs(session.snapshot(0).distanceM - oracle.distanceM) / oracle.distanceM).toBeLessThan(DISTANCE_TOL);
  });

  it('moving time within tolerance', () => {
    expect(Math.abs(stats.movingS - oracle.movingS) / oracle.movingS).toBeLessThan(MOVING_TOL);
  });

  it('same number of full-kilometre splits (+-1)', () => {
    expect(Math.abs(stats.splits.length - oracle.splits.length)).toBeLessThanOrEqual(1);
  });

  it('split times: moving time never exceeds oracle elapsed time and stays within tolerance', () => {
    const n = Math.min(stats.splits.length, oracle.splits.length);
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const app = stats.splits[i].seconds;
      const ref = oracle.splits[i].seconds;
      expect(app).toBeLessThanOrEqual(ref * (1 + SPLIT_TOL)); // moving <= elapsed (difference 2)
      expect(app).toBeGreaterThanOrEqual(ref * (1 - SPLIT_LOW_TOL)); // a pause inside a split is the big gap
    }
  });
});

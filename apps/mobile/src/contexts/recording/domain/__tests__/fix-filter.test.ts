import type { ActivityType } from '@/shared-kernel';

import type { Fix } from '../fix';
import { type FixVerdict, judgeFix, type Tail } from '../fix-filter';
import { trackingProfileFor } from '../tracking-profile';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const M_PER_DEG_LAT = 111_195;
const at = (sec: number, metresNorth: number): Tail => ({
  lat: 52.2 + metresNorth / M_PER_DEG_LAT,
  lon: 21,
  t: T0 + sec * 1000,
});
const fix = (sec: number, metresNorth: number, extra: Partial<Fix> = {}): Fix => ({
  ...at(sec, metresNorth),
  accuracy: 5,
  alt: null,
  speed: null,
  ...extra,
});

interface Case {
  name: string;
  type?: ActivityType;
  fix: Fix;
  tail: Tail | null;
  lastSeenT?: number | null;
  lastSeen?: Tail | null;
  expect: Partial<{ kind: FixVerdict['kind']; reason: string; speedMps: number; distanceM: number; dtS: number }>;
}

const TAIL = at(0, 0);

const cases: Case[] = [
  // 1. accuracy (run maxAccuracyM = 25, cycle 30)
  {
    name: 'accuracy exactly at maxAccuracyM is kept',
    fix: fix(1, 0, { accuracy: 25 }),
    tail: null,
    expect: { kind: 'accept' },
  },
  {
    name: 'accuracy above maxAccuracyM is rejected',
    fix: fix(1, 0, { accuracy: 25.1 }),
    tail: null,
    expect: { kind: 'reject', reason: 'inaccurate' },
  },
  {
    name: 'unknown accuracy (null) is kept',
    fix: fix(1, 0, { accuracy: null }),
    tail: null,
    expect: { kind: 'accept' },
  },
  {
    name: 'cycle tolerates 30 m accuracy',
    type: 'cycle',
    fix: fix(1, 0, { accuracy: 30 }),
    tail: null,
    expect: { kind: 'accept' },
  },
  {
    name: 'accuracy is checked before ordering',
    fix: fix(0, 0, { accuracy: 99 }),
    tail: TAIL,
    lastSeenT: TAIL.t,
    expect: { kind: 'reject', reason: 'inaccurate' },
  },

  // 2. ordering
  {
    name: 't == lastSeenT is out-of-order',
    fix: fix(5, 10),
    tail: TAIL,
    lastSeenT: T0 + 5000,
    expect: { kind: 'reject', reason: 'out-of-order' },
  },
  {
    name: 't < lastSeenT is out-of-order',
    fix: fix(4, 10),
    tail: TAIL,
    lastSeenT: T0 + 5000,
    expect: { kind: 'reject', reason: 'out-of-order' },
  },
  {
    name: 't 1 ms after lastSeenT is judged',
    fix: { ...fix(5, 10), t: T0 + 5001 },
    tail: TAIL,
    lastSeenT: T0 + 5000,
    expect: { kind: 'accept' },
  },

  // 3. segment start (no tail)
  {
    name: 'no tail, no last seen, no Doppler: speed 0',
    fix: fix(1, 0),
    tail: null,
    expect: { kind: 'accept', speedMps: 0, distanceM: 0, dtS: 0 },
  },
  {
    name: 'no tail, Doppler speed used',
    fix: fix(1, 0, { speed: 2.5 }),
    tail: null,
    expect: { kind: 'accept', speedMps: 2.5 },
  },
  {
    name: 'no tail, short interval from last seen: implied speed when Doppler missing',
    fix: fix(2, 6),
    tail: null,
    lastSeen: at(0, 0),
    expect: { kind: 'accept', speedMps: 3, distanceM: 0, dtS: 0 },
  },
  {
    name: 'no tail, short interval from last seen: Doppler wins',
    fix: fix(2, 6, { speed: 2 }),
    tail: null,
    lastSeen: at(0, 0),
    expect: { kind: 'accept', speedMps: 2 },
  },
  {
    name: 'no tail, sub-minStep wander from last seen and no Doppler: 0 m/s',
    fix: fix(1, 1.5),
    tail: null,
    lastSeen: at(0, 0),
    expect: { kind: 'accept', speedMps: 0 },
  },
  {
    name: 'no tail, long interval from last seen: implied wins over Doppler',
    fix: fix(60, 120, { speed: 7 }),
    tail: null,
    lastSeen: at(0, 0),
    expect: { kind: 'accept', speedMps: 2 },
  },

  // 4. speed source: Doppler while the previous fix is <= 5 s old, else implied from the reference
  {
    name: 'dt 2 s: Doppler speed preferred',
    fix: fix(2, 10, { speed: 4.5 }),
    tail: TAIL,
    expect: { kind: 'accept', speedMps: 4.5, distanceM: 10, dtS: 2 },
  },
  { name: 'dt 2 s, no Doppler: implied', fix: fix(2, 10), tail: TAIL, expect: { kind: 'accept', speedMps: 5 } },
  {
    name: 'dt exactly 5 s: still Doppler',
    fix: fix(5, 10, { speed: 3.3 }),
    tail: TAIL,
    expect: { kind: 'accept', speedMps: 3.3 },
  },
  {
    name: 'dt 6 s: implied, Doppler ignored',
    fix: fix(6, 30, { speed: 1 }),
    tail: TAIL,
    expect: { kind: 'accept', speedMps: 5, dtS: 6 },
  },
  {
    name: 'tail 6 s old but previous fix 1 s ago (jitter skipped): Doppler is fresh',
    fix: fix(6, 30, { speed: 1.2 }),
    tail: TAIL,
    lastSeenT: T0 + 5000,
    expect: { kind: 'accept', speedMps: 1.2, dtS: 6, distanceM: 30 },
  },
  {
    name: 'previous fix 6 s ago: Doppler stale even with a recent tail',
    fix: fix(6, 30, { speed: 1 }),
    tail: TAIL,
    lastSeenT: T0,
    expect: { kind: 'accept', speedMps: 5 },
  },

  // 5. teleport (run maxSpeed 8)
  {
    name: 'implied above maxSpeed is a teleport',
    fix: fix(2, 20),
    tail: TAIL,
    expect: { kind: 'reject', reason: 'teleport' },
  },
  {
    name: 'teleport is judged on implied, not Doppler',
    fix: fix(2, 20, { speed: 3 }),
    tail: TAIL,
    expect: { kind: 'reject', reason: 'teleport' },
  },
  {
    name: 'same instant as tail (dt 0) is a teleport',
    fix: fix(0, 5),
    tail: TAIL,
    lastSeenT: null,
    expect: { kind: 'reject', reason: 'teleport' },
  },

  // 6. jitter (run minStep 4)
  {
    name: 'below minStep within 10 s is jitter, 0 m/s without Doppler',
    fix: fix(9, 3),
    tail: TAIL,
    expect: { kind: 'jitter', speedMps: 0 },
  },
  {
    name: 'GPS wander of 3 m in 1 s is not read as 3 m/s',
    fix: fix(1, 3),
    tail: TAIL,
    expect: { kind: 'jitter', speedMps: 0 },
  },
  {
    name: 'jitter with stale Doppler (previous fix 7 s ago) is 0 m/s',
    fix: fix(7, 1, { speed: 2 }),
    tail: TAIL,
    expect: { kind: 'jitter', speedMps: 0 },
  },
  {
    name: 'jitter 7 s from the reference with fresh Doppler keeps it',
    fix: fix(7, 1, { speed: 2 }),
    tail: TAIL,
    lastSeenT: T0 + 6000,
    expect: { kind: 'jitter', speedMps: 2 },
  },
  {
    name: 'jitter still reports Doppler speed for auto-resume',
    fix: fix(1, 1, { speed: 2 }),
    tail: TAIL,
    expect: { kind: 'jitter', speedMps: 2 },
  },
  {
    name: 'below minStep at dt 10 s is accepted',
    fix: fix(10, 3),
    tail: TAIL,
    expect: { kind: 'accept', distanceM: 3, dtS: 10, speedMps: 0.3 },
  },
  { name: 'just above minStep is accepted', fix: fix(1, 4.1), tail: TAIL, expect: { kind: 'accept' } },

  // 7. per-type profiles
  {
    name: 'walk: 4.5 m/s is a teleport (maxSpeed 4)',
    type: 'walk',
    fix: fix(2, 9),
    tail: TAIL,
    expect: { kind: 'reject', reason: 'teleport' },
  },
  { name: 'run: 4.5 m/s is fine', type: 'run', fix: fix(2, 9), tail: TAIL, expect: { kind: 'accept' } },
  {
    name: 'run: 20 m/s is a teleport (maxSpeed 8)',
    type: 'run',
    fix: fix(1, 20),
    tail: TAIL,
    expect: { kind: 'reject', reason: 'teleport' },
  },
  {
    name: 'cycle: 20 m/s is fine (maxSpeed 25)',
    type: 'cycle',
    fix: fix(1, 20),
    tail: TAIL,
    expect: { kind: 'accept' },
  },
  {
    name: 'cycle: 26 m/s is a teleport',
    type: 'cycle',
    fix: fix(1, 26),
    tail: TAIL,
    expect: { kind: 'reject', reason: 'teleport' },
  },
  {
    name: 'walk: 3.1 m step accepted (minStep 3)',
    type: 'walk',
    fix: fix(1, 3.1),
    tail: TAIL,
    expect: { kind: 'accept' },
  },
  {
    name: 'run: 3.1 m step is jitter (minStep 4)',
    type: 'run',
    fix: fix(1, 3.1),
    tail: TAIL,
    expect: { kind: 'jitter' },
  },
  {
    name: 'cycle: 5.9 m step is jitter (minStep 6)',
    type: 'cycle',
    fix: fix(1, 5.9),
    tail: TAIL,
    expect: { kind: 'jitter' },
  },
  { name: 'cycle: 6.1 m step accepted', type: 'cycle', fix: fix(1, 6.1), tail: TAIL, expect: { kind: 'accept' } },
];

describe('judgeFix (Fix Filter)', () => {
  it.each(cases)('$name', (c) => {
    const v = judgeFix(
      c.fix,
      c.tail,
      c.lastSeenT ?? c.lastSeen?.t ?? null,
      trackingProfileFor(c.type ?? 'run'),
      c.lastSeen ?? null
    );
    const { speedMps, distanceM, dtS, ...exact } = c.expect;
    expect(v).toMatchObject(exact);
    if (speedMps != null) {
      expect((v as { speedMps: number }).speedMps).toBeCloseTo(speedMps, 2);
    }
    if (distanceM != null) {
      expect((v as { distanceM: number }).distanceM).toBeCloseTo(distanceM, 1);
    }
    if (dtS != null) {
      expect((v as { dtS: number }).dtS).toBeCloseTo(dtS, 3);
    }
  });

  it('profiles match the reference oracle (tools/lib/geo.mjs PROFILES)', () => {
    const oracle = {
      walk: { maxSpeed: 4, movingSpeed: 0.5, minStep: 3 },
      run: { maxSpeed: 8, movingSpeed: 1.0, minStep: 4 },
      cycle: { maxSpeed: 25, movingSpeed: 1.5, minStep: 6 },
    } as const;
    for (const type of ['walk', 'run', 'cycle'] as const) {
      const p = trackingProfileFor(type);
      expect({ maxSpeed: p.maxSpeedMps, movingSpeed: p.movingSpeedMps, minStep: p.minStepM }).toEqual(oracle[type]);
    }
  });
});

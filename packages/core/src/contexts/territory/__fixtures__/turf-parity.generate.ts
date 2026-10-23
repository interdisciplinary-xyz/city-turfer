/**
 * G2 turf parity fixture (phone ↔ server): the input (`turf-parity.json`) and its golden
 * (`turf-parity.expected.json`) are both built here, so they can be regenerated:
 *
 *   WRITE_TURF_PARITY=1 pnpm --filter @cityturfer/core exec jest turf-parity
 *   pnpm exec prettier --write packages/core/src/contexts/territory/__fixtures__
 *
 * Without the variable, `application/__tests__/turf-parity.test.ts` checks that the committed files
 * are exactly what this module builds, then replays the operations through `createTurfApi`.
 *
 * Tracks are synthetic lines between public landmarks of Gdańsk Main Town (Golden Gate, Long
 * Lane, Long Market, Neptune's Fountain, Green Gate, the Motława waterfront, the Crane, St Mary's):
 * no real recording. Points are compact `[lon, lat, t, segment, altitudeM | null]`, as uploaded.
 *
 * The golden is a rebuild from the claims that survive the operations, never the incremental
 * result: per cell the visit counts by type and `firstAt`, the start of its first claimer (D4, the
 * earliest `(startedAt, activityId)` with ids in JS string order, whatever the upload order), plus
 * the summary at the fixed `now` and each surviving claim's canonical new cells.
 */
import { ACTIVITY_TYPES } from '../../../constants/activity';
import { H3CellGrid } from '../../../h3';
import { type ActivityType, distanceM, interpolate, trackFromPoints, type TrackPoint } from '../../../shared-kernel';
import type { CellId } from '../domain/cell-grid';
import { Claim } from '../domain/claim';
import { isStrong, strengthOf } from '../domain/strength';

export type CompactPoint = [lon: number, lat: number, t: number, segment: number, altitudeM: number | null];

export interface ParityActivity {
  id: string;
  type: ActivityType;
  /** As the API's upload names it. `apple-health` ids are `hk-<uuid>`. */
  source: 'recording' | 'apple-health' | 'import';
  /** Always the first point's `t` (the phone's import takes it from there). */
  startedAt: number;
  endedAt: number;
  points: CompactPoint[];
}

/**
 * - `create`: a new activity (upload; phone: import).
 * - `replace-track`: the same id, type and start with a new track (upload of a new track; phone:
 *   a track correction, `ActivityTrackCorrected` → reclaim).
 * - `change-type`: the same id, start and track with another type (upload; the phone has no such
 *   edit: delete and import again, the same release + claim).
 * - `delete`: the activity is removed (phone and server).
 */
export type ParityOperation =
  { op: 'create' | 'replace-track' | 'change-type'; activity: ParityActivity } | { op: 'delete'; id: string };

export interface ParityInput {
  description: string;
  /** The clock for every operation and the summary (epoch ms). */
  now: number;
  nowIso: string;
  operations: ParityOperation[];
}

export type ParityCell = [id: string, walk: number, run: number, cycle: number, firstAt: number];

export interface ParityExpected {
  description: string;
  now: number;
  summary: {
    cellCount: number;
    areaKm2: number;
    strongCells: number;
    newThisWeekKm2: number;
    newThisMonthKm2: number;
    byType: Record<ActivityType, number>;
  };
  /** Surviving claims by activity id (sorted): canonical new cells (D4). */
  claims: { activityId: string; cellCount: number; newCellCount: number; newAreaKm2: number }[];
  /** Every Turf Cell, sorted by id (JS string order). */
  cells: ParityCell[];
}

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-20T12:00:00Z');

// Public landmarks of Gdańsk Main Town, [lat, lon] (approximate, ~10 m).
const L = {
  goldenGate: [54.34905, 18.6479],
  townHall: [54.3487, 18.6531],
  neptune: [54.34855, 18.65335],
  greenGate: [54.3482, 18.656],
  waterfrontSouth: [54.34835, 18.6569],
  mariackaQuay: [54.3499, 18.6573],
  crane: [54.3509, 18.6577],
  stMarys: [54.3498, 18.654],
  piwnaWest: [54.34985, 18.6486],
  piwnaEast: [54.3497, 18.653],
  ogarnaWest: [54.3482, 18.6483],
  ogarnaEast: [54.3479, 18.6538],
} as const satisfies Record<string, readonly [number, number]>;
type Landmark = keyof typeof L;

const SPEED_MPS: Record<ActivityType, number> = { walk: 1.4, run: 3, cycle: 5 };
const STEP_M = 15;
const SEGMENT_PAUSE_MS = 5 * 60_000;

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Points every ~15 m along the landmark path(s), one segment per path, at the type's speed. */
function track(type: ActivityType, startedAt: number, paths: Landmark[][]): CompactPoint[] {
  const out: CompactPoint[] = [];
  let t = startedAt;
  paths.forEach((path, segment) => {
    if (segment > 0) {
      t += SEGMENT_PAUSE_MS;
    }
    for (let i = 0; i < path.length; i++) {
      const a = { lat: L[path[i]][0], lon: L[path[i]][1] };
      if (i === 0) {
        out.push([round6(a.lon), round6(a.lat), t, segment, null]);
      }
      const next = path[i + 1];
      if (!next) {
        break;
      }
      const b = { lat: L[next][0], lon: L[next][1] };
      const d = distanceM(a, b);
      const n = Math.max(1, Math.ceil(d / STEP_M));
      for (let s = 1; s <= n; s++) {
        const p = interpolate(a, b, s / n);
        t += Math.round((d / n / SPEED_MPS[type]) * 1000);
        out.push([round6(p.lon), round6(p.lat), t, segment, null]);
      }
    }
  });
  return out;
}

function activity(
  id: string,
  type: ActivityType,
  source: ParityActivity['source'],
  startedAt: number,
  paths: Landmark[][]
): ParityActivity {
  const points = track(type, startedAt, paths);
  return { id, type, source, startedAt, endedAt: points[points.length - 1][2], points };
}

// Ids: lowercase UUIDs (phone recordings), an uppercase UUID (another import) and hk-<UUID> (Apple
// Health). TIE_RECORDING and TIE_IMPORT start at the same instant: under JS string order (and
// COLLATE "C") 'B7…' < 'a1…', under en_US 'a1…' < 'B7…'. The import is the first claimer.
const ID = {
  longLaneEarly: '4c1f8e2a-9d3b-4f60-8a71-2b5c6d7e8f90',
  longLane: '7e2d9c1b-3a4f-4e5d-9b6c-0a1b2c3d4e5f',
  waterfrontRun: '0d5a7b3c-1e2f-4a6b-8c9d-3e4f5a6b7c8d',
  craneRide: 'c3b2a190-8f7e-4d6c-b5a4-9382716f5e4d',
  longMarketRide: 'e9f8a7b6-5c4d-4e3f-a2b1-0c9d8e7f6a5b',
  tieRecording: 'a1d40c2e-6b0f-4c39-9d7e-2f5b8e1c3a90',
  tieImport: 'B7E2F9A0-3C4D-4E5F-8A6B-1C2D3E4F5A6B',
  appleHealth: 'hk-5F0C2B9E-71A4-4D3B-9E8F-6A7B8C9D0E1F',
} as const;

export function buildParityInput(): ParityInput {
  const longLane = activity(ID.longLane, 'walk', 'recording', NOW - 10 * DAY, [
    ['goldenGate', 'townHall', 'neptune', 'greenGate'],
  ]);
  const craneRide = activity(ID.craneRide, 'cycle', 'recording', NOW - 3 * DAY, [['crane', 'mariackaQuay', 'stMarys']]);
  const tieAt = NOW - 5 * DAY;
  const tiePath: Landmark[][] = [['piwnaWest', 'piwnaEast', 'neptune', 'greenGate']];
  return {
    description:
      'G2 turf parity (phone == server). Synthetic tracks along Gdańsk Main Town landmarks. ' +
      'Generated by turf-parity.generate.ts; regenerate, never edit by hand.',
    now: NOW,
    nowIso: new Date(NOW).toISOString(),
    operations: [
      // The earliest claimer of Long Lane's western cells; deleted below while those cells survive.
      {
        op: 'create',
        activity: activity(ID.longLaneEarly, 'walk', 'recording', NOW - 45 * DAY, [
          ['goldenGate', 'townHall', 'neptune'],
        ]),
      },
      { op: 'create', activity: longLane },
      {
        op: 'create',
        activity: activity(ID.waterfrontRun, 'run', 'recording', NOW - 20 * DAY, [
          ['neptune', 'greenGate', 'waterfrontSouth', 'mariackaQuay', 'crane'],
        ]),
      },
      { op: 'create', activity: craneRide },
      // Same start, ids that order differently under JS/C and en_US; the recording arrives first.
      { op: 'create', activity: activity(ID.tieRecording, 'run', 'recording', tieAt, tiePath) },
      { op: 'create', activity: activity(ID.tieImport, 'walk', 'import', tieAt, tiePath) },
      // Track replace: Long Lane up to Neptune, then (after a pause, segment 1) Ogarna.
      {
        op: 'replace-track',
        activity: activity(ID.longLane, 'walk', 'recording', longLane.startedAt, [
          ['goldenGate', 'townHall', 'neptune'],
          ['ogarnaWest', 'ogarnaEast'],
        ]),
      },
      // Type change: the ride was a run (same track and start).
      { op: 'change-type', activity: { ...craneRide, type: 'run' } },
      // The ride that survives: Long Market and the Green Gate, over cells a walk and a run also
      // claim, so some cells count all three types (pins the cycle column on both sides).
      {
        op: 'create',
        activity: activity(ID.longMarketRide, 'cycle', 'recording', NOW - 2 * DAY, [
          ['townHall', 'neptune', 'greenGate', 'waterfrontSouth'],
        ]),
      },
      { op: 'delete', id: ID.longLaneEarly },
      // An older Apple Health walk arriving last: first claimer of Long Market whatever the order.
      {
        op: 'create',
        activity: activity(ID.appleHealth, 'walk', 'apple-health', NOW - 60 * DAY, [
          ['townHall', 'neptune', 'greenGate'],
        ]),
      },
    ],
  };
}

const toTrackPoints = (points: readonly CompactPoint[]): TrackPoint[] =>
  points.map(([lon, lat, t, segment, alt]) => ({ lon, lat, t, segment, alt, accuracy: null, speed: null }));

/** D4 order: earliest start, then activity id in JS string (code unit) order. */
const firstOf = (a: { startedAt: number; id: string }, b: { startedAt: number; id: string }) =>
  a.startedAt !== b.startedAt ? a.startedAt < b.startedAt : a.id < b.id;

/** The golden: a rebuild from the activities left after every operation (not an incremental replay). */
export function buildParityExpected(input: ParityInput, grid = new H3CellGrid()): ParityExpected {
  const final = new Map<string, ParityActivity>();
  for (const o of input.operations) {
    if (o.op === 'delete') {
      final.delete(o.id);
    } else {
      final.set(o.activity.id, o.activity);
    }
  }
  const cellsOf = new Map<string, ReadonlySet<CellId>>();
  const cells = new Map<CellId, { counts: Record<ActivityType, number>; first: ParityActivity }>();
  for (const a of final.values()) {
    const claim = Claim.fromTrack(
      { activityId: a.id, type: a.type, startedAt: a.startedAt },
      trackFromPoints(toTrackPoints(a.points)),
      grid,
      input.now
    );
    cellsOf.set(a.id, claim.state.cells);
    for (const c of claim.state.cells) {
      const row = cells.get(c) ?? { counts: { walk: 0, run: 0, cycle: 0 }, first: a };
      row.counts[a.type]++;
      if (firstOf(a, row.first)) {
        row.first = a;
      }
      cells.set(c, row);
    }
  }

  let area = 0;
  let week = 0;
  let month = 0;
  let strong = 0;
  const byType: Record<ActivityType, number> = { walk: 0, run: 0, cycle: 0 };
  for (const [c, row] of cells) {
    const a = grid.areaM2(c);
    area += a;
    if (input.now - row.first.startedAt <= 7 * DAY) {
      week += a;
    }
    if (input.now - row.first.startedAt <= 30 * DAY) {
      month += a;
    }
    if (isStrong(strengthOf(row.counts.walk + row.counts.run + row.counts.cycle))) {
      strong++;
    }
    for (const t of ACTIVITY_TYPES) {
      if (row.counts[t] > 0) {
        byType[t]++;
      }
    }
  }

  const byId = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  const claims = [...cellsOf.entries()]
    .sort(([x], [y]) => byId(x, y))
    .map(([activityId, set]) => {
      const fresh = [...set].filter((c) => cells.get(c)!.first.id === activityId);
      return {
        activityId,
        cellCount: set.size,
        newCellCount: fresh.length,
        newAreaKm2: fresh.reduce((s, c) => s + grid.areaM2(c), 0) / 1e6,
      };
    });

  return {
    description:
      'Golden for turf-parity.json: rebuilt from the surviving claims, first claimer by D4. ' +
      'Generated by turf-parity.generate.ts; regenerate, never edit by hand.',
    now: input.now,
    summary: {
      cellCount: cells.size,
      areaKm2: area / 1e6,
      strongCells: strong,
      newThisWeekKm2: week / 1e6,
      newThisMonthKm2: month / 1e6,
      byType,
    },
    claims,
    cells: [...cells.entries()]
      .sort(([x], [y]) => byId(x, y))
      .map(([id, r]): ParityCell => [id, r.counts.walk, r.counts.run, r.counts.cycle, r.first.startedAt]),
  };
}

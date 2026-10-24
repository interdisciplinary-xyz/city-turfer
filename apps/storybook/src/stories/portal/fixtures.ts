// Made-up data for the portal stories: an @e2e.cityturfer.test account, no real person; activity
// shapes start at a public square, never a real trace.
// Also loads the portal's stylesheet, which only the portal root's layout imports on the site.
import '@/app/[locale]/account/portal.css';

import { PortalError } from '@/api/errors';
import type {
  ActivityDetail,
  ActivitySummary,
  ActivityTotals,
  AuthSession,
  Consent,
  DataExportJob,
  LonLat,
  Track,
  User,
} from '@/api/schema';

export const USER: User = {
  id: 'u_story',
  email: 'walker@e2e.cityturfer.test',
  name: null,
  displayName: 'u_story',
  hasPassword: false,
  passwordChangedAt: null,
  createdAt: '2026-09-14T08:30:00Z',
};

export const CONSENTS: Record<'never' | 'withdrawn' | 'on' | 'onWithHealth', Consent[]> = {
  never: [],
  withdrawn: [{ purpose: 'cloud-sync', granted: false, policyVersion: '2026-10', at: '2026-10-18T19:02:00Z' }],
  on: [{ purpose: 'cloud-sync', granted: true, policyVersion: '2026-10', at: '2026-09-14T08:31:00Z' }],
  onWithHealth: [
    { purpose: 'cloud-sync', granted: true, policyVersion: '2026-10', at: '2026-09-14T08:31:00Z' },
    { purpose: 'apple-health-in-cloud-sync', granted: true, policyVersion: '2026-10', at: '2026-09-20T17:45:00Z' },
  ],
};

export const SESSIONS: AuthSession[] = [
  {
    id: 'sess_browser_here',
    client: 'browser',
    createdAt: '2026-10-22T07:10:00Z',
    lastActiveAt: '2026-10-22T00:00:00Z',
    expiresAt: '2026-11-05T07:10:00Z',
    current: true,
  },
  {
    id: 'sess_phone',
    client: 'phone',
    createdAt: '2026-09-14T08:30:00Z',
    lastActiveAt: '2026-10-21T00:00:00Z',
    expiresAt: '2026-12-20T08:30:00Z',
    current: false,
  },
  {
    id: 'sess_browser_other',
    client: 'browser',
    createdAt: '2026-10-02T12:00:00Z',
    lastActiveAt: '2026-10-03T00:00:00Z',
    expiresAt: '2026-10-17T12:00:00Z',
    current: false,
  },
];

export const exportJob = (status: DataExportJob['status']): DataExportJob => ({
  id: 'exp_story',
  status,
  requestedAt: '2026-10-22T09:00:00Z',
  readyAt: status === 'pending' || status === 'failed' ? null : '2026-10-22T09:01:00Z',
  expiresAt: status === 'pending' || status === 'failed' ? null : '2026-10-23T09:01:00Z',
});

export const ERRORS = {
  wrongCode: new PortalError('auth.invalid-code', { status: 401 }),
  rateLimited: new PortalError('auth.rate-limited', { status: 429, retryAfterSeconds: 45 }),
  exportDaily: new PortalError('rate-limited', { status: 429, retryAfterSeconds: 20 * 3600 }),
  generic: new PortalError('generic', { status: 500, requestId: 'req_01JB2S7Y' }),
  unreachable: new PortalError('unreachable'),
};

/** A pretend API call: resolves or rejects after a short pause, so pending states show. */
export const after = (ms: number, outcome: 'ok' | PortalError) => () =>
  new Promise<void>((resolve, reject) => {
    window.setTimeout(() => (outcome === 'ok' ? resolve() : reject(outcome)), ms);
  });

// ---------- Activity history ----------
// Made-up routes drawn from a public square (Długi Targ, Gdańsk), never a recorded trace.

type Leg = readonly [metres: number, bearing: number];

const SQUARE: readonly [number, number] = [18.6532, 54.3487];
const M_LAT = 111_320;
const M_LON = M_LAT * Math.cos((SQUARE[1] * Math.PI) / 180);

/** [lon, lat] every ~50 m along `legs`, from the square shifted by `offset` metres (east, north). */
function shape(legs: readonly Leg[], offset: readonly [number, number] = [0, 0]): LonLat[] {
  let [east, north] = offset;
  const out: LonLat[] = [[SQUARE[0] + east / M_LON, SQUARE[1] + north / M_LAT]];
  for (const [metres, bearing] of legs) {
    const steps = Math.max(1, Math.round(metres / 50));
    const rad = (bearing * Math.PI) / 180;
    for (let i = 0; i < steps; i++) {
      east += (Math.sin(rad) * metres) / steps;
      north += (Math.cos(rad) * metres) / steps;
      out.push([SQUARE[0] + east / M_LON, SQUARE[1] + north / M_LAT]);
    }
  }
  return out;
}

const LOOP: Leg[] = [
  [800, 80],
  [600, 10],
  [700, 250],
  [300, 170],
];
const OUT_AND_UP: Leg[] = [
  [1500, 30],
  [1200, 60],
  [900, 10],
];
const BLOCK: Leg[] = [
  [500, 0],
  [400, 90],
  [500, 180],
];

const summary = (over: Partial<ActivitySummary> & Pick<ActivitySummary, 'id' | 'type' | 'name' | 'startedAt'>) =>
  ({
    source: 'recording',
    endedAt: over.startedAt,
    timeZone: 'Europe/Warsaw',
    distanceM: 2400,
    estimatedDistanceM: 0,
    movingS: 800,
    elapsedS: 860,
    elevationGainM: 6,
    preview: shape(LOOP),
    pointCount: 400,
    trackHash: '0'.repeat(64),
    version: 1,
    updatedAt: over.startedAt,
    coreVersion: '0.11.0',
    ...over,
  }) satisfies ActivitySummary;

export const ACTIVITIES: ActivitySummary[] = [
  summary({
    id: 'act_1',
    type: 'run',
    name: 'Run along the Motława',
    startedAt: '2026-10-22T06:12:00Z',
    distanceM: 5020,
    estimatedDistanceM: 240,
    movingS: 1694,
    elapsedS: 1760,
  }),
  summary({
    id: 'act_2',
    type: 'walk',
    name: 'Evening walk',
    startedAt: '2026-10-19T16:40:00Z',
    preview: shape(BLOCK),
  }),
  summary({
    id: 'hk-act_3',
    type: 'cycle',
    name: 'Ride to the beach',
    source: 'apple-health',
    startedAt: '2026-10-15T14:48:00Z',
    distanceM: 14_200,
    movingS: 2580,
    elapsedS: 2700,
    preview: shape(OUT_AND_UP),
  }),
  summary({ id: 'act_4', type: 'walk', name: 'Lunch walk', startedAt: '2026-10-02T10:36:00Z', timeZone: null }),
  summary({
    id: 'act_5',
    type: 'run',
    name: 'Long run',
    startedAt: '2026-09-28T05:00:00Z',
    distanceM: 21_100,
    movingS: 7020,
    elapsedS: 7300,
    preview: shape(OUT_AND_UP, [200, 0]),
  }),
  summary({
    id: 'act_6',
    type: 'cycle',
    name: 'Commute',
    startedAt: '2026-09-25T06:30:00Z',
    distanceM: 3600,
    movingS: 600,
    preview: shape(BLOCK),
  }),
];

export const TOTALS: ActivityTotals = {
  allTime: { count: 42, distanceM: 210_400, movingS: 71_250 },
  byType: {
    walk: { count: 18, distanceM: 41_300, movingS: 32_100 },
    run: { count: 15, distanceM: 82_900, movingS: 27_800 },
    cycle: { count: 9, distanceM: 86_200, movingS: 11_350 },
  },
};

const firstPart = shape([
  [900, 90],
  [400, 20],
]);
const secondPart = shape(
  [
    [700, 0],
    [600, 280],
    [500, 200],
  ],
  [1230, 380]
);

/** The track of the first activity: two segments with a GPS gap between, estimated along streets. */
export const TRACK: Track = {
  points: [
    ...firstPart.map(([lon, lat], i): Track['points'][number] => [lon, lat, 1_761_113_520_000 + i * 15_000, 0, 6]),
    ...secondPart.map(([lon, lat], i): Track['points'][number] => [lon, lat, 1_761_114_000_000 + i * 15_000, 1, 8]),
  ],
};

export const DETAIL: ActivityDetail = {
  ...ACTIVITIES[0],
  bbox: null,
  splits: [
    { km: 1, movingS: 335 },
    { km: 2, movingS: 340 },
    { km: 3, movingS: 330 },
    { km: 4, movingS: 338 },
    { km: 5, movingS: 336 },
  ],
  resumedSegments: null,
  gapRoutes: [
    {
      afterSegment: 0,
      distanceM: 240,
      movingS: 85,
      coords: [firstPart[firstPart.length - 1], [SQUARE[0] + 1180 / M_LON, SQUARE[1] + 470 / M_LAT], secondPart[0]],
    },
  ],
  renamedAt: null,
  gapsCheckedAt: '2026-10-22T07:00:00Z',
};

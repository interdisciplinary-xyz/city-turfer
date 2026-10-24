// Seeds backed-up activities for the history E2E the way a phone backup does: the backup consent
// (`PUT /v1/me/consents/{purpose}`), then `PUT /v1/activities/{id}` with a track and, for GPS gaps,
// `PUT /v1/activities/{id}/gap-routes`. Sent with the signed-in browser's own session cookie
// (`context.request` shares the cookie jar) and the CSRF headers the API asks of the website.
// The tracks are synthetic lines starting at Gdańsk's Long Market (a public square), never a trace.
import { randomBytes } from 'node:crypto';

import { type APIRequestContext, expect } from '@playwright/test';

import type { ActivitySummary, ActivityType, ActivityUpload, GapRoute, TrackPoint } from '../../src/api/schema';
import { CLIENT_HEADER } from './constants';

/** Długi Targ (Long Market), Gdańsk: [lon, lat] of a public square, where every made-up route starts. */
export const LONG_MARKET: readonly [number, number] = [18.6532, 54.3487];

/** The backup policy version the app sends today (apps/mobile/src/constants/api.ts). */
export const POLICY_VERSION = '2026-10';

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LONG_MARKET[1] * Math.PI) / 180);

/** One leg of a made-up route: `metres` towards `bearing` (0 = north, 90 = east). */
export type Leg = { metres: number; bearing: number };

export type SyntheticTrack = {
  /** Start time (epoch ms). */
  startMs: number;
  speedMps: number;
  /** One entry per segment; between segments the track jumps `gapM` east after `gapS` (a GPS gap). */
  segments: Leg[][];
  gapM?: number;
  gapS?: number;
  /** Start this many metres east and north of the square, so routes differ. */
  offsetM?: [number, number];
};

/** Points every 5 s at a steady speed, with altitude, as `[lon, lat, t, segment, alt]`. */
export function syntheticTrack({
  startMs,
  speedMps,
  segments,
  gapM = 150,
  gapS = 60,
  offsetM = [0, 0],
}: SyntheticTrack): {
  points: TrackPoint[];
  endMs: number;
} {
  const stepS = 5;
  let east = offsetM[0];
  let north = offsetM[1];
  let t = startMs;
  const points: TrackPoint[] = [];
  const at = (segment: number): TrackPoint => [
    Number((LONG_MARKET[0] + east / M_PER_DEG_LON).toFixed(6)),
    Number((LONG_MARKET[1] + north / M_PER_DEG_LAT).toFixed(6)),
    t,
    segment,
    Number((5 + north / 200).toFixed(1)),
  ];
  segments.forEach((legs, segment) => {
    if (segment > 0) {
      east += gapM;
      t += gapS * 1000;
    }
    points.push(at(segment));
    for (const { metres, bearing } of legs) {
      const steps = Math.max(1, Math.round(metres / (speedMps * stepS)));
      const rad = (bearing * Math.PI) / 180;
      for (let i = 0; i < steps; i++) {
        east += (Math.sin(rad) * metres) / steps;
        north += (Math.cos(rad) * metres) / steps;
        t += stepS * 1000;
        points.push(at(segment));
      }
    }
  });
  return { points, endMs: t };
}

export type SeedApi = {
  grant: (purpose: 'cloud-sync' | 'apple-health-in-cloud-sync', granted?: boolean) => Promise<void>;
  upload: (id: string, upload: ActivityUpload) => Promise<ActivitySummary>;
  gapRoutes: (id: string, routes: GapRoute[]) => Promise<ActivitySummary>;
  /** Deleted on the phone: the backup keeps a tombstone, and the detail answers 410. */
  remove: (id: string) => Promise<void>;
};

/** The API calls a phone backup makes, through the site's `/api/v1` route with this browser's cookie. */
export function seedApi(request: APIRequestContext, baseURL: string): SeedApi {
  const headers = { [CLIENT_HEADER]: 'web/e2e', Origin: baseURL };
  return {
    async grant(purpose, granted = true) {
      const response = await request.put(`${baseURL}/api/v1/me/consents/${purpose}`, {
        headers,
        data: { granted, policyVersion: POLICY_VERSION },
      });
      expect(response.status(), `consent ${purpose}`).toBe(200);
    },
    async upload(id, upload) {
      const response = await request.put(`${baseURL}/api/v1/activities/${id}`, { headers, data: upload });
      expect(response.status(), `upload ${id}`).toBe(201);
      return (await response.json()) as ActivitySummary;
    },
    async gapRoutes(id, routes) {
      const response = await request.put(`${baseURL}/api/v1/activities/${id}/gap-routes`, {
        headers,
        data: { checkedAt: new Date().toISOString(), routes },
      });
      expect(response.status(), `gap routes ${id}`).toBe(200);
      return (await response.json()) as ActivitySummary;
    },
    async remove(id) {
      const response = await request.delete(`${baseURL}/api/v1/activities/${id}`, { headers });
      expect(response.status(), `delete ${id}`).toBe(204);
    },
  };
}

/** A phone-style id (`hk-…` for Apple Health imports, as the API requires). */
export function activityId(prefix = 'e2e'): string {
  return `${prefix}-${randomBytes(6).toString('hex')}`;
}

/** An upload of a synthetic track: `type`, name and start, in Warsaw time like a Polish phone. */
export function upload({
  type,
  name,
  startMs,
  source = 'recording',
  segments,
  offsetM,
}: {
  type: ActivityType;
  name: string;
  startMs: number;
  source?: ActivityUpload['source'];
  segments?: Leg[][];
  offsetM?: [number, number];
}): ActivityUpload {
  const speedMps = type === 'walk' ? 1.4 : type === 'run' ? 3 : 6;
  const metres = type === 'cycle' ? 3200 : type === 'run' ? 2200 : 1200;
  const track = syntheticTrack({
    startMs,
    speedMps,
    offsetM,
    segments: segments ?? [
      [
        { metres: metres / 2, bearing: 90 },
        { metres: metres / 4, bearing: 0 },
        { metres: metres / 4, bearing: 300 },
      ],
    ],
  });
  return {
    type,
    name,
    source,
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(track.endMs).toISOString(),
    timeZone: 'Europe/Warsaw',
    resumedSegments: null,
    track: { points: track.points },
  };
}

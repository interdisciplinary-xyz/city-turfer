import type {
  ActivityRecord,
  ChangeRecord,
  ConsentRecord,
  GapRoutesRecord,
  HomeCityRecord,
  UserRecord,
} from '../backup/model';
import { cityViewOf } from '../backup/use-cases';

/** Records of the backup → the JSON of the contract (ISO 8601 UTC times, totals incl. gap routes). */

export const iso = (ms: number) => new Date(ms).toISOString();

/** `Date.parse` of a validated ISO 8601 UTC string. */
export const ms = (isoString: string) => Date.parse(isoString);

export const userDto = (u: UserRecord) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName ?? u.id,
  createdAt: iso(u.createdAt ?? 0),
});

export const consentListDto = (items: ConsentRecord[]) => ({
  items: items.map((c) => ({ purpose: c.purpose, granted: c.granted, policyVersion: c.policyVersion, at: iso(c.at) })),
});

export function activitySummaryDto(a: ActivityRecord) {
  const s = a.summary;
  return {
    id: a.id,
    type: a.type,
    name: a.name,
    source: a.source,
    startedAt: iso(a.startedAt),
    endedAt: iso(a.endedAt),
    timeZone: a.timeZone,
    distanceM: s.distanceM + a.estimatedDistanceM,
    estimatedDistanceM: a.estimatedDistanceM,
    movingS: s.movingS + a.estimatedMovingS,
    elapsedS: s.elapsedS,
    elevationGainM: s.elevationGainM,
    preview: s.preview,
    pointCount: s.pointCount,
    trackHash: a.trackHash,
    version: a.version,
    updatedAt: iso(a.updatedAt),
    coreVersion: s.coreVersion,
  };
}

export const activityDetailDto = (a: ActivityRecord, gapRoutes: GapRoutesRecord | null) => ({
  ...activitySummaryDto(a),
  bbox: a.summary.bbox,
  splits: a.summary.splits,
  resumedSegments: a.resumedSegments,
  gapRoutes: gapRoutes?.routes ?? [],
  renamedAt: a.renamedAt === null ? null : iso(a.renamedAt),
  gapsCheckedAt: gapRoutes ? iso(gapRoutes.checkedAt) : null,
});

/** The feed's view of an activity: no preview or numbers. */
export const activityFeedDto = (a: ActivityRecord) => ({
  id: a.id,
  type: a.type,
  source: a.source,
  name: a.name,
  startedAt: iso(a.startedAt),
  version: a.version,
  trackHash: a.trackHash,
  updatedAt: iso(a.updatedAt),
});

export const homeCityDto = (h: HomeCityRecord | null) => ({
  city: h ? cityViewOf(h.cityId) : null,
  chosenAt: h ? iso(h.chosenAt) : null,
});

export function changeDto(change: ChangeRecord) {
  switch (change.kind) {
    case 'activity':
      return {
        type: 'activity.upserted' as const,
        changedAt: iso(change.activity.updatedAt),
        activity: activityFeedDto(change.activity),
      };
    case 'tombstone':
      return {
        type: 'activity.deleted' as const,
        changedAt: iso(change.tombstone.deletedAt),
        activityId: change.tombstone.activityId,
        deletedAt: iso(change.tombstone.deletedAt),
      };
    case 'home-city':
      return {
        type: 'home-city.chosen' as const,
        changedAt: iso(change.homeCity.recordedAt),
        cityId: change.homeCity.cityId,
        chosenAt: iso(change.homeCity.chosenAt),
      };
  }
}

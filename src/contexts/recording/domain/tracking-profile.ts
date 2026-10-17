import { ELEV_HYSTERESIS_M, MOVING_SPEED_MPS } from '@/constants/tracking';
import { type ActivityType } from '@/shared-kernel';

/**
 * Per-type tuning. Filter thresholds must stay in sync with
 * tools/lib/geo.mjs PROFILES (the reference oracle).
 */
export interface TrackingProfile {
  readonly type: ActivityType;
  readonly distanceIntervalM: number;
  readonly timeIntervalMs: number;
  readonly maxAccuracyM: number;
  readonly maxSpeedMps: number;
  readonly minStepM: number;
  readonly movingSpeedMps: number;
  readonly autoPauseAfterS: number;
  readonly elevHysteresisM: number;
}

const shared = (type: ActivityType) => ({
  type,
  movingSpeedMps: MOVING_SPEED_MPS[type],
  elevHysteresisM: ELEV_HYSTERESIS_M[type],
});

const PROFILES: Record<ActivityType, TrackingProfile> = {
  walk: {
    ...shared('walk'),
    distanceIntervalM: 3,
    timeIntervalMs: 2000,
    maxAccuracyM: 25,
    maxSpeedMps: 4,
    minStepM: 3,
    autoPauseAfterS: 15,
  },
  run: {
    ...shared('run'),
    distanceIntervalM: 4,
    timeIntervalMs: 1000,
    maxAccuracyM: 25,
    maxSpeedMps: 8,
    minStepM: 4,
    autoPauseAfterS: 10,
  },
  cycle: {
    ...shared('cycle'),
    distanceIntervalM: 6,
    timeIntervalMs: 1000,
    maxAccuracyM: 30,
    maxSpeedMps: 25,
    minStepM: 6,
    autoPauseAfterS: 8,
  },
};

export const trackingProfileFor = (type: ActivityType): TrackingProfile => PROFILES[type];

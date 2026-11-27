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
  /**
   * Record screen only (never saved, not in the oracle): how long the live moving-time clock may
   * run on, on the phone's clock, after a moving fix arrives. It must cover one accepted-fix
   * interval at the slowest pace that still counts as moving, minStepM / movingSpeedMps, or the
   * clock holds and then jumps between fixes. Longer only costs overshoot at a stop, which the
   * shown value absorbs by holding still until moving time catches up.
   */
  readonly liveRunOnS: number;
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
    // 3 m / 0.5 m/s. Also covers Android's fused cadence (2 s and 3 m: ~4 s at 1.4 m/s, ~6 s
    // below 0.75 m/s) and iOS, which ignores timeIntervalMs and accepts every minStepM.
    liveRunOnS: 6,
  },
  run: {
    ...shared('run'),
    distanceIntervalM: 4,
    timeIntervalMs: 1000,
    maxAccuracyM: 25,
    maxSpeedMps: 8,
    minStepM: 4,
    autoPauseAfterS: 10,
    liveRunOnS: 4, // 4 m / 1.0 m/s
  },
  cycle: {
    ...shared('cycle'),
    distanceIntervalM: 6,
    timeIntervalMs: 1000,
    maxAccuracyM: 30,
    maxSpeedMps: 25,
    minStepM: 6,
    autoPauseAfterS: 8,
    liveRunOnS: 4, // 6 m / 1.5 m/s
  },
};

export const trackingProfileFor = (type: ActivityType): TrackingProfile => PROFILES[type];

import { DomainError } from './errors';

export const ACTIVITY_TYPES = ['walk', 'run', 'cycle'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function activityTypeOf(value: string): ActivityType {
  if ((ACTIVITY_TYPES as readonly string[]).includes(value)) return value as ActivityType;
  throw new DomainError('activity-type.unknown', value);
}

/** Walk and run are measured in pace (time per km); cycle in speed (km/h). */
export const usesPace = (type: ActivityType) => type !== 'cycle';

/** Speed (m/s) at or above which time counts as moving. Shared by Recording and Activity Log. */
export const MOVING_SPEED_MPS: Record<ActivityType, number> = { walk: 0.5, run: 1.0, cycle: 1.5 };
export const ELEV_HYSTERESIS_M: Record<ActivityType, number> = { walk: 3, run: 3, cycle: 5 };

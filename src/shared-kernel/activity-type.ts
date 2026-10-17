import { ACTIVITY_TYPES, type ActivityTypeName } from '@/constants/activity';

import { DomainError } from './errors';

export type ActivityType = ActivityTypeName;

export function activityTypeOf(value: string): ActivityType {
  if ((ACTIVITY_TYPES as readonly string[]).includes(value)) return value as ActivityType;
  throw new DomainError('activity-type.unknown', value);
}

/** Walk and run are measured in pace (time per km); cycle in speed (km/h). */
export const usesPace = (type: ActivityType) => type !== 'cycle';

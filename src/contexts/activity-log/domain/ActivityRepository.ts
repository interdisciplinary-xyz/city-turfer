import type { TrackPoint } from '@/shared-kernel';

import type { ActivityListItem } from '../contract';
import type { Activity } from './Activity';

export interface ActivityRepository {
  exists(id: string): Promise<boolean>;
  get(id: string): Promise<Activity | null>;
  /** Atomic: activity + (on first save) its track + pulled events → outbox. */
  save(activity: Activity, track?: readonly TrackPoint[]): Promise<void>;
  /** Atomic: delete activity + its track + ActivityDeleted → outbox. */
  delete(activity: Activity): Promise<void>;
  list(limit: number, beforeStartedAt?: number): Promise<ActivityListItem[]>;
  trackOf(id: string): Promise<TrackPoint[]>;
}

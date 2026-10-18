import type { ActivityType } from '@/shared-kernel';

export interface TrackLine {
  id: string;
  type: ActivityType;
  coordinates: [number, number][];
}

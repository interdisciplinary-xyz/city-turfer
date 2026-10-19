import type { ActivityType } from '@/shared-kernel';

import type { CityView } from '../contract';

export interface TrackLine {
  id: string;
  type: ActivityType;
  coordinates: [number, number][];
}

export interface TurfMapViewProps {
  tracks: TrackLine[];
  /** `undefined` while loading (the camera waits), `null` when no Home City is chosen. */
  homeCity: CityView | null | undefined;
  /** Opens the city picker (the screen owns navigation). */
  onPickCity?: () => void;
}

/** Room for the summary card at the top when fitting tracks or a city. */
export const FIT_PADDING = { top: 180, bottom: 60, left: 40, right: 40 };

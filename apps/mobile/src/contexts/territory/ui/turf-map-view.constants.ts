import type { ActivityType } from '@/shared-kernel';

import type { CityView } from '../contract';

export interface TrackLine {
  id: string;
  type: ActivityType;
  coordinates: [number, number][];
}

export interface TurfMapViewProps {
  tracks: TrackLine[];
  /** Loaded before mounting (the camera's initial view is fixed at mount); null when none. */
  homeCity: CityView | null;
  /** Whether the Turf tab is on screen: a newly chosen city is flown to when it next is. */
  focused: boolean;
  /** Opens the city picker (the screen owns navigation). */
  onPickCity?: () => void;
  /** Opens the Districts modal (the screen owns navigation); shown with a Home City. */
  onOpenDistricts?: () => void;
}

/** Room for the summary card at the top when fitting tracks or a city. */
export const FIT_PADDING = { top: 180, bottom: 60, left: 40, right: 40 };

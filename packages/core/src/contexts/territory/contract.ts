// Published language of the Territory context (types only).
import type { ActivityType, DomainEvent } from '../../shared-kernel';

export interface TurfClaimed extends DomainEvent<'TurfClaimed'> {
  activityId: string;
  cellCount: number;
  newCellCount: number;
  newAreaM2: number;
}
export interface TurfReleased extends DomainEvent<'TurfReleased'> {
  activityId: string;
}

/** The Turfer chose (or cleared, `cityId: null`) their Home City. Carries no coordinates. */
export interface HomeCityChosen extends DomainEvent<'HomeCityChosen'> {
  cityId: string | null;
  /** When the Turfer made the choice (epoch ms). Absent on events written before v0.9.0: `at`. */
  chosenAt?: number;
}

/** The Turfer's last Home City decision (`cityId: null`: cleared) and when it was made (epoch ms). */
export interface HomeCityChoice {
  cityId: string | null;
  chosenAt: number;
}

/** A catalogue city as screens and maps see it. */
export interface CityView {
  id: string;
  name: string;
  country: string;
  center: [number, number]; // [lon, lat]
  /** [west, south, east, north]: what a map shows when it opens on this city. */
  bounds: [number, number, number, number];
}

export type StrengthTier = 'faint' | 'glowing' | 'strong' | 'blazing';

export interface TurfCellView {
  id: string;
  strength: number;
  tier: StrengthTier;
  visits: number;
  centroid: [number, number]; // [lon, lat]
  ring?: [number, number][]; // closed polygon ring [lon, lat], only at detail zoom
}

export interface TurfSummaryView {
  cellCount: number;
  areaKm2: number;
  strongCells: number;
  newThisWeekKm2: number;
  newThisMonthKm2: number;
  byType: Record<ActivityType, number>; // cells touched per type
}

export interface ClaimView {
  activityId: string;
  cellCount: number;
  newCellCount: number;
  newAreaKm2: number;
  cells: { id: string; isNew: boolean; ring: [number, number][] }[];
}

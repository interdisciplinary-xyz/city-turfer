// Published language of the Territory context (types only).
import type { ActivityType, DomainEvent } from '@/shared-kernel';

export interface TurfClaimed extends DomainEvent<'TurfClaimed'> {
  activityId: string;
  cellCount: number;
  newCellCount: number;
  newAreaM2: number;
}
export interface TurfReleased extends DomainEvent<'TurfReleased'> {
  activityId: string;
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

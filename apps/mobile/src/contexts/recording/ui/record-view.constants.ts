import type { ReactNode } from 'react';

import { ON_TIER, TIER_COLOR } from '@/constants/colors';
import type { BoundingBox } from '@/shared-kernel';

/** The Home City as the Record map needs it (handed in by the screen: Recording never imports Territory). */
export type RecordCity = { id: string; name: string; center: [number, number] };

/** What the Record map shows: bounds ([west, south, east, north]) and zoom. */
export type RecordMapView = { bbox: BoundingBox; zoom: number };

/** The turf toggle on the map (Territory's turf is handed in by the screen as `mapOverlay`). */
export type RecordTurfToggle = { shown: boolean; onToggle: () => void };

export type RecordViewProps = {
  onFinished: (activityId: string) => void;
  /** Where the map starts before the first fix, and the name on the city chip. Null: none chosen. */
  city?: RecordCity | null;
  /** Opens the city picker from the chip at the top (shown before a recording starts). */
  onPickCity?: () => void;
  /** Whether the Record tab is on screen: a newly chosen city is shown when it next is. */
  focused?: boolean;
  /**
   * Map layers mounted after the live track (the screen passes the Turfer's turf here). They should
   * use `beforeId={LIVE_TRACK_BOTTOM_LAYER}` to sit under it, and stay mounted (empty) when hidden.
   */
  mapOverlay?: ReactNode;
  /** Called whenever the map settles on a new view, so the overlay can load what's on screen. */
  onViewChange?: (view: RecordMapView) => void;
  /** Shows the turf toggle chip (top right), before and during a recording. */
  turf?: RecordTurfToggle;
};

/** The live track's lowest layer: overlays go under it with `beforeId`. */
export const LIVE_TRACK_BOTTOM_LAYER = 'live-track-gap';

/** Zoom for showing a whole city on the Record map. */
export const CITY_ZOOM = 13;

/** How long the Stop button must be held before the recording finishes. */
export const HOLD_MS = 900;

export const STATUS_BANNER: Record<string, { text: string; color: string; textColor: string }> = {
  acquiring: { text: 'Waiting for GPS…', color: '#5C6577', textColor: '#FFFFFF' },
  paused: { text: 'Paused', color: TIER_COLOR.strong, textColor: ON_TIER.strong },
  autoPaused: { text: 'Auto-paused — start moving to resume', color: TIER_COLOR.faint, textColor: ON_TIER.faint },
};

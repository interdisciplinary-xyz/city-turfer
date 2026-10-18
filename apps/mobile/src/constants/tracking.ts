import type { ActivityTypeName } from './activity';

/** A gap longer than this (no fixes at all) starts a new segment: never draw, measure or claim across it. */
export const MAX_FIX_GAP_MS = 45_000;

/** Speed (m/s) at or above which time counts as moving. Shared by Recording and Activity Log. */
export const MOVING_SPEED_MPS: Record<ActivityTypeName, number> = { walk: 0.5, run: 1.0, cycle: 1.5 };
export const ELEV_HYSTERESIS_M: Record<ActivityTypeName, number> = { walk: 3, run: 3, cycle: 5 };

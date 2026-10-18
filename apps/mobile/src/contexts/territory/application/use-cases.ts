import { ACTIVITY_TYPES } from '@/constants/activity';
import { DETAIL_ZOOM } from '@/constants/map';
import { type ActivityType, type BoundingBox, type Clock, trackFromPoints, type TrackPoint } from '@/shared-kernel';

import type { ClaimView, TurfCellView, TurfSummaryView } from '../contract';
import type { CellGrid, CellId } from '../domain/cell-grid';
import { Claim } from '../domain/claim';
import { isStrong, strengthOf, tierOf } from '../domain/strength';
import type { CellRow, TerritoryRepository } from '../domain/territory-repository';

/** Port: Activity Log's open-host track query. */
export interface ActivityTrackSource {
  trackOf(activityId: string): Promise<TrackPoint[]>;
}

export interface TerritoryDeps {
  repo: TerritoryRepository;
  grid: CellGrid;
  tracks: ActivityTrackSource;
  clock: Clock;
  afterCommit: () => void;
}

/** Handles ActivityRecorded. Idempotent (claim id = activity id). */
export class ClaimTurfFromActivity {
  constructor(private readonly d: TerritoryDeps) {}
  async execute(e: { activityId: string; activityType: ActivityType; startedAt: number }): Promise<void> {
    if (await this.d.repo.claimExists(e.activityId)) {
      return;
    }
    const points = await this.d.tracks.trackOf(e.activityId);
    if (points.length === 0) {
      return;
    }
    const now = this.d.clock.now();
    const claim = Claim.fromTrack(
      { activityId: e.activityId, type: e.activityType, startedAt: e.startedAt },
      trackFromPoints(points),
      this.d.grid,
      now
    );
    const existing = await this.d.repo.existingCells(claim.state.cells);
    const newCells = new Set([...claim.state.cells].filter((c) => !existing.has(c)));
    const centroids = new Map<CellId, { lat: number; lon: number }>();
    const areas = new Map<CellId, number>();
    for (const c of newCells) {
      centroids.set(c, this.d.grid.centroid(c));
      areas.set(c, this.d.grid.areaM2(c));
    }
    claim.claimed(newCells, this.d.grid, now);
    await this.d.repo.saveClaim(claim, newCells, centroids, areas);
    this.d.afterCommit();
  }
}

/** Handles ActivityDeleted — the only way turf shrinks. */
export class ReleaseTurfOfActivity {
  constructor(private readonly d: TerritoryDeps) {}
  async execute(activityId: string): Promise<void> {
    if (await this.d.repo.releaseClaim(activityId, this.d.clock.now())) {
      this.d.afterCommit();
    }
  }
}

/**
 * Handles ActivityTrackCorrected: the claim is rebuilt from the corrected track.
 * Idempotent and crash-safe: release is a no-op without a claim, claim is a
 * no-op once it exists.
 */
export class ReclaimTurfOfActivity {
  constructor(private readonly d: TerritoryDeps) {}
  async execute(e: { activityId: string; activityType: ActivityType; startedAt: number }): Promise<void> {
    await this.d.repo.releaseClaim(e.activityId, this.d.clock.now());
    await new ClaimTurfFromActivity(this.d).execute(e);
  }
}

const visitsFor = (r: CellRow, types: readonly ActivityType[]) => types.reduce((s, t) => s + r[t], 0);
const ring = (grid: CellGrid, c: CellId): [number, number][] => {
  const b = grid.boundary(c).map((p) => [p.lon, p.lat] as [number, number]);
  return [...b, b[0]];
};

const MAX_FEATURES = 5000;

export class GetTurfInViewport {
  constructor(private readonly d: TerritoryDeps) {}
  async execute(
    bbox: BoundingBox,
    zoom: number,
    types: readonly ActivityType[] = ACTIVITY_TYPES
  ): Promise<TurfCellView[]> {
    const [w, s, e, n] = bbox;
    const padX = (e - w) * 0.1;
    const padY = (n - s) * 0.1;
    const rows = await this.d.repo.cellsIn([w - padX, s - padY, e + padX, n + padY], types);
    const cells = rows.map((r) => ({ r, visits: visitsFor(r, types) })).filter((x) => x.visits > 0);

    if (cells.length <= MAX_FEATURES) {
      // Full detail; polygons only when zoomed in (heatmap uses centroids).
      const withRings = zoom >= DETAIL_ZOOM;
      return cells.map(({ r, visits }) => {
        const strength = strengthOf(visits);
        return {
          id: r.cell,
          strength,
          tier: tierOf(strength),
          visits,
          centroid: [r.lon, r.lat],
          ring: withRings ? ring(this.d.grid, r.cell) : undefined,
        };
      });
    }
    // Too many cells for the viewport: aggregate to coarse cells, keeping the strongest member.
    const coarse = new Map<CellId, TurfCellView>();
    for (const { r, visits } of cells) {
      const key = this.d.grid.coarse(r.cell);
      const strength = strengthOf(visits);
      const prev = coarse.get(key);
      if (!prev || prev.strength < strength) {
        const c = this.d.grid.centroid(key);
        coarse.set(key, { id: key, strength, tier: tierOf(strength), visits, centroid: [c.lon, c.lat] });
      }
    }
    return [...coarse.values()];
  }
}

export class GetTurfSummary {
  constructor(private readonly d: TerritoryDeps) {}
  async execute(): Promise<TurfSummaryView> {
    const rows = await this.d.repo.allCells();
    const now = this.d.clock.now();
    let area = 0,
      week = 0,
      month = 0,
      strong = 0;
    const byType = { walk: 0, run: 0, cycle: 0 };
    for (const r of rows) {
      const a = this.d.grid.areaM2(r.cell);
      const visits = r.walk + r.run + r.cycle;
      area += a;
      if (now - r.firstAt <= 7 * 86_400_000) {
        week += a;
      }
      if (now - r.firstAt <= 30 * 86_400_000) {
        month += a;
      }
      if (isStrong(strengthOf(visits))) {
        strong++;
      }
      for (const t of ACTIVITY_TYPES) {
        if (r[t] > 0) {
          byType[t]++;
        }
      }
    }
    return {
      cellCount: rows.length,
      areaKm2: area / 1e6,
      strongCells: strong,
      newThisWeekKm2: week / 1e6,
      newThisMonthKm2: month / 1e6,
      byType,
    };
  }
}

export class GetClaimForActivity {
  constructor(private readonly d: TerritoryDeps) {}
  async execute(activityId: string): Promise<ClaimView | null> {
    const c = await this.d.repo.claimOf(activityId);
    if (!c) {
      return null;
    }
    return {
      activityId,
      cellCount: c.cellCount,
      newCellCount: c.newCellCount,
      newAreaKm2: c.newAreaM2 / 1e6,
      cells: c.cells.map((x) => ({ id: x.cell, isNew: x.isNew, ring: ring(this.d.grid, x.cell) })),
    };
  }
}

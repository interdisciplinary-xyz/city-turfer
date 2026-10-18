import type { TrackPoint } from '@/shared-kernel';

import type { ActivityListItem } from '../contract';
import { Activity, type ActivityState } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';
import { estimatedTotals, type GapRoute } from '../domain/gap-route';

interface Row {
  state: ActivityState;
  track: TrackPoint[];
  routes: GapRoute[];
  checkedAt: number | null;
}

/** Activity Log persistence for application tests: same contract as the SQLite repository. */
export class InMemoryActivityRepository implements ActivityRepository {
  readonly rows = new Map<string, Row>();
  readonly events: unknown[] = [];

  async exists(id: string) {
    return this.rows.has(id);
  }
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? Activity.rehydrate(r.state) : null;
  }
  async save(activity: Activity, track?: readonly TrackPoint[]) {
    const prev = this.rows.get(activity.id);
    this.rows.set(activity.id, {
      state: activity.toState(),
      track: prev?.track ?? [...(track ?? [])],
      routes: prev?.routes ?? [],
      checkedAt: prev?.checkedAt ?? null,
    });
    this.events.push(...activity.pullEvents());
  }
  async delete(activity: Activity) {
    this.rows.delete(activity.id);
    this.events.push(...activity.pullEvents());
  }
  async list(limit: number): Promise<ActivityListItem[]> {
    return [...this.rows.values()].slice(0, limit).map((r) => {
      const est = estimatedTotals(r.routes);
      return {
        id: r.state.id,
        type: r.state.type,
        name: r.state.name,
        startedAt: r.state.startedAt,
        distanceM: r.state.summary.distanceM + est.distanceM,
        movingS: r.state.summary.movingS + est.movingS,
        estimatedDistanceM: est.distanceM,
        preview: [...r.state.preview],
      };
    });
  }
  async trackOf(id: string) {
    return [...(this.rows.get(id)?.track ?? [])];
  }
  async saveCorrection(activity: Activity, track: readonly TrackPoint[]) {
    this.rows.set(activity.id, { state: activity.toState(), track: [...track], routes: [], checkedAt: null });
    this.events.push(...activity.pullEvents());
  }
  async allIds() {
    return [...this.rows.values()].sort((a, b) => a.state.startedAt - b.state.startedAt).map((r) => r.state.id);
  }
  async idsWithUncheckedGaps() {
    return [...this.rows.values()]
      .filter((r) => r.checkedAt == null)
      .sort((a, b) => a.state.startedAt - b.state.startedAt)
      .map((r) => r.state.id);
  }
  async typeOf(id: string) {
    return this.rows.get(id)?.state.type ?? null;
  }
  async saveGapRoutes(id: string, routes: readonly GapRoute[], now: number) {
    const r = this.rows.get(id)!;
    this.rows.set(id, { ...r, routes: [...routes], checkedAt: now });
    this.events.push({ type: 'ActivityDistanceEstimated', activityId: id });
  }
  async gapRoutesOf(id: string) {
    return [...(this.rows.get(id)?.routes ?? [])];
  }
}

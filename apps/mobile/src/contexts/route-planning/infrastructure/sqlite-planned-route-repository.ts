import type { Database } from '@/platform/database';
import type { ActivityType, GeoPoint } from '@/shared-kernel';

import { PlannedRoute, type RouteLeg } from '../domain/planned-route';
import type { PlannedRouteRepository } from '../domain/planned-route-repository';

type LonLat = [number, number];
interface Row {
  type: ActivityType;
  waypoints: string;
  legs: string;
  show_on_record: number;
  created_at: number;
  updated_at: number;
}

const toLonLat = (p: GeoPoint): LonLat => [p.lon, p.lat];
const toPoint = ([lon, lat]: LonLat): GeoPoint => ({ lat, lon });

/**
 * Table rp_planned_routes (migration 16): the one active Planned Route, a single row. Waypoints and
 * leg paths as JSON `[lon, lat]`. Personal data: never in the cloud backup, never logged.
 */
export class SqlitePlannedRouteRepository implements PlannedRouteRepository {
  constructor(private readonly db: Database) {}

  async active(): Promise<PlannedRoute | null> {
    const r = await this.db.first<Row>(
      'SELECT type, waypoints, legs, show_on_record, created_at, updated_at FROM rp_planned_routes WHERE id = 1'
    );
    if (!r) {
      return null;
    }
    try {
      const legs = (JSON.parse(r.legs) as { path: LonLat[]; snapped: boolean }[]).map((l): RouteLeg => ({
        path: l.path.map(toPoint),
        snapped: l.snapped === true,
      }));
      return PlannedRoute.rehydrate({
        type: r.type,
        waypoints: (JSON.parse(r.waypoints) as LonLat[]).map(toPoint),
        legs,
        showOnRecord: r.show_on_record === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    } catch {
      return null; // unreadable draft: start a new one (the next save replaces the row)
    }
  }

  async save(route: PlannedRoute): Promise<void> {
    const s = route.toState();
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO rp_planned_routes (id, type, waypoints, legs, show_on_record, created_at, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET type = excluded.type, waypoints = excluded.waypoints, legs = excluded.legs,
           show_on_record = excluded.show_on_record, created_at = excluded.created_at, updated_at = excluded.updated_at`,
        [
          s.type,
          JSON.stringify(s.waypoints.map(toLonLat)),
          JSON.stringify(s.legs.map((l) => ({ path: l.path.map(toLonLat), snapped: l.snapped }))),
          s.showOnRecord ? 1 : 0,
          s.createdAt,
          s.updatedAt,
        ]
      );
    });
  }
}

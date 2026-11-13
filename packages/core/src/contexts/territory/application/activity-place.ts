import type { ActivityPlaceView } from '../contract';
import { CITY_CATALOG } from '../domain/city-catalog';
import type { DistrictCatalog } from '../domain/district-catalog';
import { placeOf } from '../domain/place';
import { toCityView } from './home-city';
import type { ActivityTrackSource } from './use-cases';

export interface ActivityPlaceDeps {
  tracks: ActivityTrackSource;
  districts: DistrictCatalog;
}

const NOWHERE: ActivityPlaceView = { city: null, district: null };

/**
 * Where an activity happened (share card label): its catalogue city and, where bundled, the district
 * holding most of its Track Points (`placeOf`). An unknown activity or one without Track Points is
 * nowhere. Reads the track through Activity Log's open-host track query, as claims do; keeps nothing.
 */
export class GetActivityPlace {
  constructor(private readonly d: ActivityPlaceDeps) {}
  async execute(activityId: string): Promise<ActivityPlaceView> {
    const points = await this.d.tracks.trackOf(activityId);
    const place = placeOf(points, CITY_CATALOG, this.d.districts);
    if (!place) {
      return NOWHERE;
    }
    return { city: toCityView(place.city), district: place.district?.name ?? null };
  }
}

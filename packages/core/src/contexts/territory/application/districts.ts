import { ACTIVITY_TYPES } from '../../../constants/activity';
import type { DistrictCoverageView, DistrictsView } from '../contract';
import type { CellGrid } from '../domain/cell-grid';
import { cityById } from '../domain/city-catalog';
import { assignToDistricts, boundsOf, districtAreaM2, districtBounds, type LonLat } from '../domain/district';
import type { DistrictCatalog } from '../domain/district-catalog';
import type { HomeCityRepository } from '../domain/home-city-repository';
import type { TerritoryRepository } from '../domain/territory-repository';
import { toCityView } from './home-city';

export interface DistrictsDeps {
  repo: TerritoryRepository;
  grid: CellGrid;
  homeCities: HomeCityRepository;
  districts: DistrictCatalog;
}

/**
 * The Home City split into districts, with the turf held in each: the area of the Turfer's cells
 * whose centre lies in the district. Each cell counts in one district at most.
 */
export class GetDistrictCoverage {
  constructor(private readonly d: DistrictsDeps) {}
  async execute(): Promise<DistrictsView> {
    const id = await this.d.homeCities.homeCityId();
    const city = id ? cityById(id) : null;
    if (!city) {
      return { status: 'no-city' };
    }
    const cityView = toCityView(city);
    const districts = this.d.districts.districtsOf(city.id);
    if (districts.length === 0) {
      return { status: 'no-data', city: cityView };
    }
    const all = boundsOf(districts.flatMap((x) => x.polygons.map((p) => p[0])));
    const cells = await this.d.repo.cellsIn(all, ACTIVITY_TYPES);
    const owner = assignToDistricts(
      districts,
      cells.map((c): LonLat => [c.lon, c.lat])
    );
    const covered = new Array<number>(districts.length).fill(0);
    const counts = new Array<number>(districts.length).fill(0);
    owner.forEach((i, k) => {
      if (i >= 0) {
        covered[i] += this.d.grid.areaM2(cells[k].cell);
        counts[i]++;
      }
    });
    const views: DistrictCoverageView[] = districts.map((x, i) => {
      const areaKm2 = districtAreaM2(x) / 1e6;
      const coveredKm2 = covered[i] / 1e6;
      return {
        id: x.id,
        name: x.name,
        areaKm2,
        coveredKm2,
        cellCount: counts[i],
        share: areaKm2 > 0 ? Math.min(1, coveredKm2 / areaKm2) : 0,
        bounds: [...districtBounds(x)] as [number, number, number, number],
        polygons: x.polygons.map((p) => p.map((ring) => ring.map(([lon, lat]): [number, number] => [lon, lat]))),
      };
    });
    views.sort((a, b) => b.coveredKm2 - a.coveredKm2 || a.name.localeCompare(b.name));
    return {
      status: 'ready',
      city: cityView,
      bounds: [...all] as [number, number, number, number],
      coveredKm2: covered.reduce((a, b) => a + b, 0) / 1e6,
      districts: views,
    };
  }
}

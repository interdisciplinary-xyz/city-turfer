import { ACTIVITY_TYPES } from '../../../constants/activity';
import type { DistrictCoverageView, DistrictsView } from '../contract';
import type { CellGrid } from '../domain/cell-grid';
import { cityById } from '../domain/city-catalog';
import { boundsOf, type District, districtAreaM2, districtBounds, DistrictIndex } from '../domain/district';
import type { DistrictCatalog } from '../domain/district-catalog';
import type { HomeCityRepository } from '../domain/home-city-repository';
import type { TerritoryRepository } from '../domain/territory-repository';
import { toCityView } from './home-city';

export interface DistrictsDeps {
  repo: TerritoryRepository;
  grid: CellGrid;
  homeCities: HomeCityRepository;
  districts: DistrictCatalog;
  /** Waits between chunks of cells so a big history never holds the JS thread long (tests: none). */
  yieldToUi?: () => Promise<void>;
}

/** Cells handled between two yields: a few milliseconds of work on a phone. */
export const DISTRICT_CHUNK = 2_000;

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** What never changes for a city's districts, built once per catalogue answer. */
interface Prepared {
  districts: readonly District[];
  index: DistrictIndex;
  bounds: [number, number, number, number];
  areaKm2: number[];
}
/**
 * Only the last city's (an LRU of one): the screen reads the Home City again and again, and a city
 * left behind frees its index (about 1 MB) instead of holding it for the life of the app.
 */
let prepared: Prepared | null = null;

function prepare(districts: readonly District[]): Prepared {
  if (prepared?.districts !== districts) {
    prepared = {
      districts,
      index: new DistrictIndex(districts),
      bounds: [...boundsOf(districts.flatMap((x) => x.polygons.map((q) => q[0])))] as [number, number, number, number],
      areaKm2: districts.map((x) => districtAreaM2(x) / 1e6),
    };
  }
  return prepared;
}

export interface DistrictCoverageOptions {
  /**
   * Whether the caller still wants this answer (false once a newer read has started or the screen
   * has gone). Asked after the cells are loaded and at every yield; on false the read stops and
   * rejects with ReadSuperseded, so a burst of re-reads never holds more than one scan's cells.
   */
  isCurrent?: () => boolean;
}

/** A read stopped because its caller no longer wanted the answer (not a failure to show). */
export class ReadSuperseded extends Error {
  constructor() {
    super('district read superseded');
    this.name = 'ReadSuperseded';
  }
}

/**
 * The Home City split into districts, with the turf held in each: the area of the Turfer's cells
 * whose centre lies in the district. Each cell counts in one district at most. The districts' index
 * and areas are built once per city; the cells are handled in chunks of DISTRICT_CHUNK with a yield
 * between them, so a history of tens of thousands of cells never blocks the UI in one go. A read
 * whose caller has moved on (`isCurrent`) stops early, so superseded reads don't pile up.
 */
export class GetDistrictCoverage {
  constructor(private readonly d: DistrictsDeps) {}
  async execute(opts: DistrictCoverageOptions = {}): Promise<DistrictsView> {
    const stillWanted = () => {
      if (opts.isCurrent && !opts.isCurrent()) {
        throw new ReadSuperseded();
      }
    };
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
    const { index, bounds: all, areaKm2 } = prepare(districts);
    stillWanted();
    const cells = await this.d.repo.cellsIn(all, ACTIVITY_TYPES);
    stillWanted();
    const covered = new Array<number>(districts.length).fill(0);
    const counts = new Array<number>(districts.length).fill(0);
    const pause = this.d.yieldToUi ?? nextTick;
    for (let k = 0; k < cells.length; k++) {
      if (k > 0 && k % DISTRICT_CHUNK === 0) {
        await pause();
        stillWanted();
      }
      const i = index.locate(cells[k].lon, cells[k].lat);
      if (i >= 0) {
        covered[i] += this.d.grid.areaM2(cells[k].cell);
        counts[i]++;
      }
    }
    const views: DistrictCoverageView[] = districts.map((x, i) => {
      const coveredKm2 = covered[i] / 1e6;
      return {
        id: x.id,
        name: x.name,
        areaKm2: areaKm2[i],
        coveredKm2,
        cellCount: counts[i],
        share: areaKm2[i] > 0 ? Math.min(1, coveredKm2 / areaKm2[i]) : 0,
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

import { type ActivityType, type FormattedQuantity, usesPace } from '@/shared-kernel';

/*
 * The Share Card (docs/plans/share-photo-2026-11-11.md, "Rules (v1)"): what a card says about one
 * Activity. Pure: formatting and words are injected, so this layer imports no React or i18n.
 */

/** Stats top left (as the reference card) or in the bottom third. */
export type ShareLayout = 'top' | 'bottom';

/** The place line: Off (default), the city, or "district, city". */
export type PlaceChoice = 'off' | 'city' | 'district';

export interface ShareCardOptions {
  layout: ShareLayout;
  /** "+N new turf cells"; shown only when the activity claimed new cells. */
  showTurf: boolean;
  place: PlaceChoice;
}

/** The facts a card needs from an Activity (no track, no coordinates). */
export interface ShareCardActivity {
  type: ActivityType;
  name: string;
  startedAt: number;
  distanceM: number;
  movingS: number;
}

/** Where the activity happened, as display names (Territory's place query); nulls when unknown. */
export interface ShareCardPlace {
  city: string | null;
  district: string | null;
}

export type StatLabelKey = 'distance' | 'movingTime' | 'pace' | 'speed';

/** The activity screen's formatters and the card's messages, in the app language. */
export interface ShareCardFormat {
  distance(metres: number): FormattedQuantity;
  duration(seconds: number): string;
  paceOrSpeed(type: ActivityType, distanceM: number, seconds: number): FormattedQuantity;
  /** Calendar day, e.g. "9 Nov 2026". */
  day(ms: number): string;
  /** Clock time, e.g. "17:36". */
  time(ms: number): string;
  label(key: StatLabelKey): string;
  turfCells(count: number): string;
  when(day: string, time: string): string;
  placeDistrict(district: string, city: string): string;
}

export interface ShareCardStat {
  label: string;
  value: string;
  unit?: string;
}

export interface ShareCardContent {
  title: string;
  type: ActivityType;
  stats: ShareCardStat[];
  /** Null when hidden (no new cells, toggled off, or the claim not known yet). */
  turfCells: string | null;
  when: string;
  /** Null when Off or no city is known. */
  place: string | null;
  layout: ShareLayout;
}

/** Place choices to offer: none beyond Off without a known city (both City and District hidden). */
export function placeChoices(place: ShareCardPlace | null | undefined): PlaceChoice[] {
  return place?.city ? ['off', 'city', 'district'] : ['off'];
}

/** The place line for a choice: District falls back to City without district data; nothing without a city. */
export function placeLine(
  choice: PlaceChoice,
  place: ShareCardPlace | null | undefined,
  format: Pick<ShareCardFormat, 'placeDistrict'>
): string | null {
  if (choice === 'off' || !place?.city) {
    return null;
  }
  if (choice === 'district' && place.district) {
    return format.placeDistrict(place.district, place.city);
  }
  return place.city;
}

/**
 * The card's strings: distance, moving time and pace (walk, run) or speed (cycle), exactly as the
 * activity screen formats them; the turf line only when the claim added cells and it is on.
 */
export function shareCardContent(
  activity: ShareCardActivity,
  newCells: number | null,
  place: ShareCardPlace | null | undefined,
  options: ShareCardOptions,
  format: ShareCardFormat
): ShareCardContent {
  const d = format.distance(activity.distanceM);
  const pace = format.paceOrSpeed(activity.type, activity.distanceM, activity.movingS);
  return {
    title: activity.name,
    type: activity.type,
    stats: [
      { label: format.label('distance'), value: d.value, unit: d.unit },
      { label: format.label('movingTime'), value: format.duration(activity.movingS) },
      { label: format.label(usesPace(activity.type) ? 'pace' : 'speed'), value: pace.value, unit: pace.unit },
    ],
    turfCells: options.showTurf && newCells != null && newCells > 0 ? format.turfCells(newCells) : null,
    when: format.when(format.day(activity.startedAt), format.time(activity.startedAt)),
    place: placeLine(options.place, place, format),
    layout: options.layout,
  };
}

/** The turf toggle only makes sense when the activity claimed new cells. */
export const hasNewTurf = (newCells: number | null): boolean => newCells != null && newCells > 0;

import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo, useMemo } from 'react';

import { DARK, TYPE_COLOR } from '@/constants/colors';

import type { PlannedRouteView } from '../contract';
import { NO_FEATURES } from './planned-route-layer.constants';
import {
  PLANNED_ROUTE_BOTTOM_LAYER,
  type PlannedRouteGuideProps,
  type PlannedRouteLayersProps,
} from './planner-view.constants';

/** Every leg as a LineString, `snapped` 1 (along streets) or 0 (straight, drawn dashed). */
function legFeatures(route: PlannedRouteView | null): GeoJSON.FeatureCollection {
  if (!route) {
    return NO_FEATURES;
  }
  return {
    type: 'FeatureCollection',
    features: route.legs
      .filter((l) => l.coordinates.length > 1)
      .map((l) => ({
        type: 'Feature',
        properties: { snapped: l.snapped ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: l.coordinates },
      })),
  };
}

/**
 * The planner's drawing of the Planned Route: the new cells it would add outlined (an estimate, so a
 * thin outline, never a turf fill), the legs (along streets solid, straight dashed) over a dark
 * casing, and the Waypoints as dots with the start larger and ringed. Taps not yet saved show
 * faintly. Every layer stays mounted (empty data) so the order holds; the lowest is
 * `PLANNED_ROUTE_BOTTOM_LAYER`, for the turf to go under. Memoised: GeoJSON sources re-serialise
 * their data whenever they re-render.
 */
export const PlannedRouteLayers = memo(function PlannedRouteLayers({ route, pending }: PlannedRouteLayersProps) {
  const color = TYPE_COLOR[route?.type ?? 'walk'];
  const cells = useMemo<GeoJSON.FeatureCollection>(
    () =>
      route
        ? {
            type: 'FeatureCollection',
            features: route.newCells.map((c) => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: [c.ring] },
            })),
          }
        : NO_FEATURES,
    [route]
  );
  const legs = useMemo(() => legFeatures(route), [route]);
  const dots = useMemo<GeoJSON.FeatureCollection>(() => {
    const w = route?.waypoints ?? [];
    // A closed loop repeats the start at the end: one dot for both.
    const shown = route?.isLoop ? w.slice(0, -1) : w;
    return {
      type: 'FeatureCollection',
      features: [
        ...shown.map((p, i) => ({
          type: 'Feature' as const,
          properties: { start: i === 0 ? 1 : 0, pending: 0 },
          geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        })),
        ...pending.map((p) => ({
          type: 'Feature' as const,
          properties: { start: shown.length === 0 ? 1 : 0, pending: 1 },
          geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        })),
      ],
    };
  }, [route, pending]);

  return (
    <>
      <GeoJSONSource id='planned-cells' data={cells}>
        <Layer
          id={PLANNED_ROUTE_BOTTOM_LAYER}
          type='line'
          paint={{ 'line-color': color, 'line-width': 1.2, 'line-opacity': 0.8 }}
        />
      </GeoJSONSource>
      <GeoJSONSource id='planned-legs' data={legs}>
        <Layer
          id='planned-legs-casing'
          type='line'
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': DARK.bg, 'line-width': 8, 'line-opacity': 0.6 }}
        />
        <Layer
          id='planned-legs-straight'
          type='line'
          filter={['==', ['get', 'snapped'], 0] as never}
          paint={{ 'line-color': color, 'line-width': 4, 'line-dasharray': [1.5, 1.5] }}
        />
        <Layer
          id='planned-legs-snapped'
          type='line'
          filter={['==', ['get', 'snapped'], 1] as never}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': color, 'line-width': 5 }}
        />
      </GeoJSONSource>
      <GeoJSONSource id='planned-waypoints' data={dots}>
        <Layer
          id='planned-waypoints-dot'
          type='circle'
          paint={{
            'circle-radius': ['case', ['==', ['get', 'start'], 1], 9, 6] as never,
            'circle-color': color,
            'circle-opacity': ['case', ['==', ['get', 'pending'], 1], 0.45, 1] as never,
            'circle-stroke-color': ['case', ['==', ['get', 'start'], 1], DARK.text, DARK.bg] as never,
            'circle-stroke-width': ['case', ['==', ['get', 'start'], 1], 3, 2] as never,
          }}
        />
      </GeoJSONSource>
    </>
  );
});

/**
 * The Planned Route as a guide on the Record map: a light line under the live track (`beforeId`),
 * solid along streets and dashed where straight, the start ringed. Light rather than the activity
 * colour, so it never reads as the track being recorded. Empty (still mounted) when not shown.
 */
export const PlannedRouteGuide = memo(function PlannedRouteGuide({ route, beforeId }: PlannedRouteGuideProps) {
  const shown = route?.showOnRecord ? route : null;
  const legs = useMemo(() => legFeatures(shown), [shown]);
  const start = useMemo<GeoJSON.FeatureCollection>(() => {
    const first = shown?.waypoints[0];
    return first
      ? {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [first.lon, first.lat] } },
          ],
        }
      : NO_FEATURES;
  }, [shown]);
  return (
    <>
      <GeoJSONSource id='planned-guide' data={legs}>
        <Layer
          id='planned-guide-casing'
          type='line'
          beforeId={beforeId}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': DARK.bg, 'line-width': 9, 'line-opacity': 0.5 }}
        />
        <Layer
          id='planned-guide-straight'
          type='line'
          beforeId={beforeId}
          filter={['==', ['get', 'snapped'], 0] as never}
          paint={{ 'line-color': DARK.text, 'line-width': 4, 'line-opacity': 0.7, 'line-dasharray': [1.5, 1.5] }}
        />
        <Layer
          id='planned-guide-line'
          type='line'
          beforeId={beforeId}
          filter={['==', ['get', 'snapped'], 1] as never}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': DARK.text, 'line-width': 5, 'line-opacity': 0.7 }}
        />
      </GeoJSONSource>
      <GeoJSONSource id='planned-guide-start' data={start}>
        <Layer
          id='planned-guide-start-dot'
          type='circle'
          beforeId={beforeId}
          paint={{
            'circle-radius': 7,
            'circle-color': DARK.bg,
            'circle-stroke-color': DARK.text,
            'circle-stroke-width': 3,
          }}
        />
      </GeoJSONSource>
    </>
  );
});

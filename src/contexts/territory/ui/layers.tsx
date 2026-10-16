import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { TIER_COLOR } from '@/ui-kit/theme';

import { DETAIL_ZOOM } from '../application/use-cases';
import type { ClaimView, TurfCellView } from '../contract';

const tierColor = [
  'match',
  ['get', 'tier'],
  'faint',
  TIER_COLOR.faint,
  'glowing',
  TIER_COLOR.glowing,
  'strong',
  TIER_COLOR.strong,
  TIER_COLOR.blazing,
] as const;

/** Heatmap glow (zoomed out) + strength-coloured hexagons with a halo (zoomed in). */
export function TurfLayers({ cells }: { cells: TurfCellView[] }) {
  const points = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: cells.map((c) => ({
        type: 'Feature',
        properties: { strength: c.strength },
        geometry: { type: 'Point', coordinates: c.centroid },
      })),
    }),
    [cells]
  );
  const polygons = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: cells
        .filter((c) => c.ring)
        .map((c) => ({
          type: 'Feature',
          properties: { strength: c.strength, tier: c.tier },
          geometry: { type: 'Polygon', coordinates: [c.ring!] },
        })),
    }),
    [cells]
  );

  return (
    <>
      <GeoJSONSource id='turf-points' data={points}>
        <Layer
          id='turf-heat'
          type='heatmap'
          maxzoom={DETAIL_ZOOM + 1}
          paint={{
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'strength'], 0, 0.15, 1, 1],
            // Dense centroids add up fast: keep intensity low so a single visit stays violet
            // and only repeated streets saturate to white.
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.12, 11, 0.22, 14, 0.5],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 11, 9, 14, 22],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.95, DETAIL_ZOOM + 1, 0],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(0,0,0,0)',
              0.15,
              'rgba(123,47,247,0.55)',
              0.4,
              TIER_COLOR.glowing,
              0.7,
              TIER_COLOR.strong,
              1,
              TIER_COLOR.blazing,
            ],
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id='turf-cells' data={polygons}>
        <Layer
          id='turf-halo'
          type='line'
          minzoom={DETAIL_ZOOM}
          paint={{
            'line-color': tierColor as never,
            'line-width': 10,
            'line-blur': 8,
            'line-opacity': ['*', 0.7, ['get', 'strength']],
          }}
        />
        <Layer
          id='turf-fill'
          type='fill'
          minzoom={DETAIL_ZOOM}
          paint={{ 'fill-color': tierColor as never, 'fill-opacity': ['+', 0.18, ['*', 0.55, ['get', 'strength']]] }}
        />
      </GeoJSONSource>
    </>
  );
}

/** The cells one activity claimed; new turf highlighted. */
export function ClaimLayers({ claim }: { claim: ClaimView | null }) {
  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (claim?.cells ?? []).map((c) => ({
        type: 'Feature',
        properties: { isNew: c.isNew ? 1 : 0 },
        geometry: { type: 'Polygon', coordinates: [c.ring] },
      })),
    }),
    [claim]
  );
  return (
    <GeoJSONSource id={`claim-${claim?.activityId ?? 'none'}`} data={data}>
      <Layer
        id='claim-fill'
        type='fill'
        paint={{
          'fill-color': ['case', ['==', ['get', 'isNew'], 1], TIER_COLOR.glowing, TIER_COLOR.faint],
          'fill-opacity': 0.35,
        }}
      />
    </GeoJSONSource>
  );
}

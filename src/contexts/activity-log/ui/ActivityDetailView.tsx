import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { type ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Card, Stat } from '@/ui-kit/components';
import { formatDate, formatDistance, formatDuration, formatPaceOrSpeed } from '@/ui-kit/format';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT, TYPE_COLOR, usePalette } from '@/ui-kit/theme';

import type { ActivityDetail } from '../contract';

export function ActivityDetailView({
  a,
  mapOverlay,
  children,
}: {
  a: ActivityDetail;
  mapOverlay?: ReactNode;
  children?: ReactNode;
}) {
  const p = usePalette();
  const scheme = useColorScheme();
  const lines = useMemo<GeoJSON.FeatureCollection>(() => {
    const segs = new globalThis.Map<number, [number, number][]>();
    for (const pt of a.track) segs.set(pt.segment, [...(segs.get(pt.segment) ?? []), [pt.lon, pt.lat]]);
    return {
      type: 'FeatureCollection',
      features: [...segs.values()]
        .filter((c) => c.length > 1)
        .map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
    };
  }, [a.track]);
  const ends = useMemo<GeoJSON.FeatureCollection>(() => {
    const f = a.track[0];
    const l = a.track[a.track.length - 1];
    return {
      type: 'FeatureCollection',
      features:
        f && l
          ? [
              {
                type: 'Feature',
                properties: { kind: 'start' },
                geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
              },
              {
                type: 'Feature',
                properties: { kind: 'end' },
                geometry: { type: 'Point', coordinates: [l.lon, l.lat] },
              },
            ]
          : [],
    };
  }, [a.track]);
  const d = formatDistance(a.distanceM);
  const pace = formatPaceOrSpeed(a.type, a.distanceM, a.movingS);
  const color = TYPE_COLOR[a.type];

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.map}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={scheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
          logo={false}
          compass={false}
        >
          {a.bbox && (
            <Camera initialViewState={{ bounds: a.bbox, padding: { top: 40, bottom: 40, left: 40, right: 40 } }} />
          )}
          {mapOverlay}
          <GeoJSONSource id='activity-track' data={lines}>
            <Layer
              id='activity-track-line'
              type='line'
              paint={{ 'line-color': color, 'line-width': 4 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
          <GeoJSONSource id='activity-ends' data={ends}>
            <Layer
              id='activity-ends-dot'
              type='circle'
              paint={{
                'circle-radius': 7,
                'circle-color': ['match', ['get', 'kind'], 'start', '#2BD48B', '#E5484D'] as never,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
              }}
            />
          </GeoJSONSource>
        </Map>
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={[s.date, { color: p.muted }]}>{formatDate(a.startedAt)}</Text>
        <Card>
          <View style={s.row}>
            <Stat label='Distance' value={d.value} unit={d.unit} />
            <Stat label='Moving time' value={formatDuration(a.movingS)} />
            <Stat label={a.type === 'cycle' ? 'Avg speed' : 'Avg pace'} value={pace.value} unit={pace.unit} />
          </View>
          <View style={[s.row, { marginTop: 14 }]}>
            <Stat label='Elapsed' value={formatDuration(a.elapsedS)} />
            <Stat
              label='Elevation ≈'
              value={a.elevGainM != null ? `+${a.elevGainM}` : '—'}
              unit={a.elevGainM != null ? 'm' : undefined}
            />
          </View>
        </Card>
        {children}
        {a.splits.length > 0 && (
          <Card>
            <Text style={[s.h, { color: p.text }]}>Splits</Text>
            {a.splits.map((sp) => {
              const v = formatPaceOrSpeed(a.type, 1000, sp.seconds);
              return (
                <View key={sp.km} style={s.split}>
                  <Text style={{ color: p.muted, width: 50 }}>km {sp.km}</Text>
                  <Text style={{ color: p.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {v.value} {v.unit}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  map: { height: 320 },
  row: { flexDirection: 'row' },
  date: { fontSize: 14, fontWeight: '600' },
  h: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  split: { flexDirection: 'row', paddingVertical: 4 },
});

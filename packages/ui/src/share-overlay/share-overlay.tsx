import { DARK, DISPLAY_CASE, DISPLAY_TRACKING, FONT_FAMILY, FONT_WEIGHT, TIER_COLOR } from '@cityturfer/brand';
import { useState } from 'react';
import { Image, type LayoutChangeEvent, PixelRatio, Text, type TextStyle, View } from 'react-native';

import {
  BOTTOM_BLOCK_GUESS,
  BOTTOM_PLATEAU_MAX,
  CANVAS,
  FADE_BAND,
  FADE_BANDS,
  GAP,
  ICON_SIZE,
  MIN_FONT_SCALE,
  SAFE,
  SCRIM_MARGIN,
  SCRIM_OPACITY,
  SHADOW,
  SHADOW_ALPHA,
  type ShareOverlayProps,
  type ShareOverlayStat,
  STATS_PLATEAU_MIN,
  STATS_TOP,
  TITLE_MAX_LINES,
  TITLE_MAX_WIDTH,
  TURF_DOT,
  TYPE,
  WORDMARK,
} from './share-overlay.constants';

const px = (units: number, k: number) => PixelRatio.roundToNearestPixel(units * k);

/** Every text on the card: the app's text colour with a soft night halo (not an outline). */
const ink = (k: number): TextStyle => ({
  color: DARK.text,
  textShadowColor: `${DARK.bg}${SHADOW_ALPHA}`,
  textShadowOffset: { width: 0, height: SHADOW.dy * k },
  textShadowRadius: SHADOW.radius * k,
});

const size = ([fontSize, lineHeight]: readonly [number, number], k: number): TextStyle => ({
  fontSize: fontSize * k,
  lineHeight: lineHeight * k,
});

/**
 * A scrim in canvas units: a night plateau from `from` to `to` at 0.6, and a fade of twelve 20-unit
 * bands, each 0.05 lighter, on the side `fade` points to. Plain Views: no gradient library.
 */
function Scrim({ k, from, to, fade }: { k: number; from: number; to: number; fade: 'down' | 'up' }) {
  const band = (top: number, bottom: number, opacity: number, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: px(top, k),
        height: px(bottom, k) - px(top, k),
        backgroundColor: DARK.bg,
        opacity,
      }}
    />
  );
  const bands = Array.from({ length: FADE_BANDS }, (_, i) => {
    const opacity = SCRIM_OPACITY * (1 - (i + 0.5) / FADE_BANDS);
    return fade === 'down'
      ? band(to + i * FADE_BAND, to + (i + 1) * FADE_BAND, opacity, `f${i}`)
      : band(from - (i + 1) * FADE_BAND, from - i * FADE_BAND, opacity, `f${i}`);
  });
  return (
    <View pointerEvents='none' style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {band(from, to, SCRIM_OPACITY, 'plateau')}
      {bands}
    </View>
  );
}

function StatLabel({ text, k, bottom }: { text: string; k: number; bottom?: boolean }) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        ink(k),
        size(bottom ? TYPE.bottomLabel : TYPE.label, k),
        { fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: TYPE.labelTracking * k },
      ]}
    >
      {text}
    </Text>
  );
}

/** Value and unit on one baseline; a long value shrinks (to 0.8) rather than wrap. */
function StatFigure({ stat, k, bottom }: { stat: ShareOverlayStat; k: number; bottom?: boolean }) {
  const numeric: TextStyle = { fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: GAP.labelToValue * k }}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={MIN_FONT_SCALE}
        style={[ink(k), numeric, size(bottom ? TYPE.bottomValue : TYPE.value, k), { flexShrink: 1 }]}
      >
        {stat.value}
      </Text>
      {stat.unit ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[ink(k), numeric, size(bottom ? TYPE.bottomUnit : TYPE.unit, k), { marginLeft: GAP.valueToUnit * k }]}
        >
          {stat.unit}
        </Text>
      ) : null}
    </View>
  );
}

function TurfLine({ text, k }: { text: string; k: number }) {
  const d = TURF_DOT.size * k;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          marginRight: GAP.dotToText * k,
          backgroundColor: TIER_COLOR.glowing,
          shadowColor: TIER_COLOR.glowing,
          shadowOpacity: TURF_DOT.opacity,
          shadowRadius: TURF_DOT.glow * k,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          ink(k),
          size(TYPE.turf, k),
          { fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'], flexShrink: 1 },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/** Type icon + title (at most two lines), then `when` and the place, each on its own line. */
function TitleBlock({
  title,
  when,
  place,
  k,
  renderTypeIcon,
}: Pick<ShareOverlayProps, 'title' | 'when' | 'place' | 'renderTypeIcon'> & { k: number }) {
  const firstLine = TYPE.title[1] * k;
  const meta: TextStyle[] = [ink(k), size(TYPE.meta, k), { fontWeight: FONT_WEIGHT.semibold }];
  return (
    <View style={{ maxWidth: TITLE_MAX_WIDTH * k }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: ICON_SIZE * k,
            height: firstLine,
            marginRight: GAP.iconToTitle * k,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderTypeIcon(ICON_SIZE * k, DARK.text)}
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={TITLE_MAX_LINES}
          ellipsizeMode='tail'
          style={[
            ink(k),
            size(TYPE.title, k),
            {
              flexShrink: 1,
              fontFamily: FONT_FAMILY.display,
              textTransform: DISPLAY_CASE,
              letterSpacing: DISPLAY_TRACKING * 3 * k,
            },
          ]}
        >
          {title}
        </Text>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[...meta, { marginTop: GAP.titleToMeta * k }]}>
        {when}
      </Text>
      {place ? (
        <Text allowFontScaling={false} numberOfLines={1} style={meta}>
          {place}
        </Text>
      ) : null}
    </View>
  );
}

/** Height of the top layout's stats stack (label, gap, value per stat; turf line under it), in units. */
function statsStackBottom(count: number, turf: boolean): number {
  const stat = TYPE.label[1] + GAP.labelToValue + TYPE.value[1];
  const stats = count * stat + Math.max(0, count - 1) * GAP.betweenStats;
  return STATS_TOP + stats + (turf ? GAP.toTurf + TYPE.turf[1] : 0);
}

/**
 * The share card: the Turfer's photo, cover-cropped to 9:16, with an activity's stats, name, date,
 * optional place and the CityTurfer wordmark over night scrims (brand-designer's card design,
 * docs/plans/share-photo-2026-11-11.md). Laid out on a 1080 × 1920 canvas and scaled by
 * `width / 1080` (no transform, so text stays crisp in a capture). Strings arrive formatted.
 */
export function ShareOverlay({
  width,
  layout,
  photo,
  stats,
  turfLine,
  title,
  when,
  place,
  wordmark,
  renderTypeIcon,
  onPhotoLoad,
  accessibilityLabel,
  testID,
}: ShareOverlayProps) {
  const k = width / CANVAS.width;
  const height = px(CANVAS.height, k);
  // The bottom block grows upwards (two-line title, place line); its scrim follows once measured.
  const [blockUnits, setBlockUnits] = useState<number | null>(null);
  const block = blockUnits ?? BOTTOM_BLOCK_GUESS[layout];
  const onBlockLayout = (e: LayoutChangeEvent) => setBlockUnits(e.nativeEvent.layout.height / k);
  const blockTop = SAFE.bottom - block;
  const bottomPlateau = Math.min(BOTTOM_PLATEAU_MAX[layout], blockTop - SCRIM_MARGIN);
  const side = SAFE.side * k;
  const bottomEdge = (CANVAS.height - SAFE.bottom) * k;

  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={{ width, height, overflow: 'hidden', backgroundColor: DARK.bg }}
    >
      {photo ? (
        <Image
          source={photo}
          resizeMode='cover'
          accessible={false}
          onLoad={onPhotoLoad}
          onError={onPhotoLoad}
          style={{ position: 'absolute', left: 0, top: 0, width, height }}
        />
      ) : null}

      {layout === 'top' ? (
        <Scrim
          k={k}
          from={0}
          to={Math.max(STATS_PLATEAU_MIN, statsStackBottom(stats.length, !!turfLine) + SCRIM_MARGIN)}
          fade='down'
        />
      ) : null}
      <Scrim k={k} from={bottomPlateau} to={CANVAS.height} fade='up' />

      {layout === 'top' ? (
        <>
          <View style={{ position: 'absolute', left: side, right: side, top: STATS_TOP * k }}>
            {stats.map((st, i) => (
              <View key={st.label} style={{ marginTop: i === 0 ? 0 : GAP.betweenStats * k }}>
                <StatLabel text={st.label} k={k} />
                <StatFigure stat={st} k={k} />
              </View>
            ))}
            {turfLine ? (
              <View style={{ marginTop: GAP.toTurf * k }}>
                <TurfLine text={turfLine} k={k} />
              </View>
            ) : null}
          </View>
          <View onLayout={onBlockLayout} style={{ position: 'absolute', left: side, bottom: bottomEdge }}>
            <TitleBlock title={title} when={when} place={place} k={k} renderTypeIcon={renderTypeIcon} />
          </View>
        </>
      ) : (
        <View onLayout={onBlockLayout} style={{ position: 'absolute', left: side, right: side, bottom: bottomEdge }}>
          <View style={{ flexDirection: 'row' }}>
            {stats.map((st, i) => (
              <View key={st.label} style={{ flexShrink: 1, marginLeft: i === 0 ? 0 : GAP.bottomBetweenStats * k }}>
                <StatLabel text={st.label} k={k} bottom />
                <StatFigure stat={st} k={k} bottom />
              </View>
            ))}
          </View>
          {turfLine ? (
            <View style={{ marginTop: GAP.bottomToTurf * k }}>
              <TurfLine text={turfLine} k={k} />
            </View>
          ) : null}
          <View style={{ marginTop: GAP.bottomToTitle * k }}>
            <TitleBlock title={title} when={when} place={place} k={k} renderTypeIcon={renderTypeIcon} />
          </View>
        </View>
      )}

      {/* Logo rule: no shadow, no tint, always on a scrim plateau. */}
      <Image
        source={wordmark}
        accessible={false}
        resizeMode='contain'
        style={{
          position: 'absolute',
          right: side,
          bottom: (CANVAS.height - WORDMARK.bottom) * k,
          width: WORDMARK.width * k,
          height: WORDMARK.height * k,
        }}
      />
    </View>
  );
}

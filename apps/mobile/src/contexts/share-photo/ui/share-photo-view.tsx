import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { ShareOverlay } from '@cityturfer/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useLocale, useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { ActivitySymbol } from '@/ui-kit/symbol';
import { usePalette } from '@/ui-kit/theme';

import {
  hasNewTurf,
  type PickedPhoto,
  type PlaceChoice,
  placeChoices,
  shareCardContent,
  type ShareLayout,
} from '../index';
import { PhotoSourceSheet } from './photo-source-sheet';
import { shareCardFormat } from './share-card-format';
import { sharePhoto } from './share-photo-api';
import {
  CAPTURE_WIDTH_PX,
  CONTROLS_HEIGHT,
  LAYOUT_KEY,
  MIN_PREVIEW_WIDTH,
  OFFSCREEN_X,
  PLACE_KEY,
  PLACE_TEST_ID,
  type SharePhotoViewProps,
  STORY_ASPECT,
  WORDMARK,
} from './share-photo-view.constants';
import { usePhotoPicker } from './use-photo-picker';

/**
 * The share screen: the live card (photo + ShareOverlay) and its controls (layout, turf line,
 * place), Change photo and Share. Share captures a second, hidden copy of the card laid out at
 * exactly 1080 px wide (no resampling, so the JPEG stays sharp) and opens the share sheet;
 * the files are deleted afterwards, and the photo when the screen closes. Nothing is saved.
 */
export function SharePhotoView({ activity, newCells, place, photo: initial }: SharePhotoViewProps) {
  const p = usePalette();
  const t = useT('share');
  const locale = useLocale();
  const { width: winW, height: winH } = useWindowDimensions();
  const [photo, setPhoto] = useState<PickedPhoto | null>(initial);
  const [layout, setLayout] = useState<ShareLayout>('top');
  const [showTurf, setShowTurf] = useState(true);
  const [placeChoice, setPlaceChoice] = useState<PlaceChoice>('off');
  const [busy, setBusy] = useState(false);
  const card = useRef<View>(null);
  // The hidden copy's photo has loaded (per uri): Share waits for it, so the capture is never blank.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);

  // The photo file is ours (the picker's cache copy): delete it when replaced or when leaving.
  const current = useRef(photo?.uri ?? null);
  useEffect(
    () => () => {
      if (current.current) {
        void sharePhoto.discardPhoto.execute(current.current);
      }
    },
    []
  );
  const replacePhoto = useCallback((next: PickedPhoto) => {
    const old = current.current;
    current.current = next.uri;
    setPhoto(next);
    if (old && old !== next.uri) {
      void sharePhoto.discardPhoto.execute(old);
    }
  }, []);
  const picker = usePhotoPicker(replacePhoto);

  const format = useMemo(() => shareCardFormat(locale), [locale]);
  const content = useMemo(
    () => shareCardContent(activity, newCells, place, { layout, showTurf, place: placeChoice }, format),
    [activity, newCells, place, layout, showTurf, placeChoice, format]
  );
  const choices = placeChoices(place);
  const previewW = Math.round(
    Math.min(winW - 2 * SPACE.lg, Math.max(MIN_PREVIEW_WIDTH, (winH - CONTROLS_HEIGHT) * STORY_ASPECT))
  );
  const photoSource = useMemo(() => (photo ? { uri: photo.uri } : undefined), [photo]);
  const ready = !!photo && loadedUri === photo.uri;
  const onCaptureLoad = useCallback(() => setLoadedUri(photo?.uri ?? null), [photo]);
  const renderTypeIcon = useCallback(
    (size: number, color: string) => <ActivitySymbol type={content.type} size={size} color={color} />,
    [content.type]
  );

  const share = async () => {
    if (busy || !ready || !card.current) {
      return;
    }
    setBusy(true);
    const r = await sharePhoto.share.execute(card);
    setBusy(false);
    if (r.kind === 'render-failed') {
      Alert.alert(t('screen.title'), t('error.render'));
    } else if (r.kind === 'share-failed') {
      Alert.alert(t('screen.title'), t('error.share'));
    }
  };

  const layoutLabel = t(LAYOUT_KEY[layout]);
  return (
    <View style={s.fill}>
      {/* The captured card: off screen, hidden from touch and screen readers, 1080 px wide. */}
      <View
        ref={card}
        collapsable={false}
        pointerEvents='none'
        accessibilityElementsHidden
        importantForAccessibility='no-hide-descendants'
        style={s.offscreen}
      >
        <ShareOverlay
          width={CAPTURE_WIDTH_PX / PixelRatio.get()}
          layout={content.layout}
          photo={photoSource}
          stats={content.stats}
          turfLine={content.turfCells ?? undefined}
          title={content.title}
          when={content.when}
          place={content.place ?? undefined}
          wordmark={WORDMARK}
          renderTypeIcon={renderTypeIcon}
          onPhotoLoad={onCaptureLoad}
        />
      </View>
      <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={s.content}>
        <View style={s.center}>
          <View style={[s.preview, { borderColor: p.border }]}>
            <ShareOverlay
              testID='share-card-preview'
              width={previewW}
              layout={content.layout}
              photo={photoSource}
              stats={content.stats}
              turfLine={content.turfCells ?? undefined}
              title={content.title}
              when={content.when}
              place={content.place ?? undefined}
              wordmark={WORDMARK}
              renderTypeIcon={renderTypeIcon}
              accessibilityLabel={t('screen.preview', { title: content.title, when: content.when })}
            />
          </View>
        </View>

        <Pressable
          testID='share-toggle-layout'
          accessibilityRole='button'
          accessibilityLabel={`${t('screen.layout')}, ${layoutLabel}`}
          onPress={() => setLayout(layout === 'top' ? 'bottom' : 'top')}
          style={[s.row, { backgroundColor: p.card }]}
        >
          <Text style={[s.rowLabel, { color: p.text }]}>{t('screen.layout')}</Text>
          <View style={[s.chip, { backgroundColor: p.border }]}>
            <Text style={[s.chipText, { color: p.text }]}>{layoutLabel}</Text>
          </View>
        </Pressable>

        {hasNewTurf(newCells) && (
          <View style={[s.row, { backgroundColor: p.card }]}>
            <Text style={[s.rowLabel, { color: p.text }]}>{t('screen.turf')}</Text>
            <Switch
              testID='share-toggle-turf'
              accessibilityRole='switch'
              accessibilityLabel={t('screen.turf')}
              accessibilityState={{ checked: showTurf }}
              value={showTurf}
              onValueChange={setShowTurf}
              trackColor={{ true: ACCENT }}
            />
          </View>
        )}

        {choices.length > 1 && (
          <View style={[s.row, { backgroundColor: p.card }]}>
            <Text style={[s.rowLabel, { color: p.text }]}>{t('screen.place')}</Text>
            <View style={s.segments} accessibilityRole='radiogroup'>
              {choices.map((c) => {
                const on = c === placeChoice;
                return (
                  <Pressable
                    key={c}
                    testID={PLACE_TEST_ID[c]}
                    accessibilityRole='radio'
                    accessibilityLabel={`${t('screen.place')}, ${t(PLACE_KEY[c])}`}
                    accessibilityState={{ checked: on }}
                    onPress={() => setPlaceChoice(c)}
                    hitSlop={SPACE.xs}
                    style={[s.chip, { backgroundColor: on ? ACCENT : p.border }]}
                  >
                    <Text style={[s.chipText, { color: on ? p.onAccent : p.text }]}>{t(PLACE_KEY[c])}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Button
          testID='share-photo-send'
          label={t('screen.share')}
          color={ACCENT}
          busy={busy}
          disabled={!ready}
          onPress={() => void share()}
        />
        {busy && (
          <Text accessibilityLiveRegion='polite' style={[s.note, { color: p.muted }]}>
            {t('screen.rendering')}
          </Text>
        )}
        <Button
          testID='share-photo-change'
          label={t('screen.change')}
          color={p.card}
          textColor={p.text}
          disabled={busy}
          onPress={picker.open}
        />
        <PhotoSourceSheet picker={picker} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  offscreen: { position: 'absolute', left: OFFSCREEN_X, top: 0 },
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.xxxl },
  center: { alignItems: 'center' },
  preview: { borderRadius: RADIUS.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: {
    minHeight: 56,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  rowLabel: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, flexShrink: 1 },
  segments: { flexDirection: 'row', gap: SPACE.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  chip: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACE.md,
    justifyContent: 'center',
  },
  chipText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  note: { fontSize: FONT_SIZE.caption, textAlign: 'center' },
});

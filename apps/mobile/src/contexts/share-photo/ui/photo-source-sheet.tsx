import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { BACKDROP, type PhotoSourceSheetProps } from './photo-source-sheet.constants';

/**
 * The photo choice (Take photo / Choose from library / Cancel) and, when the camera was refused,
 * the explainer with Open Settings and the library instead. Own sheet, not ActionSheetIOS, so every
 * choice has a testID and the same look on Android.
 */
export function PhotoSourceSheet({ picker }: PhotoSourceSheetProps) {
  const p = usePalette();
  const t = useT('share');
  const insets = useSafeAreaInsets();
  const bottom = { paddingBottom: insets.bottom + SPACE.lg };
  return (
    <>
      <Modal
        visible={picker.sheetVisible}
        transparent
        animationType='slide'
        onRequestClose={picker.close}
        onDismiss={picker.afterDismiss}
      >
        <Pressable
          style={s.backdrop}
          onPress={picker.close}
          accessibilityRole='button'
          accessibilityLabel={t('sheet.cancel')}
          importantForAccessibility='no'
        />
        <View style={[s.sheet, bottom]} pointerEvents='box-none'>
          <Card testID='share-photo-sheet' style={s.card}>
            <Text accessibilityRole='header' style={[s.h, { color: p.text }]}>
              {t('sheet.title')}
            </Text>
            <Button
              testID='share-photo-camera'
              label={t('sheet.camera')}
              color={ACCENT}
              onPress={() => picker.choose('camera')}
            />
            <Button
              testID='share-photo-library'
              label={t('sheet.library')}
              color={p.border}
              textColor={p.text}
              onPress={() => picker.choose('library')}
            />
            <Button
              testID='share-photo-cancel'
              label={t('sheet.cancel')}
              color={p.card}
              textColor={p.text}
              onPress={picker.close}
            />
          </Card>
        </View>
      </Modal>
      <Modal
        visible={picker.deniedVisible}
        transparent
        animationType='fade'
        onRequestClose={picker.close}
        onDismiss={picker.afterDismiss}
      >
        <Pressable
          style={s.backdrop}
          onPress={picker.close}
          accessibilityRole='button'
          accessibilityLabel={t('sheet.cancel')}
          importantForAccessibility='no'
        />
        <View style={[s.sheet, bottom]} pointerEvents='box-none'>
          <Card testID='share-permission' style={s.card}>
            <Text accessibilityRole='header' style={[s.h, { color: p.text }]}>
              {t('permission.title')}
            </Text>
            <Text style={[s.body, { color: p.muted }]}>{t('permission.body')}</Text>
            <Button
              testID='share-permission-settings'
              label={t('permission.settings')}
              color={ACCENT}
              onPress={picker.openSettings}
            />
            <Button
              testID='share-permission-library'
              label={t('permission.library')}
              color={p.border}
              textColor={p.text}
              onPress={() => picker.choose('library')}
            />
            <Button
              testID='share-permission-cancel'
              label={t('sheet.cancel')}
              color={p.card}
              textColor={p.text}
              onPress={picker.close}
            />
          </Card>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: BACKDROP },
  sheet: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: SPACE.lg },
  card: { gap: SPACE.md },
  h: { fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.heavy },
  body: { fontSize: FONT_SIZE.body, lineHeight: 22 },
});

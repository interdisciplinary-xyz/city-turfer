import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DARK } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button } from '@/ui-kit/components';

import type { RoutingConsentSheetProps } from './planner-view.constants';

/**
 * Asked once, after the first tap: may the Waypoints go to the public OpenStreetMap router to follow
 * the streets? Both answers are equal buttons (opt-in, no nudge); "Straight lines" sends nothing and
 * still measures the route. Closing it without an answer (Android back) answers nothing.
 */
export function RoutingConsentSheet({
  visible,
  onFollowStreets,
  onStraightLines,
  onDismiss,
}: RoutingConsentSheetProps) {
  const t = useT('planner');
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        <View
          testID='routing-consent-sheet'
          accessibilityViewIsModal
          style={[s.sheet, { paddingBottom: insets.bottom + SPACE.lg }]}
        >
          <Text accessibilityRole='header' style={s.title}>
            {t('consent.title')}
          </Text>
          <Text style={s.body}>{t('consent.body')}</Text>
          {/* Its own line: iOS doesn't wrap the host name inside the sentence and clips it. */}
          <Text testID='routing-consent-host' style={[s.body, s.host]}>
            {t('consent.host')}
          </Text>
          <Text style={s.small}>{t('consent.privacy')}</Text>
          <View style={s.buttons}>
            <Button testID='routing-consent-follow' label={t('consent.follow')} onPress={onFollowStreets} />
            <Button
              testID='routing-consent-straight'
              label={t('consent.straight')}
              color={DARK.border}
              textColor={DARK.text}
              onPress={onStraightLines}
            />
          </View>
          <Text style={s.small}>{t('consent.straightHint')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Night at 60% (99): the map stays faintly visible behind the question.
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: `${DARK.bg}99` },
  sheet: {
    backgroundColor: DARK.card,
    borderTopLeftRadius: RADIUS.panel,
    borderTopRightRadius: RADIUS.panel,
    padding: SPACE.xl,
    gap: SPACE.md,
  },
  title: { color: DARK.text, fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.heavy },
  body: { color: DARK.text, fontSize: FONT_SIZE.body },
  host: { fontWeight: FONT_WEIGHT.bold },
  small: { color: DARK.muted, fontSize: FONT_SIZE.caption },
  buttons: { gap: SPACE.sm, marginTop: SPACE.xs },
});

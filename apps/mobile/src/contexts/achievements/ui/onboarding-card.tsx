import type { OnboardingProgress, OnboardingStepId } from '@cityturfer/core/achievements';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, FONT_FAMILY, ON_ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { ONBOARDING_STEP_KEY } from './achievement-copy.constants';

/** Dashboard "Getting started" checklist. Each step opens the place where it gets done. */
export function OnboardingCard({
  progress,
  onOpenStep,
  onHide,
}: {
  progress: OnboardingProgress;
  onOpenStep: (id: OnboardingStepId) => void;
  onHide: () => void;
}) {
  const p = usePalette();
  const t = useT('achievements');
  const counts = { done: progress.done, total: progress.total };
  return (
    <Card style={{ gap: 8 }}>
      <View testID='onboarding-card' style={{ gap: 8 }}>
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: p.text }]}>{t('onboarding.title')}</Text>
            <Text
              accessibilityLabel={t('onboarding.progressLabel', counts)}
              style={{ color: ACCENT, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] }}
            >
              {t('onboarding.progress', counts)}
            </Text>
          </View>
          <Pressable
            testID='onboarding-hide'
            onPress={onHide}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel={t('onboarding.hideLabel')}
          >
            <Text style={{ color: p.muted, fontWeight: '700' }}>{t('onboarding.hide')}</Text>
          </Pressable>
        </View>
        <View style={[s.track, { backgroundColor: p.border }]}>
          <View style={[s.fill, { width: `${(progress.done / progress.total) * 100}%` }]} />
        </View>
        {progress.steps.map((step) => {
          const title = t(`onboardingStep.${ONBOARDING_STEP_KEY[step.id]}`);
          return (
            <Pressable
              key={step.id}
              testID={`onboarding-step-${step.id}`}
              onPress={() => onOpenStep(step.id)}
              accessibilityRole='button'
              accessibilityLabel={t('onboarding.stepLabel', { title, done: step.done ? 'yes' : 'no' })}
              style={s.row}
            >
              <View
                style={[
                  s.check,
                  step.done ? { backgroundColor: ACCENT, borderColor: ACCENT } : { borderColor: p.border },
                ]}
              >
                {step.done && <Text style={s.tick}>✓</Text>}
              </View>
              <Text
                style={{
                  flex: 1,
                  color: step.done ? p.muted : p.text,
                  fontWeight: '600',
                  textDecorationLine: step.done ? 'line-through' : 'none',
                }}
              >
                {title}
              </Text>
              <Text style={{ color: p.muted }}>›</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: ACCENT },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: ON_ACCENT, fontWeight: '900', fontSize: 14 },
});

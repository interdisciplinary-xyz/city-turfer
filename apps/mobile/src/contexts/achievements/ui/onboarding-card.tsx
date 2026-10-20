import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, FONT_FAMILY } from '@/constants/colors';
import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import type { OnboardingProgress, OnboardingStepId } from '../domain/onboarding';

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
  return (
    <Card style={{ gap: 8 }}>
      <View testID='onboarding-card' style={{ gap: 8 }}>
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: p.text }]}>Getting started</Text>
            <Text
              accessibilityLabel={`${progress.done} of ${progress.total} steps done`}
              style={{ color: ACCENT, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] }}
            >
              {progress.done} of {progress.total}
            </Text>
          </View>
          <Pressable
            testID='onboarding-hide'
            onPress={onHide}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel='Hide getting started'
          >
            <Text style={{ color: p.muted, fontWeight: '700' }}>Hide</Text>
          </Pressable>
        </View>
        <View style={[s.track, { backgroundColor: p.border }]}>
          <View style={[s.fill, { width: `${(progress.done / progress.total) * 100}%` }]} />
        </View>
        {progress.steps.map((step) => (
          <Pressable
            key={step.id}
            testID={`onboarding-step-${step.id}`}
            onPress={() => onOpenStep(step.id)}
            accessibilityRole='button'
            accessibilityLabel={`${step.title}, ${step.done ? 'done' : 'to do'}`}
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
              {step.title}
            </Text>
            <Text style={{ color: p.muted }}>›</Text>
          </Pressable>
        ))}
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
  tick: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

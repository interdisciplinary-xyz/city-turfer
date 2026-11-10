import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useEffect, useState } from 'react';
import {
  type AccessibilityActionEvent,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { DAILY_GOAL_LIMITS } from '../index';
import { type GoalEditorProps, STEPPER_BUTTON_SIZE } from './goal-card.constants';
import { useDailyGoal, useGoalActions } from './hooks';

const clampGoal = (n: number) => Math.min(DAILY_GOAL_LIMITS.max, Math.max(DAILY_GOAL_LIMITS.min, n));

/**
 * The Daily goal editor (modal `/goal`): a 5-minute stepper (an adjustable element for a screen
 * reader, plus labelled − and + buttons), Save, and Turn off when a goal is on. Changes apply
 * from today; past days keep the goal they had.
 */
export function GoalEditor({ onDone }: GoalEditorProps) {
  const p = usePalette();
  const t = useT('goals');
  const view = useDailyGoal();
  const { set } = useGoalActions();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Start from the goal in force, else the suggestion; once, so a refresh never undoes a step.
  useEffect(() => {
    if (view && minutes == null) {
      setMinutes(view.goalMinutes ?? DAILY_GOAL_LIMITS.suggested);
    }
  }, [view, minutes]);

  if (!view || minutes == null) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  const step = (dir: 1 | -1) =>
    setMinutes((m) => clampGoal((m ?? DAILY_GOAL_LIMITS.suggested) + dir * DAILY_GOAL_LIMITS.step));
  const atMin = minutes <= DAILY_GOAL_LIMITS.min;
  const atMax = minutes >= DAILY_GOAL_LIMITS.max;
  const save = async (value: number | null) => {
    setBusy(true);
    try {
      await set(value);
      onDone();
    } catch {
      // Out of range cannot come from the stepper; stay open so the Turfer can try again.
      setBusy(false);
    }
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') {
      step(1);
    } else if (e.nativeEvent.actionName === 'decrement') {
      step(-1);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.stepper}>
        <Pressable
          testID='goal-minus'
          onPress={() => step(-1)}
          disabled={atMin || busy}
          accessibilityRole='button'
          accessibilityLabel={t('decrease')}
          accessibilityState={{ disabled: atMin || busy }}
          style={({ pressed }) => [
            s.round,
            { borderColor: p.borderControl, backgroundColor: p.card, opacity: atMin ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[s.sign, { color: p.text }]}>−</Text>
        </Pressable>
        <View
          testID='goal-value'
          accessible
          accessibilityRole='adjustable'
          accessibilityLabel={t('title')}
          accessibilityValue={{ text: t('settingValue', { minutes }) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          style={s.value}
        >
          <Text style={[s.figure, { color: p.text }]}>{t('value', { minutes })}</Text>
        </View>
        <Pressable
          testID='goal-plus'
          onPress={() => step(1)}
          disabled={atMax || busy}
          accessibilityRole='button'
          accessibilityLabel={t('increase')}
          accessibilityState={{ disabled: atMax || busy }}
          style={({ pressed }) => [
            s.round,
            { borderColor: p.borderControl, backgroundColor: p.card, opacity: atMax ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[s.sign, { color: p.text }]}>+</Text>
        </Pressable>
      </View>
      <Text style={[s.hint, { color: p.muted }]}>{t('hint', { health: Platform.OS === 'ios' ? 'yes' : 'no' })}</Text>
      <Button testID='goal-save' label={t('save')} busy={busy} onPress={() => void save(minutes)} />
      {view.goalMinutes != null && (
        <Pressable
          testID='goal-off'
          onPress={() => void save(null)}
          disabled={busy}
          accessibilityRole='button'
          accessibilityLabel={t('off')}
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [s.off, { borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[s.offText, { color: p.text }]}>{t('off')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { padding: SPACE.lg, paddingTop: SPACE.xxxl, gap: SPACE.xl },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  round: {
    width: STEPPER_BUTTON_SIZE,
    height: STEPPER_BUTTON_SIZE,
    borderRadius: STEPPER_BUTTON_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: { fontSize: FONT_SIZE.stat, lineHeight: FONT_SIZE.stat + 4, fontWeight: FONT_WEIGHT.bold },
  value: { flex: 1, alignItems: 'center' },
  figure: { fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'], fontSize: FONT_SIZE.hero },
  hint: { textAlign: 'center', fontSize: FONT_SIZE.body },
  off: {
    minHeight: 56,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
});

import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { activityNameProblem } from '@cityturfer/core/activity-log';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import {
  describeLength,
  NAME_PROBLEM_TEXT,
  RENAME_CANCEL,
  RENAME_FAILED,
  RENAME_LABEL,
  RENAME_SAVE,
  RENAME_TITLE,
  type RenameActivityDialogProps,
} from './rename-activity-dialog.constants';

/**
 * Rename an Activity: a small cross-platform dialog (Alert.prompt is iOS-only) with the domain's
 * name rule checked as you type. Saving goes through RenameActivity, so the backup sends it too.
 */
export function RenameActivityDialog({ visible, name, onClose, onSave }: RenameActivityDialogProps) {
  const p = usePalette();
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(name);
      setFailed(false);
    }
  }, [visible, name]);

  const problem = activityNameProblem(draft);
  const unchanged = draft.trim() === name;
  const save = async () => {
    if (problem || saving) {
      return;
    }
    if (unchanged) {
      onClose();
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const message = problem ? NAME_PROBLEM_TEXT[problem] : failed ? RENAME_FAILED : null;

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fill}>
        <Pressable
          style={s.backdrop}
          onPress={saving ? undefined : onClose}
          accessibilityRole='button'
          accessibilityLabel={RENAME_CANCEL}
          importantForAccessibility='no'
        />
        <View style={s.center} pointerEvents='box-none'>
          <Card testID='rename-dialog' style={s.card}>
            <Text accessibilityRole='header' style={[s.h2, { color: p.text }]}>
              {RENAME_TITLE}
            </Text>
            <TextInput
              testID='rename-input'
              accessibilityLabel={RENAME_LABEL}
              accessibilityHint={describeLength(draft)}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void save()}
              autoFocus
              selectTextOnFocus
              returnKeyType='done'
              autoCapitalize='sentences'
              editable={!saving}
              placeholder={RENAME_LABEL}
              placeholderTextColor={p.muted}
              style={[s.input, { color: p.text, backgroundColor: p.bg, borderColor: problem ? p.danger : p.border }]}
            />
            <View style={s.meta}>
              <Text
                testID='rename-error'
                accessibilityLiveRegion='polite'
                style={[s.caption, s.grow, { color: p.danger }]}
              >
                {message ?? ''}
              </Text>
              <Text style={[s.caption, { color: p.muted }]}>{describeLength(draft)}</Text>
            </View>
            <View style={s.row}>
              <Button
                testID='rename-cancel'
                label={RENAME_CANCEL}
                color={p.border}
                textColor={p.text}
                disabled={saving}
                onPress={onClose}
                style={s.grow}
              />
              <Button
                testID='rename-save'
                label={RENAME_SAVE}
                color={ACCENT}
                busy={saving}
                disabled={problem != null}
                onPress={() => void save()}
                style={s.grow}
              />
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' }, // as the Me drawer
  center: { flex: 1, justifyContent: 'center', padding: SPACE.lg },
  card: { gap: SPACE.md },
  h2: { fontSize: 17, fontWeight: FONT_WEIGHT.heavy },
  input: {
    fontSize: FONT_SIZE.body,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  caption: { fontSize: FONT_SIZE.caption },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: SPACE.sm },
});

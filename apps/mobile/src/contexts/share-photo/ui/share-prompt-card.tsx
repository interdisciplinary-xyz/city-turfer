import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { PhotoSourceSheet } from './photo-source-sheet';
import type { SharePromptCardProps } from './share-prompt-card.constants';
import { usePhotoPicker } from './use-photo-picker';
import { useSharePrompt } from './use-share-prompt';

/** Right after Finish: "Share a photo?" with Take photo, Choose from library, Not now and Don't ask again. */
export function SharePromptCard({ userId, justFinished, onPicked }: SharePromptCardProps) {
  const p = usePalette();
  const t = useT('share');
  const prompt = useSharePrompt(userId, justFinished);
  const picker = usePhotoPicker(onPicked);
  if (!prompt.visible) {
    // The explainer may still be open after a refused camera.
    return <PhotoSourceSheet picker={picker} />;
  }
  const choose = (source: 'camera' | 'library') => {
    prompt.hide();
    picker.pick(source);
  };
  return (
    <>
      <Card testID='share-prompt' style={s.card}>
        <Text accessibilityRole='header' style={[s.h, { color: p.text }]}>
          {t('prompt.title')}
        </Text>
        <Text style={[s.body, { color: p.muted }]}>{t('prompt.body')}</Text>
        <View style={s.buttons}>
          <Button
            testID='share-prompt-camera'
            label={t('prompt.camera')}
            color={ACCENT}
            onPress={() => choose('camera')}
          />
          <Button
            testID='share-prompt-library'
            label={t('prompt.library')}
            color={p.border}
            textColor={p.text}
            onPress={() => choose('library')}
          />
        </View>
        <View style={s.links}>
          <Pressable
            testID='share-prompt-dismiss'
            accessibilityRole='button'
            accessibilityLabel={t('prompt.dismiss')}
            onPress={prompt.hide}
            hitSlop={SPACE.md}
            style={s.link}
          >
            <Text style={[s.linkText, { color: p.text }]}>{t('prompt.dismiss')}</Text>
          </Pressable>
          <Pressable
            testID='share-prompt-never'
            accessibilityRole='button'
            accessibilityLabel={t('prompt.never')}
            onPress={prompt.never}
            hitSlop={SPACE.md}
            style={s.link}
          >
            <Text style={[s.linkText, { color: p.muted }]}>{t('prompt.never')}</Text>
          </Pressable>
        </View>
      </Card>
      <PhotoSourceSheet picker={picker} />
    </>
  );
}

const s = StyleSheet.create({
  card: { gap: SPACE.md },
  h: { fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.heavy },
  body: { fontSize: FONT_SIZE.body, lineHeight: 22 },
  buttons: { gap: SPACE.sm },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
});

import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import {
  ACTION_ERRORS,
  ACTION_FAILED,
  DEV_BACKUP_NOTE,
  DEV_BACKUP_TITLE,
  ERROR_TITLE,
  SERVER_LABEL,
  TOKEN_LABEL,
  TOKEN_PLACEHOLDER,
  TOKEN_SAVED,
} from './cloud-backup-card.constants';
import { useCloudBackup } from './hooks';

const showError = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  Alert.alert(ERROR_TITLE, (code && ACTION_ERRORS[code]) || ACTION_FAILED);
};

/**
 * Developer tools: the pasted device token (for the founder's phone until it signs in with a code)
 * and the testing server. The token is entered secure and never shown again.
 */
export function BackupDeveloperCard() {
  const p = usePalette();
  const { status, saveToken, removeToken, saveServerUrl } = useCloudBackup();
  const [busy, setBusy] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [editingToken, setEditingToken] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState<string | null>(null);

  if (!status?.available) {
    return null;
  }

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    work()
      .catch(showError)
      .finally(() => setBusy(false));
  };
  const inputStyle = [s.input, { color: p.text, backgroundColor: p.bg, borderColor: p.border }];
  const showTokenInput = !status.hasDeviceToken || editingToken;

  return (
    <Card style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{DEV_BACKUP_TITLE}</Text>
      <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{DEV_BACKUP_NOTE}</Text>
      <Text style={[s.label, { color: p.text }]}>{TOKEN_LABEL}</Text>
      {showTokenInput ? (
        <View style={s.inline}>
          <TextInput
            testID='backup-token-input'
            accessibilityLabel={TOKEN_LABEL}
            value={tokenDraft}
            onChangeText={setTokenDraft}
            placeholder={TOKEN_PLACEHOLDER}
            placeholderTextColor={p.muted}
            secureTextEntry
            autoCapitalize='none'
            autoCorrect={false}
            spellCheck={false}
            textContentType='password'
            importantForAutofill='no'
            style={[inputStyle, s.grow]}
          />
          <Button
            testID='backup-token-save'
            label='Save'
            color={ACCENT}
            disabled={busy || tokenDraft.trim() === ''}
            onPress={() =>
              run(async () => {
                await saveToken(tokenDraft);
                setTokenDraft('');
                setEditingToken(false);
              })
            }
          />
        </View>
      ) : (
        <View style={s.inline}>
          <Text testID='backup-token-saved' style={[s.grow, { color: p.muted, fontSize: FONT_SIZE.caption }]}>
            {TOKEN_SAVED}
          </Text>
          <Pressable testID='backup-token-replace' accessibilityRole='button' onPress={() => setEditingToken(true)}>
            <Text style={[s.link, { color: ACCENT }]}>Replace</Text>
          </Pressable>
          {!status.enabled && (
            <Pressable testID='backup-token-remove' accessibilityRole='button' onPress={() => run(removeToken)}>
              <Text style={[s.link, { color: p.danger }]}>Remove</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable
        testID='backup-server-toggle'
        accessibilityRole='button'
        onPress={() => {
          setServerOpen(!serverOpen);
          setServerDraft(status.serverUrlOverridden ? status.serverUrl : '');
        }}
      >
        <Text style={[s.link, { color: p.muted }]}>
          {SERVER_LABEL}
          {status.serverUrlOverridden ? ' · custom' : ''}
        </Text>
      </Pressable>
      {serverOpen && (
        <>
          <TextInput
            testID='backup-server-input'
            accessibilityLabel={SERVER_LABEL}
            value={serverDraft ?? ''}
            onChangeText={setServerDraft}
            placeholder={status.serverUrlOverridden ? undefined : status.serverUrl}
            placeholderTextColor={p.muted}
            autoCapitalize='none'
            autoCorrect={false}
            spellCheck={false}
            keyboardType='url'
            style={inputStyle}
          />
          <View style={s.inline}>
            <Button
              testID='backup-server-save'
              label='Use this server'
              color={p.border}
              textColor={p.text}
              disabled={busy || !serverDraft?.trim()}
              onPress={() => run(() => saveServerUrl(serverDraft))}
            />
            {status.serverUrlOverridden && (
              <Button
                testID='backup-server-reset'
                label='Default server'
                color={p.card}
                textColor={p.text}
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await saveServerUrl(null);
                    setServerDraft('');
                  })
                }
              />
            )}
          </View>
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: FONT_WEIGHT.heavy },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  grow: { flex: 1 },
  label: { fontSize: 15, fontWeight: FONT_WEIGHT.bold },
  link: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, paddingVertical: SPACE.xs },
  input: {
    fontSize: FONT_SIZE.body,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
});

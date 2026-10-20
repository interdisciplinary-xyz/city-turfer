import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import type { BackupCommandResult } from '../contract';
import {
  ACTION_ERRORS,
  ACTION_FAILED,
  BACKUP_PRIVACY,
  BACKUP_SWITCH_LABEL,
  CLOUD_BACKUP_PITCH,
  CLOUD_BACKUP_TITLE,
  describeRefused,
  ERROR_TEXT,
  ERROR_TITLE,
  HEALTH_NOTE,
  HEALTH_SWITCH_LABEL,
  OFF_PENDING,
  SERVER_LABEL,
  TOKEN_LABEL,
  TOKEN_PLACEHOLDER,
  TOKEN_SAVED,
} from './cloud-backup-card.constants';
import { describeProgress } from './format';
import { useCloudBackup } from './hooks';

const showError = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  Alert.alert(ERROR_TITLE, (code && ACTION_ERRORS[code]) || ACTION_FAILED);
};

/**
 * Info screen card: device token, consent switch ("Back up to CityTurfer cloud"), Apple Health
 * switch, progress and "Back up now". The token is entered secure and never shown again.
 */
export function CloudBackupCard() {
  const p = usePalette();
  const { status, setEnabled, setHealthIncluded, saveToken, removeToken, saveServerUrl, backUpNow } = useCloudBackup();
  const [busy, setBusy] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [editingToken, setEditingToken] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!status) {
    return null;
  }

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    work()
      .catch(showError)
      .finally(() => setBusy(false));
  };

  const switched = (r: BackupCommandResult, turningOn: boolean) => {
    if (r.kind === 'failed') {
      setNotice(turningOn ? ERROR_TEXT[r.error] : OFF_PENDING);
    }
  };

  const inputStyle = [s.input, { color: p.text, backgroundColor: p.bg, borderColor: p.border }];
  const showTokenInput = !status.hasToken || editingToken;
  const error = notice ?? (status.enabled && status.lastError ? ERROR_TEXT[status.lastError] : null);

  return (
    <Card style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{CLOUD_BACKUP_TITLE}</Text>
      <Text style={{ color: p.muted }}>{CLOUD_BACKUP_PITCH}</Text>

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

      <View style={s.row}>
        <Text style={[s.label, s.grow, { color: p.text }]}>{BACKUP_SWITCH_LABEL}</Text>
        <Switch
          testID='backup-switch'
          accessibilityLabel={BACKUP_SWITCH_LABEL}
          value={status.enabled}
          disabled={busy || (!status.enabled && !status.hasToken)}
          onValueChange={(on) => run(async () => switched(await setEnabled(on), on))}
          trackColor={{ true: ACCENT, false: p.border }}
        />
      </View>
      <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{BACKUP_PRIVACY}</Text>

      {status.enabled && Platform.OS === 'ios' && (
        <>
          <View style={s.row}>
            <Text style={[s.label, s.grow, { color: p.text }]}>{HEALTH_SWITCH_LABEL}</Text>
            <Switch
              testID='backup-health-switch'
              accessibilityLabel={HEALTH_SWITCH_LABEL}
              value={status.healthIncluded}
              disabled={busy}
              onValueChange={(on) => run(async () => switched(await setHealthIncluded(on), on))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{HEALTH_NOTE}</Text>
        </>
      )}

      {status.enabled && (
        <Text testID='backup-status' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {status.running ? 'Backing up…' : describeProgress(status, Date.now())}
        </Text>
      )}
      {status.enabled && status.refused > 0 && (
        <Text testID='backup-refused' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {describeRefused(status.refused)}
        </Text>
      )}
      {error && (
        <Text testID='backup-error' style={{ color: p.danger, fontSize: FONT_SIZE.caption }}>
          {error}
        </Text>
      )}
      {status.enabled && (
        <Button
          testID='backup-now'
          label='Back up now'
          color={p.border}
          textColor={p.text}
          busy={status.running}
          disabled={busy}
          onPress={() => run(() => backUpNow())}
        />
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

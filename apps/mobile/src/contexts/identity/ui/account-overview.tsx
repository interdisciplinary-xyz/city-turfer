import { FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useT } from '@/i18n';
import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { accountRows } from './account-rows';
import type { AccountOverviewProps } from './account-settings.constants';
import { useBackupLinkTarget } from './hooks';
import { SettingsRow } from './settings-row';
import { useAnnounce } from './use-announce';

/**
 * Me › Account's rows: Name, Email, Account password, Sign-in, Data. Online-only rows are disabled
 * and say why when there is no connection; a local profile (no account) edits its name only.
 */
export function AccountOverview({ user, state, dataText, onName, onEmail, onPassword, onRetry }: AccountOverviewProps) {
  const p = usePalette();
  const t = useT('account');
  // A local profile linked to its own address: that address is the profile (see accountRows).
  const fixedAddress = useBackupLinkTarget() != null;
  const rows = accountRows(user, state, t, undefined, fixedAddress);
  // "Try again" gives feedback: VoiceOver hears it's checking (TalkBack reads the live region).
  useAnnounce(rows.retrying && t('value.checking'));
  const retryLabel = rows.retrying ? t('value.checking') : t('retry');

  return (
    <Card testID='account-overview'>
      <SettingsRow
        testID='account-name-row'
        label={t('row.name')}
        value={rows.name.value}
        disabled={!rows.name.enabled}
        accessibilityHint={t('hint.name')}
        onPress={onName}
      />
      <SettingsRow
        testID='account-email-row'
        label={t('row.email')}
        value={rows.email.value}
        disabled={!rows.email.enabled && !rows.emailFixed}
        accessibilityHint={rows.emailFixed ? undefined : t('hint.email')}
        onPress={rows.local || rows.emailFixed ? undefined : onEmail}
        divider
      />
      {rows.password && (
        <SettingsRow
          testID='account-password-row'
          label={t('row.password')}
          value={rows.password.value}
          disabled={!rows.password.enabled}
          accessibilityHint={t('hint.password')}
          onPress={rows.local ? undefined : onPassword}
          divider
        />
      )}
      <SettingsRow testID='account-sign-in-row' label={t('row.signIn')} value={rows.signIn} divider />
      <SettingsRow testID='account-data-row' label={t('row.data')} value={dataText} divider />
      {rows.retry && (
        <Pressable
          testID='account-retry'
          accessibilityRole='button'
          accessibilityLabel={retryLabel}
          accessibilityState={{ disabled: rows.retrying, busy: rows.retrying }}
          accessibilityLiveRegion='polite'
          disabled={rows.retrying}
          onPress={onRetry}
          hitSlop={SPACE.sm}
          style={s.retry}
        >
          <Text style={[s.retryText, { color: rows.retrying ? p.muted : p.accentText }]}>{retryLabel}</Text>
        </Pressable>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontWeight: FONT_WEIGHT.bold },
});

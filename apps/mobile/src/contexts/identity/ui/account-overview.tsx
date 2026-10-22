import { FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { accountRows } from './account-rows';
import { type AccountOverviewProps, HINT, RETRY, ROW } from './account-settings.constants';
import { SettingsRow } from './settings-row';

/**
 * Me › Account's rows: Name, Email, Account password, Sign-in, Data. Online-only rows are disabled
 * and say why when there is no connection; a local profile (no account) edits its name only.
 */
export function AccountOverview({ user, state, dataText, onName, onEmail, onPassword, onRetry }: AccountOverviewProps) {
  const p = usePalette();
  const rows = accountRows(user, state);

  return (
    <Card testID='account-overview'>
      <SettingsRow
        testID='account-name-row'
        label={ROW.name}
        value={rows.name.value}
        disabled={!rows.name.enabled}
        accessibilityHint={HINT.name}
        onPress={onName}
      />
      <SettingsRow
        testID='account-email-row'
        label={ROW.email}
        value={rows.email.value}
        disabled={!rows.email.enabled}
        accessibilityHint={HINT.email}
        onPress={rows.local ? undefined : onEmail}
        divider
      />
      <SettingsRow
        testID='account-password-row'
        label={ROW.password}
        value={rows.password.value}
        disabled={!rows.password.enabled}
        accessibilityHint={HINT.password}
        onPress={rows.local ? undefined : onPassword}
        divider
      />
      <SettingsRow testID='account-sign-in-row' label={ROW.signIn} value={rows.signIn} divider />
      <SettingsRow testID='account-data-row' label={ROW.data} value={dataText} divider />
      {rows.retry && (
        <Pressable
          testID='account-retry'
          accessibilityRole='button'
          accessibilityLabel={RETRY}
          onPress={onRetry}
          hitSlop={SPACE.sm}
          style={s.retry}
        >
          <Text style={[s.retryText, { color: p.accentText }]}>{RETRY}</Text>
        </Pressable>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontWeight: FONT_WEIGHT.bold },
});

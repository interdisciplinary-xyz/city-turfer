import { SPACE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { accountFieldError, displayName } from '@/contexts/identity';
import { useT } from '@/i18n';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';

import { AccountField } from './account-field';
import { failureMessage } from './account-messages';
import { type ErrorMessage, FIELD_ERROR, type NameFormProps } from './account-settings.constants';
import { useAccountActions } from './hooks';

/** The rule's message for a draft name, or null when it can be saved (blank clears the name). */
function problemOf(draft: string): ErrorMessage | null {
  try {
    displayName(draft);
    return null;
  } catch (e) {
    const code = accountFieldError(e);
    return code ? FIELD_ERROR[code] : null;
  }
}

/**
 * Change the name: one field, checked as you type with the same rule as the server. An account's
 * name is saved on the server (online only); a local profile's stays on this phone.
 */
export function NameForm({ onDone }: NameFormProps) {
  const t = useT('account');
  const tc = useT('common');
  const te = useT('errors');
  const { auth } = useApp();
  const { updateName } = useAccountActions();
  const user = auth.status === 'signed-in' ? auth.user : null;
  const [draft, setDraft] = useState(user?.name ?? '');
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const problem = problemOf(draft);
  const shown = problem ?? error;

  const save = async () => {
    if (problem || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await updateName(draft);
      if (r.kind === 'saved') {
        onDone();
      } else if (r.kind === 'field-error') {
        setError(FIELD_ERROR[r.code]);
      } else {
        setError(failureMessage(r));
      }
    } catch {
      setError(failureMessage({ kind: 'unavailable' }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <AccountField
        testID='account-name-input'
        label={t('name.label')}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setError(null);
        }}
        onSubmitEditing={() => void save()}
        autoFocus
        autoCapitalize='words'
        autoComplete='name'
        textContentType='name'
        returnKeyType='done'
        editable={!busy}
        error={shown ? te(shown.key, shown.values) : null}
        hint={user?.accountId ? t('name.account') : t('name.local')}
      />
      <Button
        testID='account-name-save'
        label={tc('save')}
        color={ACCENT}
        busy={busy}
        disabled={problem != null}
        onPress={() => void save()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: SPACE.lg },
});

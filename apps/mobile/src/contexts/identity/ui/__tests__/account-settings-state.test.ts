import { translator } from '@/i18n/translator';

import type { AccountSettingsState } from '../account-settings.constants';
import { latestRequest, refreshAnswered, refreshStarted, unreachableMessage } from '../account-settings-state';

const unreachableText = (state: AccountSettingsState) => {
  const m = unreachableMessage(state);
  return m && translator('errors', 'en')(m.key, m.values);
};

const account = {
  kind: 'account' as const,
  email: 'ola@example.com',
  name: null,
  hasPassword: true,
  passwordChangedAt: null,
};

describe('Me › Account: asking the server again', () => {
  it('the first load stays loading; a ready answer turns stale; offline and failed show they retry', () => {
    expect(refreshStarted({ status: 'loading' })).toEqual({ status: 'loading' });
    expect(refreshStarted({ status: 'ready', settings: account })).toEqual({
      status: 'ready',
      settings: account,
      refreshing: true,
    });
    expect(refreshStarted({ status: 'offline' })).toEqual({ status: 'offline', retrying: true });
    expect(refreshStarted({ status: 'failed', reason: 'unavailable' })).toEqual({
      status: 'failed',
      reason: 'unavailable',
      retrying: true,
    });
  });

  it('the answer replaces the stale state (no refreshing or retrying left over)', () => {
    expect(refreshAnswered(account)).toEqual({ status: 'ready', settings: account });
    expect(refreshAnswered({ kind: 'local', name: 'Ola' })).toEqual({
      status: 'ready',
      settings: { kind: 'local', name: 'Ola' },
    });
    expect(refreshAnswered({ kind: 'offline' })).toEqual({ status: 'offline' });
    expect(refreshAnswered({ kind: 'not-signed-in' })).toEqual({ status: 'failed', reason: 'not-signed-in' });
    expect(refreshAnswered({ kind: 'rate-limited', retryAfterS: 30 })).toEqual({
      status: 'failed',
      reason: 'rate-limited',
    });
  });

  it('a slow answer to an older request is dropped: the newest one wins', async () => {
    const requests = latestRequest();
    let state: AccountSettingsState = { status: 'ready', settings: account };
    const ask = async (answer: Promise<Parameters<typeof refreshAnswered>[0]>) => {
      const id = requests.begin();
      state = refreshStarted(state);
      const r = await answer;
      if (requests.isLatest(id)) {
        state = refreshAnswered(r);
      }
    };
    let answerSlow!: (r: { kind: 'offline' }) => void;
    const slow = ask(new Promise((resolve) => (answerSlow = resolve)));
    expect(state).toMatchObject({ status: 'ready', refreshing: true });
    await ask(Promise.resolve({ ...account, hasPassword: false }));
    answerSlow({ kind: 'offline' });
    await slow;
    expect(state).toEqual({ status: 'ready', settings: { ...account, hasPassword: false } });
  });

  it('why a flow cannot open: offline or refused in plain words; nothing to say when ready', () => {
    expect(unreachableText({ status: 'offline' })).toMatch(/No connection/);
    expect(unreachableText({ status: 'failed', reason: 'not-signed-in' })).toMatch(/isn’t signed in/);
    expect(unreachableText({ status: 'failed', reason: 'rate-limited' })).toMatch(/Wait a few minutes/);
    expect(unreachableText({ status: 'ready', settings: account })).toBeNull();
    expect(unreachableText({ status: 'loading' })).toBeNull();
  });
});

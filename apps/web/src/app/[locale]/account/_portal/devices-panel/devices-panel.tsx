'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import type { SessionScope } from '@/api/schema';

import { ErrorMessage } from '../error-message';
import { formatDate } from '../format';
import { Notice } from '../notice';
import { type DevicesPanelProps, sortSessions } from './devices-panel.constants';

/**
 * Signed-in devices (`GET /v1/auth/sessions`): every phone and browser, with sign-out one,
 * everywhere else, or everywhere. Decision D11: "everywhere" includes phones, so both say so and
 * ask once more before acting. The API stores no IP, device name or location, so neither does this.
 */
export function DevicesPanel({
  sessions,
  loading,
  locale,
  onRevoke,
  onRevokeScope,
  pending,
  error,
  initialConfirm = null,
}: DevicesPanelProps) {
  const t = useTranslations('portal.privacy.devices');
  const tc = useTranslations('portal.common');
  const id = useId();
  const [confirm, setConfirm] = useState<SessionScope | null>(initialConfirm);
  const busy = pending !== null;
  const others = sessions?.filter((session) => !session.current) ?? [];

  return (
    <section className='portal-card' aria-labelledby={id} aria-busy={loading || undefined}>
      <h2 id={id} className='portal-card-title'>
        {t('title')}
      </h2>
      <p>{t('lede')}</p>
      {sessions === null && !loading ? (
        <Notice>
          <p>{t('unavailable')}</p>
        </Notice>
      ) : null}
      {sessions ? (
        <ul className='portal-devices'>
          {sortSessions(sessions).map((session) => {
            const label = session.current ? t('current') : t(session.client);
            const signedIn = formatDate(locale, session.createdAt);
            return (
              <li key={session.id} className='portal-device'>
                <div className='portal-device-text'>
                  <p className='portal-device-name'>{label}</p>
                  <p className='portal-muted'>
                    {t('signedIn', { date: signedIn })} ·{' '}
                    {t('lastUsed', { date: formatDate(locale, session.lastActiveAt) })}
                  </p>
                  <p className='portal-muted'>{t('expires', { date: formatDate(locale, session.expiresAt) })}</p>
                </div>
                {session.current ? null : (
                  <button
                    className='portal-button portal-button-secondary'
                    type='button'
                    onClick={() => onRevoke(session.id)}
                    disabled={busy}
                    aria-label={t('signOutOneLabel', { client: label, date: signedIn })}
                  >
                    {pending && 'id' in pending && pending.id === session.id ? t('working') : t('signOutOne')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {sessions && others.length === 0 ? <p className='portal-muted'>{t('none')}</p> : null}
      {error ? <ErrorMessage error={error} /> : null}
      {sessions ? (
        <div className='portal-scopes'>
          {(['others', 'all'] as const)
            .filter((scope) => scope === 'all' || others.length > 0)
            .map((scope) => {
              const name = scope === 'others' ? 'Others' : 'All';
              const hintId = `${id}-${scope}-hint`;
              return (
                <div key={scope} className='portal-scope'>
                  <p id={hintId} className='portal-hint'>
                    {t(`signOut${name}Hint`)}
                  </p>
                  {confirm === scope ? (
                    <div className='portal-row'>
                      <button
                        className='portal-button portal-button-danger'
                        type='button'
                        onClick={() => onRevokeScope(scope)}
                        disabled={busy}
                        aria-describedby={hintId}
                      >
                        {pending && 'scope' in pending && pending.scope === scope ? t('working') : t(`confirm${name}`)}
                      </button>
                      <button
                        className='portal-button portal-button-quiet'
                        type='button'
                        onClick={() => setConfirm(null)}
                        disabled={busy}
                      >
                        {tc('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className='portal-button portal-button-secondary'
                      type='button'
                      onClick={() => setConfirm(scope)}
                      disabled={busy}
                      aria-describedby={hintId}
                    >
                      {t(`signOut${name}`)}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      ) : null}
    </section>
  );
}

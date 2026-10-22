'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useConsents,
  useDeleteAccount,
  useExportStatus,
  useMe,
  useRequestExport,
  useRevokeSession,
  useRevokeSessions,
  useSessions,
} from '@/api/hooks';

import { AccountSummary } from '../account-summary';
import { BackupStatus } from '../backup-status';
import { DeleteAccount } from '../delete-account';
import { DevicesPanel } from '../devices-panel';
import { ErrorMessage } from '../error-message';
import { ExportPanel } from '../export-panel';
import { Unreachable } from '../unreachable';
import { WhatWeStore } from '../what-we-store';
import type { PrivacyPageProps } from './privacy-page.constants';

/**
 * Privacy & data, the portal home of Slice 0: the account, the backup consents (read-only), what
 * we store, a copy by e-mail, signed-in devices and account deletion. Rendered inside the session
 * gate, so `me` is already loaded.
 */
export function PrivacyPage({ locale }: PrivacyPageProps) {
  const t = useTranslations('portal.privacy');
  const me = useMe();
  const consents = useConsents();
  const sessions = useSessions();
  const requestExport = useRequestExport();
  const [exportId, setExportId] = useState<string | null>(null);
  const exportStatus = useExportStatus(exportId);
  const deleteAccount = useDeleteAccount();
  const revokeSession = useRevokeSession();
  const revokeSessions = useRevokeSessions();

  if (!me.data) {
    return null;
  }
  const user = me.data;
  const job = exportStatus.data ?? requestExport.data ?? null;
  // An older API without the sessions routes (404 / 501): show "not available", not an error.
  const sessionsMissing = sessions.isError && (sessions.error.status === 404 || sessions.error.status === 501);
  // A 404 on sign-out-one: that session had already ended. That's what was asked for, so no error.
  const revokeError = revokeSession.error?.code === 'not-found' ? null : revokeSession.error;
  const pendingDevices = revokeSession.isPending
    ? { id: revokeSession.variables }
    : revokeSessions.isPending || (revokeSessions.isSuccess && revokeSessions.variables === 'all')
      ? { scope: revokeSessions.variables }
      : null;

  return (
    <div className='portal-page'>
      <h1 className='portal-title'>{t('title')}</h1>
      <p className='portal-lede'>{t('lede')}</p>

      <AccountSummary user={user} locale={locale} />

      {consents.isSuccess ? <BackupStatus consents={consents.data.items} locale={locale} /> : null}
      {consents.isError && consents.error.code !== 'signed-out' ? (
        <Unreachable onRetry={() => void consents.refetch()} retrying={consents.isFetching} />
      ) : null}

      <WhatWeStore />

      <ExportPanel
        email={user.email}
        locale={locale}
        job={job}
        onRequest={() =>
          requestExport.mutate(undefined, {
            onSuccess: (created) => setExportId(created.id),
          })
        }
        pending={requestExport.isPending}
        error={requestExport.error ?? exportStatus.error}
      />

      <DevicesPanel
        sessions={sessions.data?.sessions ?? null}
        loading={sessions.isPending}
        locale={locale}
        onRevoke={(id) => revokeSession.mutate(id)}
        onRevokeScope={(scope) => revokeSessions.mutate(scope)}
        pending={pendingDevices}
        error={revokeError ?? revokeSessions.error ?? (sessions.isError && !sessionsMissing ? sessions.error : null)}
      />

      <DeleteAccount
        onDelete={() => deleteAccount.mutate()}
        pending={deleteAccount.isPending || deleteAccount.isSuccess}
        error={deleteAccount.error}
      />
      {consents.isError && consents.error.code === 'generic' ? <ErrorMessage error={consents.error} /> : null}
    </div>
  );
}

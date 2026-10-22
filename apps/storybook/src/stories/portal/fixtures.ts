// Made-up data for the portal stories: an @e2e.cityturfer.test account, no real person or place.
// Also loads the portal's stylesheet, which only the portal root's layout imports on the site.
import '@/app/[locale]/account/portal.css';

import { PortalError } from '@/api/errors';
import type { AuthSession, Consent, DataExportJob, User } from '@/api/schema';

export const USER: User = {
  id: 'u_story',
  email: 'walker@e2e.cityturfer.test',
  displayName: 'u_story',
  createdAt: '2026-09-14T08:30:00Z',
};

export const CONSENTS: Record<'never' | 'withdrawn' | 'on' | 'onWithHealth', Consent[]> = {
  never: [],
  withdrawn: [{ purpose: 'cloud-sync', granted: false, policyVersion: '2026-10', at: '2026-10-18T19:02:00Z' }],
  on: [{ purpose: 'cloud-sync', granted: true, policyVersion: '2026-10', at: '2026-09-14T08:31:00Z' }],
  onWithHealth: [
    { purpose: 'cloud-sync', granted: true, policyVersion: '2026-10', at: '2026-09-14T08:31:00Z' },
    { purpose: 'apple-health-in-cloud-sync', granted: true, policyVersion: '2026-10', at: '2026-09-20T17:45:00Z' },
  ],
};

export const SESSIONS: AuthSession[] = [
  {
    id: 'sess_browser_here',
    client: 'browser',
    createdAt: '2026-10-22T07:10:00Z',
    lastActiveAt: '2026-10-22T00:00:00Z',
    expiresAt: '2026-11-05T07:10:00Z',
    current: true,
  },
  {
    id: 'sess_phone',
    client: 'phone',
    createdAt: '2026-09-14T08:30:00Z',
    lastActiveAt: '2026-10-21T00:00:00Z',
    expiresAt: '2026-12-20T08:30:00Z',
    current: false,
  },
  {
    id: 'sess_browser_other',
    client: 'browser',
    createdAt: '2026-10-02T12:00:00Z',
    lastActiveAt: '2026-10-03T00:00:00Z',
    expiresAt: '2026-10-17T12:00:00Z',
    current: false,
  },
];

export const exportJob = (status: DataExportJob['status']): DataExportJob => ({
  id: 'exp_story',
  status,
  requestedAt: '2026-10-22T09:00:00Z',
  readyAt: status === 'pending' || status === 'failed' ? null : '2026-10-22T09:01:00Z',
  expiresAt: status === 'pending' || status === 'failed' ? null : '2026-10-23T09:01:00Z',
});

export const ERRORS = {
  wrongCode: new PortalError('auth.invalid-code', { status: 401 }),
  rateLimited: new PortalError('auth.rate-limited', { status: 429, retryAfterSeconds: 45 }),
  exportDaily: new PortalError('rate-limited', { status: 429, retryAfterSeconds: 20 * 3600 }),
  generic: new PortalError('generic', { status: 500, requestId: 'req_01JB2S7Y' }),
  unreachable: new PortalError('unreachable'),
};

/** A pretend API call: resolves or rejects after a short pause, so pending states show. */
export const after = (ms: number, outcome: 'ok' | PortalError) => () =>
  new Promise<void>((resolve, reject) => {
    window.setTimeout(() => (outcome === 'ok' ? resolve() : reject(outcome)), ms);
  });

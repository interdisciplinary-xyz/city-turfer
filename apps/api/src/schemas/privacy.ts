import { z } from '@hono/zod-openapi';

import { IsoDateTime } from './common';

/**
 * Privacy: consents for cloud sync, the GDPR export (async: Vercel caps responses at 4.5 MB) and
 * erasure. Retention and scope: docs/decisions/api-sync-2026-10-20.md, "Privacy".
 */

export const ConsentPurpose = z.enum(['cloud-sync', 'apple-health-in-cloud-sync']).openapi('ConsentPurpose', {
  description:
    '`cloud-sync`: back up and sync activities with their GPS tracks. `apple-health-in-cloud-sync`: include workouts imported from Apple Health (decision D2). Without `cloud-sync` the server accepts no uploads.',
  example: 'cloud-sync',
});

export const Consent = z
  .object({
    purpose: ConsentPurpose,
    granted: z.boolean().openapi({ example: true }),
    policyVersion: z.string().openapi({ description: 'Privacy policy version shown to the user.', example: '2026-10' }),
    at: IsoDateTime,
  })
  .openapi('Consent');

export const ConsentList = z
  .object({ items: z.array(Consent).openapi({ description: 'The latest decision per purpose.' }) })
  .openapi('ConsentList');

export const ConsentPurposeParam = z.object({
  purpose: ConsentPurpose.openapi({ param: { name: 'purpose', in: 'path' } }),
});

export const SetConsentBody = z
  .object({
    granted: z.boolean().openapi({ example: true }),
    policyVersion: z.string().min(1).max(32).openapi({ example: '2026-10' }),
  })
  .openapi('SetConsentBody');

export const ExportIdParam = z.object({
  exportId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .openapi({ param: { name: 'exportId', in: 'path' }, example: 'exp_01' }),
});

export const DataExportJob = z
  .object({
    id: z.string().openapi({ example: 'exp_4fJq9TzW1kXv8bNc' }),
    status: z.enum(['pending', 'ready', 'downloaded', 'expired', 'failed']).openapi({
      description:
        '`pending`: being built; `ready`: the link was e-mailed; `downloaded`: fetched at least once (still works until `expiresAt`); `expired`: 24 h passed, or a consent was withdrawn; `failed`: nothing was sent, ask again at once.',
      example: 'ready',
    }),
    requestedAt: IsoDateTime,
    readyAt: IsoDateTime.nullable(),
    expiresAt: IsoDateTime.nullable().openapi({ description: 'The e-mailed link works until then (24 h).' }),
  })
  .openapi('DataExportJob', {
    description:
      'An export of everything the server holds for the account: a zip with `data.json` (account, consents, activities with tracks and gap routes, tombstones, Home City) and one GPX 1.1 file per activity. The download link is only in the e-mail and works until `expiresAt`.',
  });

export const DownloadKeyParam = z.object({
  key: z
    .string()
    .min(20)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/)
    .openapi({ param: { name: 'key', in: 'path' }, example: 'Zm9vYmFyYmF6cXV4cXV1eHF1dXgxMjM0NTY3ODkw' }),
});

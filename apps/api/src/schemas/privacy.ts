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
    id: z.string().openapi({ example: 'exp_01' }),
    status: z.enum(['pending', 'ready', 'failed', 'expired']).openapi({ example: 'ready' }),
    requestedAt: IsoDateTime,
    readyAt: IsoDateTime.nullable(),
    url: z.url().nullable().openapi({
      description:
        'Short-lived signed link to a zip: `data.json` (account, consents, activities, tombstones, Home City) and one GPX file per activity. Only while `ready`.',
      example: 'https://files.cityturfer.app/exports/exp_01.zip?signature=abc123',
    }),
    expiresAt: IsoDateTime.nullable().openapi({ description: 'The link stops working 24 h after it is ready.' }),
  })
  .openapi('DataExportJob');

export const ErasureJob = z
  .object({
    status: z.literal('scheduled'),
    requestedAt: IsoDateTime,
  })
  .openapi('ErasureJob', {
    description:
      'Sessions are revoked at once; rows and stored files follow. Database backups keep data for the provider’s restore window.',
  });

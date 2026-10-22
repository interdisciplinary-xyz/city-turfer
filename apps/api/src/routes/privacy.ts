import type { OpenAPIHono, z } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { forgetUser } from '../middleware';
import { AUTH_ERRORS, INVALID, LOCATION_HEADER, notFound } from '../schemas/common';
import { ConsentList, ConsentPurposeParam, DataExportJob, ExportIdParam, SetConsentBody } from '../schemas/privacy';
import { defineRoute, valid } from './define';
import { consentListDto } from './dto';

const TAG = ['Privacy'];
const json = <T>(schema: T) => ({ 'application/json': { schema } });

/** Privacy: consents, the GDPR export (art. 15 and 20) and erasure (art. 17). */
export function registerPrivacy(app: OpenAPIHono<AppEnv>): void {
  defineRoute(
    app,
    {
      status: 'live',
      method: 'delete',
      path: '/v1/me',
      tags: TAG,
      operationId: 'deleteMe',
      summary: 'Delete my account and data',
      description:
        'Erases the account and every row it owns, in one transaction — activities, tracks, gap routes, tombstones, the Home City, consents, exports, the sign-in account with every session and pending code (use case EraseAccount; GDPR art. 17, App Store account deletion). Afterwards the session token answers `401`. The phone keeps its own copy. A device token (`API_TOKENS`) still authenticates until it is removed from the configuration: its next request starts an empty account. Database backups keep the rows for the provider’s restore window.',
      responses: {
        204: { description: 'Erased (or nothing to erase).' },
        ...AUTH_ERRORS,
      },
    },
    async (c) => {
      await c.var.backup.eraseAccount(c.var.userId);
      forgetUser(c.var.deps.store as object, c.var.userId);
      return c.body(null, 204);
    }
  );

  defineRoute(app, {
    status: 'planned',
    method: 'post',
    path: '/v1/me/exports',
    tags: TAG,
    operationId: 'requestDataExport',
    summary: 'Request an export of all my data',
    description:
      'Starts an export of everything the server holds about the user, tracks included (use case RequestDataExport; GDPR art. 15 and 20). Poll the `Location`. Vercel caps responses at 4.5 MB, so the data comes as a file, not in the response.',
    responses: {
      202: { description: 'Export started.', headers: LOCATION_HEADER, content: json(DataExportJob) },
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/me/exports/{exportId}',
    tags: TAG,
    operationId: 'getDataExport',
    summary: 'Export status and download link',
    description: 'Use case GetDataExport. The link works for 24 h once `ready`.',
    request: { params: ExportIdParam },
    responses: {
      200: { description: 'The export.', content: json(DataExportJob) },
      ...INVALID,
      ...AUTH_ERRORS,
      ...notFound('export'),
    },
  });

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/me/consents',
      tags: TAG,
      operationId: 'listConsents',
      summary: 'My consents',
      description: 'The latest decision per purpose (use case ListConsents); purposes never decided are absent.',
      responses: {
        200: { description: 'The consents.', content: json(ConsentList) },
        ...AUTH_ERRORS,
      },
    },
    async (c) => c.json(consentListDto(await c.var.backup.consents(c.var.userId)), 200)
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'put',
      path: '/v1/me/consents/{purpose}',
      tags: TAG,
      operationId: 'setConsent',
      summary: 'Give or withdraw a consent',
      description:
        'Records the decision with the policy version and the server time (use case GiveOrWithdrawConsent). Without `cloud-sync` granted, activity and Home City writes answer `403 consent.required`. **Withdrawing deletes the server copy only** (never anything on a phone), at once and without tombstones or feed entries: `cloud-sync` → every activity with its track and gap routes, every tombstone and the Home City (the account and consents stay; turning backup on again re-uploads everything); `apple-health-in-cloud-sync` → every Apple Health (`hk-…`) activity. Deleting the account is `DELETE /v1/me`.',
      request: { params: ConsentPurposeParam, body: { required: true, content: json(SetConsentBody) } },
      responses: {
        200: { description: 'Recorded.', content: json(ConsentList) },
        ...INVALID,
        ...AUTH_ERRORS,
      },
    },
    async (c) => {
      const { purpose } = valid<z.infer<typeof ConsentPurposeParam>>(c, 'param');
      const body = valid<z.infer<typeof SetConsentBody>>(c, 'json');
      return c.json(consentListDto(await c.var.backup.setConsent(c.var.userId, purpose, body)), 200);
    }
  );
}

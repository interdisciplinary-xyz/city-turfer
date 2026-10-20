import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AUTH_ERRORS, INVALID, LOCATION_HEADER, notFound } from '../schemas/common';
import {
  ConsentList,
  ConsentPurposeParam,
  DataExportJob,
  ErasureJob,
  ExportIdParam,
  SetConsentBody,
} from '../schemas/privacy';
import { defineRoute } from './define';

const TAG = ['Privacy'];
const json = <T>(schema: T) => ({ 'application/json': { schema } });

/** Privacy: consents, the GDPR export (art. 15 and 20) and erasure (art. 17). */
export function registerPrivacy(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'delete',
    path: '/v1/me',
    tags: TAG,
    operationId: 'deleteMe',
    summary: 'Delete my account and data',
    description:
      'Erases the user and every row they own — activities, tracks, gap routes, turf, tombstones, consents, exports (use case EraseAccount; GDPR art. 17, App Store account deletion). Sessions end at once; the rest is a job. The phone keeps its own copy.',
    responses: {
      202: { description: 'Erasure scheduled.', content: json(ErasureJob) },
      ...AUTH_ERRORS,
    },
  });

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

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/me/consents',
    tags: TAG,
    operationId: 'listConsents',
    summary: 'My consents',
    description: 'The latest decision per purpose (use case ListConsents).',
    responses: {
      200: { description: 'The consents.', content: json(ConsentList) },
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'put',
    path: '/v1/me/consents/{purpose}',
    tags: TAG,
    operationId: 'setConsent',
    summary: 'Give or withdraw a consent',
    description:
      'Records the decision with the policy version (use case GiveOrWithdrawConsent). Withdrawing `cloud-sync` stops sync; erasing the data already stored is `DELETE /v1/me`. Withdrawing `apple-health-in-cloud-sync` stops new Apple Health uploads.',
    request: { params: ConsentPurposeParam, body: { required: true, content: json(SetConsentBody) } },
    responses: {
      200: { description: 'Recorded.', content: json(ConsentList) },
      ...INVALID,
      ...AUTH_ERRORS,
    },
  });
}

import { type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { stream } from 'hono/streaming';

import type { AppEnv } from '../deps';
import { forgetUser } from '../middleware';
import type { ExportService } from '../privacy/use-cases';
import { problem } from '../problem';
import { AUTH_ERRORS, INVALID, LOCATION_HEADER, notFound, problemResponse, UNAVAILABLE } from '../schemas/common';
import {
  ConsentList,
  ConsentPurposeParam,
  DataExportJob,
  DownloadKeyParam,
  ExportIdParam,
  SetConsentBody,
} from '../schemas/privacy';
import { defineRoute, valid } from './define';
import { consentListDto, exportJobDto } from './dto';

const TAG = ['Privacy'];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const CHUNK = 256 * 1024;

/** Live routes run after `requireStore`, so the export service exists whenever the store does. */
function exportsOf(c: Context<AppEnv>): ExportService {
  const { exports } = c.var.deps;
  if (!exports) {
    throw new Error('exports not wired');
  }
  return exports;
}

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

  defineRoute(
    app,
    {
      status: 'live',
      method: 'post',
      path: '/v1/me/exports',
      tags: TAG,
      operationId: 'requestDataExport',
      summary: 'E-mail me an export of all my data',
      description:
        'Builds a zip of everything the server holds for the account — `data.json` (account, consents, activities with tracks and gap routes, tombstones, Home City) and one GPX 1.1 per activity — and e-mails a download link valid 24 h (use case RequestDataExport; GDPR art. 15 and 20). The link is only in the e-mail: the phone cannot save files. One export per 24 hours (`429` with `Retry-After`; a `failed` one does not count); an account without an e-mail (device token) gets `422 export.no-email`. `status: failed` means nothing was sent: ask again. Withdrawing a consent deletes the zip and expires the link.',
      responses: {
        202: { description: 'Export built and e-mailed.', headers: LOCATION_HEADER, content: json(DataExportJob) },
        ...AUTH_ERRORS,
        422: problemResponse('No e-mail to send the link to.', 'export.no-email'),
      },
    },
    async (c) => {
      const job = await exportsOf(c).request(c.var.userId);
      c.header('Location', `/v1/me/exports/${job.id}`);
      return c.json(exportJobDto(job), 202);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/me/exports/{exportId}',
      tags: TAG,
      operationId: 'getDataExport',
      summary: 'Export status',
      description: 'Use case GetDataExport: whether the e-mailed link is ready, used or expired.',
      request: { params: ExportIdParam },
      responses: {
        200: { description: 'The export.', content: json(DataExportJob) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...notFound('export'),
      },
    },
    async (c) => {
      const { exportId } = valid<z.infer<typeof ExportIdParam>>(c, 'param');
      return c.json(exportJobDto(await exportsOf(c).get(c.var.userId, exportId)), 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/exports/{key}',
      tags: TAG,
      operationId: 'downloadDataExport',
      security: [],
      summary: 'Download an export (the e-mailed link)',
      description:
        'Public: the unguessable key in the path is the credential (use case DownloadDataExport). Works **as often as needed until it expires** (24 h; mail scanners may fetch it first, and a broken download can be retried), then `410 export.gone`. The zip is streamed in chunks (`Cache-Control: no-store`).',
      request: { params: DownloadKeyParam },
      responses: {
        200: {
          description: 'The zip.',
          content: { 'application/zip': { schema: z.string().openapi({ format: 'binary' }) } },
        },
        ...INVALID,
        ...notFound('export'),
        410: problemResponse('Older than 24 h, or a consent was withdrawn.', 'export.gone'),
        ...UNAVAILABLE,
      },
    },
    async (c) => {
      const { exports } = c.var.deps;
      if (!exports) {
        return problem(c, 'storage.unavailable', 'No database is configured.');
      }
      const { key } = valid<z.infer<typeof DownloadKeyParam>>(c, 'param');
      const file = await exports.download(key);
      c.header('Content-Type', 'application/zip');
      c.header('Content-Disposition', `attachment; filename="${file.fileName}"`);
      c.header('Cache-Control', 'no-store');
      c.header('Referrer-Policy', 'no-referrer');
      // Streamed in chunks, without Content-Length: a buffered Vercel response is capped at 4.5 MB.
      // Whether a streamed one passes that cap is unverified until a deploy (runbook).
      return stream(c, async (out) => {
        for (let at = 0; at < file.bytes.byteLength; at += CHUNK) {
          await out.write(file.bytes.subarray(at, at + CHUNK));
        }
      });
    }
  );

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

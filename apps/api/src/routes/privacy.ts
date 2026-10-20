import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AUTH_ERRORS } from '../schemas/common';
import { DataExport } from '../schemas/privacy';
import { defineRoute } from './define';

/** Privacy: the user's data rights (GDPR export and erasure). */
export function registerPrivacy(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/me/export',
    tags: ['Privacy'],
    operationId: 'exportMyData',
    summary: 'Export all my data',
    description: 'Everything the server holds about the user, tracks included (GDPR art. 15 and 20).',
    responses: {
      200: { description: 'The export.', content: { 'application/json': { schema: DataExport } } },
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'delete',
    path: '/v1/me',
    tags: ['Privacy'],
    operationId: 'deleteMe',
    summary: 'Delete my account and data',
    description:
      'Erases the user and every row they own, tracks included (GDPR art. 17). The phone keeps its own copy.',
    responses: { 204: { description: 'Deleted.' }, ...AUTH_ERRORS },
  });
}

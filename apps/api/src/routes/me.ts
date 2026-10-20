import type { OpenAPIHono } from '@hono/zod-openapi';

import { AchievementList } from '../schemas/achievements';
import { AUTH_ERRORS, BEARER_AUTH } from '../schemas/common';
import { DataExport } from '../schemas/privacy';
import { registerPlanned } from './planned';

/** Achievements and the user's data rights (GDPR export and erasure). */
export function registerMe(app: OpenAPIHono): void {
  registerPlanned(app, {
    method: 'get',
    path: '/v1/achievements',
    tags: ['Achievements'],
    operationId: 'listAchievements',
    summary: 'Achievements',
    description: 'Evaluated from activity and turf facts; nothing stored (evaluateAchievements).',
    security: BEARER_AUTH,
    responses: {
      200: {
        description: 'Every achievement with progress.',
        content: { 'application/json': { schema: AchievementList } },
      },
      ...AUTH_ERRORS,
    },
  });

  registerPlanned(app, {
    method: 'get',
    path: '/v1/me/export',
    tags: ['Privacy'],
    operationId: 'exportMyData',
    summary: 'Export all my data',
    description: 'Everything the server holds about the user, tracks included (GDPR art. 15 and 20).',
    security: BEARER_AUTH,
    responses: {
      200: { description: 'The export.', content: { 'application/json': { schema: DataExport } } },
      ...AUTH_ERRORS,
    },
  });

  registerPlanned(app, {
    method: 'delete',
    path: '/v1/me',
    tags: ['Privacy'],
    operationId: 'deleteMe',
    summary: 'Delete my account and data',
    description:
      'Erases the user and every row they own, tracks included (GDPR art. 17). The phone keeps its own copy.',
    security: BEARER_AUTH,
    responses: { 204: { description: 'Deleted.' }, ...AUTH_ERRORS },
  });
}

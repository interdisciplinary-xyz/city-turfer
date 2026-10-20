import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AchievementList } from '../schemas/achievements';
import { AUTH_ERRORS } from '../schemas/common';
import { defineRoute } from './define';

/** Achievements: evaluated from activity and turf facts. */
export function registerAchievements(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/achievements',
    tags: ['Achievements'],
    operationId: 'listAchievements',
    summary: 'Achievements',
    description: 'Evaluated from activity and turf facts; nothing stored (evaluateAchievements).',
    responses: {
      200: {
        description: 'Every achievement with progress.',
        content: { 'application/json': { schema: AchievementList } },
      },
      ...AUTH_ERRORS,
    },
  });
}

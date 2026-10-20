import type { OpenAPIHono, z } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AUTH_ERRORS, INVALID, problemResponse } from '../schemas/common';
import { ChangesPage, ChangesQuery } from '../schemas/sync';
import { defineRoute, valid } from './define';
import { changeDto } from './dto';

/** Sync: the changes feed every device pulls (use case ListChanges, across contexts). */
export function registerSync(app: OpenAPIHono<AppEnv>): void {
  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/sync/changes',
      tags: ['Sync'],
      operationId: 'listChanges',
      summary: 'Changes since a cursor',
      description: [
        'Upserts, tombstones and Home City choices in server order since `cursor` (use case ListChanges). Without a cursor it lists everything the server holds for the user — the manifest a phone compares with its own history on the first upload. Each activity, tombstone and the Home City appears once, at its latest change.',
        '',
        'Pull on launch, on foreground and after pushing; repeat while `hasMore`. Changes made by the calling device come back too: apply them idempotently (same `version` → nothing to do).',
      ].join('\n'),
      request: { query: ChangesQuery },
      responses: {
        200: { description: 'A page of changes.', content: { 'application/json': { schema: ChangesPage } } },
        ...INVALID,
        ...AUTH_ERRORS,
        410: problemResponse('The cursor is no longer valid: sync again without one.', 'sync.cursor-expired'),
      },
    },
    async (c) => {
      const q = valid<z.infer<typeof ChangesQuery>>(c, 'query');
      const page = await c.var.backup.changes(c.var.userId, q);
      return c.json({ changes: page.changes.map(changeDto), nextCursor: page.nextCursor, hasMore: page.hasMore }, 200);
    }
  );
}

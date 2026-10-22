import type { OpenAPIHono, z } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AUTH_ERRORS, INVALID, problemResponse } from '../schemas/common';
import { ChangesPage, ChangesQuery } from '../schemas/sync';
import { defineRoute, valid } from './define';
import { changeDto } from './dto';

/** A feed page stays near 1 MB (Vercel caps responses at 4.5 MB; phones on mobile data). */
export const MAX_PAGE_BYTES = 1_000_000;

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
        'Upserts, tombstones and Home City choices in server order since `cursor` (use case ListChanges). Without a cursor it lists everything the server holds for the user — the manifest a phone compares with its own history on the first upload. Each activity, tombstone and the Home City appears once, at its latest change. Activity entries carry no geometry: a page ends at `limit` changes or about 1 MB, whichever comes first.',
        '',
        'Pull on launch, on foreground and after pushing; repeat while `hasMore`. Changes made by the calling device come back too: apply them idempotently (same `version` → nothing to do).',
        '',
        '**Restore to a new phone:** page from no cursor (the manifest), then for each activity `GET /v1/activities/{id}` and `GET /v1/activities/{id}/track`; apply tombstones and the Home City.',
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
      const page = await c.var.backup.changes(c.var.userId, q, {
        maxBytes: MAX_PAGE_BYTES,
        sizeOf: (change) => Buffer.byteLength(JSON.stringify(changeDto(change))) + 1,
      });
      return c.json({ changes: page.changes.map(changeDto), nextCursor: page.nextCursor, hasMore: page.hasMore }, 200);
    }
  );
}

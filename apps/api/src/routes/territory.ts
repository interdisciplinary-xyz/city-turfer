import { type OpenAPIHono, z } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import {
  ActivityIdParam,
  AUTH_ERRORS,
  CONSENT_REQUIRED,
  ETAG_HEADER,
  INVALID,
  problemResponse,
} from '../schemas/common';
import { ChooseHomeCityBody, Claim, HomeCity, TurfCells, TurfCellsQuery, TurfSummary } from '../schemas/territory';
import { defineRoute, valid } from './define';
import { homeCityDto, ms } from './dto';

const TAG = ['Territory'];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const IF_NONE_MATCH = z.object({
  'If-None-Match': z
    .string()
    .max(200)
    .optional()
    .openapi({ param: { name: 'If-None-Match', in: 'header' }, description: 'An `ETag` of this route.' }),
});

/** Territory: turf summary, cells and claims (recomputed from tracks), and the Home City. */
export function registerTerritory(app: OpenAPIHono<AppEnv>): void {
  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/turf/summary',
      tags: TAG,
      operationId: 'getTurfSummary',
      summary: 'Turf summary',
      description:
        "Area, cells, strong cells, new in the last 7 and 30 days (rolling, at the server's now, time-zone free), cells per type (use case GetTurfSummary). Recomputed by the server from uploaded tracks; activities not claimed yet (a start in the future, not backfilled) do not count. `Cache-Control: private, no-store`.",
      responses: {
        200: { description: 'The summary.', content: json(TurfSummary) },
        ...AUTH_ERRORS,
      },
    },
    async (c) => c.json(await c.var.turf.summary(c.var.userId), 200)
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/turf/cells',
      tags: TAG,
      operationId: 'getTurfCells',
      summary: 'Download every Turf Cell',
      description: [
        'Every Turf Cell of the user with its visits per type, sorted by cell id, a page at a time (use case ListTurfCells): the web map downloads the whole turf once and draws it locally. No bounding box and no coordinates in the URL — only an opaque cursor.',
        '',
        '- **Pages:** follow `nextCursor` until null. The cursor is bound to `turfVersion`: if the turf changes meanwhile (an upload, a delete), the next page answers `410 turf.changed` — start again without a cursor.',
        '- **Caching:** `Cache-Control: private, no-store`: cells are location data, never stored by a browser or proxy (shared computers). `ETag` names the turf version: a client that keeps the cells itself (in memory) sends it as `If-None-Match` to get `304` (no body) when nothing changed.',
      ].join('\n'),
      request: { query: TurfCellsQuery, headers: IF_NONE_MATCH },
      responses: {
        200: { description: 'A page of cells.', headers: ETAG_HEADER, content: json(TurfCells) },
        304: { description: 'Not modified since the `If-None-Match` version.', headers: ETAG_HEADER },
        ...INVALID,
        ...AUTH_ERRORS,
        410: problemResponse('The turf changed since this cursor: start again without one.', 'turf.changed'),
      },
    },
    async (c) => {
      const q = valid<z.infer<typeof TurfCellsQuery>>(c, 'query');
      const answer = await c.var.turf.cells(c.var.userId, { ...q, ifNoneMatch: c.req.header('if-none-match') });
      c.header('ETag', answer.etag);
      c.header('Cache-Control', 'private, no-store');
      if (answer.notModified) {
        return c.body(null, 304);
      }
      const { turfVersion, total, cells, nextCursor } = answer;
      return c.json({ turfVersion, total, cells, nextCursor }, 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/turf/claims/{activityId}',
      tags: TAG,
      operationId: 'getClaim',
      summary: 'Turf claimed by an activity',
      description:
        'Cells the activity covered and which were new (use case GetClaimForActivity). The Claim is a Territory aggregate keyed by the activity id. "New" is canonical (decision D4: the earliest `(startedAt, activityId)` that covers a cell) and can differ from the phone\'s card, which counts in arrival order. `404 not-found` also when the activity has no claim yet (a start in the future, not backfilled); `410 activity.deleted` after a delete. `Cache-Control: private, no-store`.',
      request: { params: ActivityIdParam },
      responses: {
        200: { description: 'The claim.', content: json(Claim) },
        ...INVALID,
        ...AUTH_ERRORS,
        404: problemResponse('No activity with this id for this user, or no claim for it yet.', 'not-found'),
        410: problemResponse('The activity was deleted (delete wins; no undelete).', 'activity.deleted'),
      },
    },
    async (c) => {
      const { activityId } = valid<z.infer<typeof ActivityIdParam>>(c, 'param');
      return c.json(await c.var.turf.claim(c.var.userId, activityId), 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/turf/home-city',
      tags: TAG,
      operationId: 'getHomeCity',
      summary: 'Home City',
      description:
        'The city the maps open on, or null (use case GetHomeCity). `chosenAt` stays set after a clear (`city: null`).',
      responses: {
        200: { description: 'The Home City.', content: { 'application/json': { schema: HomeCity } } },
        ...AUTH_ERRORS,
      },
    },
    async (c) => c.json(homeCityDto(await c.var.backup.homeCity(c.var.userId)), 200)
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'put',
      path: '/v1/turf/home-city',
      tags: TAG,
      operationId: 'chooseHomeCity',
      summary: 'Choose or clear the Home City',
      description:
        'Only catalogue cities; `cityId: null` clears it (use case ChooseHomeCity). Last write wins on `chosenAt`: an older (or equally old) choice is ignored and the current one returned. Needs the `cloud-sync` consent.',
      request: { body: { required: true, content: { 'application/json': { schema: ChooseHomeCityBody } } } },
      responses: {
        200: { description: 'The Home City now.', content: { 'application/json': { schema: HomeCity } } },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CONSENT_REQUIRED,
        422: problemResponse('Not a catalogue city.', 'home-city.unknown'),
      },
    },
    async (c) => {
      const body = valid<z.infer<typeof ChooseHomeCityBody>>(c, 'json');
      const now = await c.var.backup.chooseHomeCity(c.var.userId, {
        cityId: body.cityId,
        chosenAt: ms(body.chosenAt),
      });
      return c.json(homeCityDto(now), 200);
    }
  );
}

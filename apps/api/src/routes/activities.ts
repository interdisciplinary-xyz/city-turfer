import { type OpenAPIHono, z } from '@hono/zod-openapi';

import type { CompactPoint } from '../backup/model';
import { etagOf } from '../backup/use-cases';
import type { AppEnv } from '../deps';
import {
  ActivityDetail,
  ActivityList,
  ActivityListQuery,
  ActivityRename,
  ActivitySummary,
  ActivityUpload,
  GapRoutesUpload,
  Track,
} from '../schemas/activities';
import {
  ActivityIdParam,
  AUTH_ERRORS,
  CONSENT_REQUIRED,
  ETAG_HEADER,
  IfMatch,
  INVALID,
  LOCATION_HEADER,
  notFound,
  problemResponse,
} from '../schemas/common';
import { defineRoute, valid } from './define';
import { activityDetailDto, activitySummaryDto, ms } from './dto';

const TAG = ['Activity Log'];
const NOT_FOUND = notFound('activity');
const DELETED = { 410: problemResponse('The activity was deleted (delete wins; no undelete).', 'activity.deleted') };
const IF_MATCH = z.object({ 'If-Match': IfMatch });
const json = <T>(schema: T) => ({ 'application/json': { schema } });
type Id = z.infer<typeof ActivityIdParam>;

/** Does an `If-None-Match` header name this entity tag? */
const matchesTag = (header: string | undefined, etag: string) =>
  !!header && header.split(',').some((t) => t.trim().replace(/^W\//, '') === etag);

/** Activity Log: list, upload, detail, rename (planned), delete, track, gap routes. */
export function registerActivities(app: OpenAPIHono<AppEnv>): void {
  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/activities',
      tags: TAG,
      operationId: 'listActivities',
      summary: 'List activities',
      description:
        'Newest first (`startedAt`, then id), paged with an opaque `cursor` (use case ListActivities). Deleted activities are not listed: sync clients read tombstones from `GET /v1/sync/changes`.',
      request: { query: ActivityListQuery },
      responses: {
        200: { description: 'A page of activities.', content: json(ActivityList) },
        ...INVALID,
        ...AUTH_ERRORS,
      },
    },
    async (c) => {
      const q = valid<z.infer<typeof ActivityListQuery>>(c, 'query');
      const page = await c.var.backup.list(c.var.userId, q);
      return c.json({ items: page.items.map(activitySummaryDto), nextCursor: page.nextCursor }, 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'put',
      path: '/v1/activities/{activityId}',
      tags: TAG,
      operationId: 'uploadActivity',
      summary: 'Upload or replace a finished activity',
      description: [
        'Stores the activity with its track under the id the phone minted (use cases ImportActivity and, for a corrected track, CorrectTrack). The server recomputes distance, time and splits from the track with the shared core and computes the canonical `trackHash` (a hash the client sends must match). Needs the `cloud-sync` consent (Apple Health activities also `apple-health-in-cloud-sync`).',
        '',
        '- **New id** → `201` with `ETag` and `Location`.',
        '- **Same content again** (same track, name and fields) → `200`, unchanged: replays are safe.',
        '- **Different content** → send `If-Match` with the current `ETag`: `200` and version + 1; a stale one → `412`, none → `428` (both carry the current `ETag`). A new track drops the stored gap routes: send them again.',
        '- **Deleted id** → `410 activity.deleted`: delete the activity locally too.',
        '',
        '`source` must match the id: `hk-…` ids are `apple-health` and only they may be (else `422 activity.source-mismatch`).',
        '',
        'Bodies are limited to 4.5 MB: send long tracks with `Content-Encoding: gzip`.',
      ].join('\n'),
      request: {
        params: ActivityIdParam,
        headers: IF_MATCH,
        body: { required: true, content: json(ActivityUpload) },
      },
      responses: {
        200: { description: 'Unchanged (replay) or replaced.', headers: ETAG_HEADER, content: json(ActivitySummary) },
        201: {
          description: 'Created.',
          headers: { ...ETAG_HEADER, ...LOCATION_HEADER },
          content: json(ActivitySummary),
        },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CONSENT_REQUIRED,
        ...DELETED,
        412: problemResponse('`If-Match` is stale: pull, re-apply, retry.', 'precondition-failed'),
        413: problemResponse('Body too large, even inflated.', 'payload-too-large'),
        415: problemResponse('Not JSON, or an encoding other than gzip.', 'unsupported-media-type'),
        422: problemResponse(
          'A domain rule was broken.',
          'activity.track-too-short',
          'activity.ends-before-start',
          'activity.invalid-name',
          'activity.track-hash-mismatch',
          'activity.source-mismatch'
        ),
        428: problemResponse('The activity exists with different content: send `If-Match`.', 'precondition-required'),
      },
    },
    async (c) => {
      const { activityId } = valid<Id>(c, 'param');
      const body = valid<z.infer<typeof ActivityUpload>>(c, 'json');
      const { created, activity } = await c.var.backup.upload(
        c.var.userId,
        activityId,
        {
          type: body.type,
          name: body.name,
          source: body.source,
          startedAt: ms(body.startedAt),
          endedAt: ms(body.endedAt),
          timeZone: body.timeZone ?? null,
          resumedSegments: body.resumedSegments,
          trackHash: body.trackHash,
          points: body.track.points as CompactPoint[],
        },
        c.req.header('if-match')
      );
      c.header('ETag', etagOf(activity.version));
      if (created) {
        c.header('Location', `/v1/activities/${encodeURIComponent(activityId)}`);
      }
      return c.json(activitySummaryDto(activity), created ? 201 : 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/activities/{activityId}',
      tags: TAG,
      operationId: 'getActivity',
      summary: 'Activity detail',
      description:
        'Summary, bounding box, km splits, gap routes and when the gaps were checked (use case GetActivityDetail).',
      request: { params: ActivityIdParam },
      responses: {
        200: { description: 'The activity.', headers: ETAG_HEADER, content: json(ActivityDetail) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...NOT_FOUND,
        ...DELETED,
      },
    },
    async (c) => {
      const { activityId } = valid<Id>(c, 'param');
      const { activity, gapRoutes } = await c.var.backup.activity(c.var.userId, activityId);
      c.header('ETag', etagOf(activity.version));
      c.header('Cache-Control', 'private, no-cache');
      return c.json(activityDetailDto(activity, gapRoutes), 200);
    }
  );

  defineRoute(app, {
    status: 'planned',
    method: 'patch',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'renameActivity',
    summary: 'Rename an activity',
    description:
      'Use case RenameActivity. Without `If-Match` the last write wins (decision D6); with it, a stale version answers `412`.',
    request: {
      params: ActivityIdParam,
      headers: IF_MATCH,
      body: { required: true, content: json(ActivityRename) },
    },
    responses: {
      200: { description: 'Renamed; version + 1.', headers: ETAG_HEADER, content: json(ActivitySummary) },
      ...INVALID,
      ...AUTH_ERRORS,
      ...NOT_FOUND,
      ...DELETED,
      412: problemResponse('`If-Match` is stale.', 'precondition-failed'),
      422: problemResponse('Invalid name.', 'activity.invalid-name'),
    },
  });

  defineRoute(
    app,
    {
      status: 'live',
      method: 'delete',
      path: '/v1/activities/{activityId}',
      tags: TAG,
      operationId: 'deleteActivity',
      summary: 'Delete an activity',
      description:
        'Deletes the activity, its track and gap routes, releases its turf (use case DeleteActivity) and leaves a tombstone (the id and when; no personal data): other devices learn it from `GET /v1/sync/changes`, and a later upload of the same id answers `410`. Idempotent: `204` even when already gone or never uploaded. No undelete (D5). Works without the `cloud-sync` consent: it only removes data.',
      request: { params: ActivityIdParam },
      responses: { 204: { description: 'Deleted (or already gone).' }, ...INVALID, ...AUTH_ERRORS },
    },
    async (c) => {
      const { activityId } = valid<Id>(c, 'param');
      await c.var.backup.remove(c.var.userId, activityId);
      return c.body(null, 204);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/activities/{activityId}/track',
      tags: TAG,
      operationId: 'getActivityTrack',
      summary: 'Activity track',
      description:
        'Every track point, compact, as uploaded (use case ActivityTrackQuery). The `ETag` is the `trackHash` in quotes: send it as `If-None-Match` to get `304` when the track has not changed. Personal data: `Cache-Control: private, no-cache`.',
      request: {
        params: ActivityIdParam,
        headers: z.object({
          'If-None-Match': z
            .string()
            .max(80)
            .optional()
            .openapi({ param: { name: 'If-None-Match', in: 'header' }, description: 'A `trackHash` in quotes.' }),
        }),
      },
      responses: {
        200: { description: 'The track.', headers: ETAG_HEADER, content: json(Track) },
        304: { description: 'Not modified since the `If-None-Match` track.' },
        ...INVALID,
        ...AUTH_ERRORS,
        ...NOT_FOUND,
        ...DELETED,
      },
    },
    async (c) => {
      const { activityId } = valid<Id>(c, 'param');
      const { activity, points } = await c.var.backup.track(c.var.userId, activityId);
      const etag = `"${activity.trackHash}"`;
      c.header('ETag', etag);
      c.header('Cache-Control', 'private, no-cache');
      if (matchesTag(c.req.header('if-none-match'), etag)) {
        return c.body(null, 304);
      }
      return c.json({ points }, 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'put',
      path: '/v1/activities/{activityId}/gap-routes',
      tags: TAG,
      operationId: 'saveGapRoutes',
      summary: 'Save the estimated gap routes',
      description:
        'Replaces the street routes the phone estimated across GPS gaps (use case SaveGapRoutes; decision D3) and records that the gaps were checked (`gapsCheckedAt` in the detail). Send an **empty** `routes` list when the phone checked and found no gaps. Display only: they add to distance and moving time and are drawn dashed, never claimed as turf. Idempotent; version + 1 when they changed or the activity had not been checked yet. Needs the `cloud-sync` consent.',
      request: {
        params: ActivityIdParam,
        body: { required: true, content: json(GapRoutesUpload) },
      },
      responses: {
        200: { description: 'Saved.', headers: ETAG_HEADER, content: json(ActivitySummary) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CONSENT_REQUIRED,
        ...NOT_FOUND,
        ...DELETED,
      },
    },
    async (c) => {
      const { activityId } = valid<Id>(c, 'param');
      const body = valid<z.infer<typeof GapRoutesUpload>>(c, 'json');
      const activity = await c.var.backup.saveGapRoutes(c.var.userId, activityId, {
        checkedAt: ms(body.checkedAt),
        routes: body.routes.map((r) => ({ ...r, coords: r.coords.map(([lon, lat]) => [lon, lat]) })),
      });
      c.header('ETag', etagOf(activity.version));
      return c.json(activitySummaryDto(activity), 200);
    }
  );
}

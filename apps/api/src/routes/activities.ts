import { type OpenAPIHono, z } from '@hono/zod-openapi';

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
  ETAG_HEADER,
  IfMatch,
  INVALID,
  LOCATION_HEADER,
  notFound,
  problemResponse,
} from '../schemas/common';
import { Claim } from '../schemas/territory';
import { defineRoute } from './define';

const TAG = ['Activity Log'];
const NOT_FOUND = notFound('activity');
const DELETED = { 410: problemResponse('The activity was deleted (delete wins; no undelete).', 'activity.deleted') };
const IF_MATCH = z.object({ 'If-Match': IfMatch });
const json = <T>(schema: T) => ({ 'application/json': { schema } });

/** Activity Log: list, upload, detail, rename, delete, track, gap routes; and the activity's turf claim. */
export function registerActivities(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
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
  });

  defineRoute(app, {
    status: 'planned',
    method: 'put',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'uploadActivity',
    summary: 'Upload or replace a finished activity',
    description: [
      'Stores the activity with its track under the id the phone minted (use cases ImportActivity and, for a corrected track, CorrectTrack). The server recomputes distance, time, splits and turf from the track with the shared core.',
      '',
      '- **New id** → `201` with `ETag` and `Location`.',
      '- **Same content again** (same `trackHash`, name and fields) → `200`, unchanged: replays are safe.',
      '- **Different content** → send `If-Match` with the current `ETag`: `200` and version + 1; a stale one → `412`, none → `428`.',
      '- **Deleted id** → `410 activity.deleted`: delete the activity locally too.',
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
        'claim.in-future'
      ),
      428: problemResponse('The activity exists with different content: send `If-Match`.', 'precondition-required'),
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'getActivity',
    summary: 'Activity detail',
    description: 'Summary, bounding box, km splits and gap routes (use case GetActivityDetail).',
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The activity.', headers: ETAG_HEADER, content: json(ActivityDetail) },
      ...INVALID,
      ...AUTH_ERRORS,
      ...NOT_FOUND,
      ...DELETED,
    },
  });

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

  defineRoute(app, {
    status: 'planned',
    method: 'delete',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'deleteActivity',
    summary: 'Delete an activity',
    description:
      'Deletes the activity, its track and gap routes, releases its turf (use case DeleteActivity) and leaves a tombstone: other devices learn it from `GET /v1/sync/changes`, and a later upload of the same id answers `410`. Idempotent: `204` even when already gone. No undelete (D5).',
    request: { params: ActivityIdParam },
    responses: { 204: { description: 'Deleted (or already gone).' }, ...INVALID, ...AUTH_ERRORS },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/activities/{activityId}/track',
    tags: TAG,
    operationId: 'getActivityTrack',
    summary: 'Activity track',
    description:
      'Every track point, compact (use case ActivityTrackQuery). The `ETag` is the `trackHash`: send it as `If-None-Match` to get `304` when the track has not changed. Personal data: `Cache-Control: private, no-cache`.',
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
  });

  defineRoute(app, {
    status: 'planned',
    method: 'put',
    path: '/v1/activities/{activityId}/gap-routes',
    tags: TAG,
    operationId: 'saveGapRoutes',
    summary: 'Save the estimated gap routes',
    description:
      'Replaces the street routes the phone estimated across GPS gaps (use case SaveGapRoutes; decision D3). Display only: they add to distance and moving time and are drawn dashed, never claimed as turf. Idempotent; version + 1 when they changed.',
    request: {
      params: ActivityIdParam,
      body: { required: true, content: json(GapRoutesUpload) },
    },
    responses: {
      200: { description: 'Saved.', headers: ETAG_HEADER, content: json(ActivitySummary) },
      ...INVALID,
      ...AUTH_ERRORS,
      ...NOT_FOUND,
      ...DELETED,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/activities/{activityId}/claim',
    tags: ['Territory'],
    operationId: 'getActivityClaim',
    summary: 'Turf claimed by an activity',
    description: 'Cells the activity covered and which were new (use case GetClaimForActivity).',
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The claim.', content: json(Claim) },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });
}

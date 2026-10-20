import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import {
  ActivityDetail,
  ActivityList,
  ActivityListQuery,
  ActivityRename,
  ActivitySummary,
  ActivityUpload,
  Track,
} from '../schemas/activities';
import { ActivityIdParam, AUTH_ERRORS, problemResponse } from '../schemas/common';
import { Claim } from '../schemas/territory';
import { defineRoute } from './define';

const TAG = ['Activity Log'];
const NOT_FOUND = { 404: problemResponse('No activity with this id for this user.') };

/** Activity Log: list, upload, detail, rename, delete, track; and the activity's turf claim. */
export function registerActivities(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/activities',
    tags: TAG,
    operationId: 'listActivities',
    summary: 'List activities',
    description: 'Newest first, paged with `before` (use case ListActivities).',
    request: { query: ActivityListQuery },
    responses: {
      200: { description: 'A page of activities.', content: { 'application/json': { schema: ActivityList } } },
      400: problemResponse('Invalid query.'),
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'put',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'uploadActivity',
    summary: 'Upload a finished activity',
    description:
      'Creates the activity with its track under the id the phone minted, or answers with the stored one if it already exists (idempotent; use case ImportActivity). The server computes distance, time, splits and claims turf from the track. Bodies are limited to 4.5 MB: send gzip (`Content-Encoding: gzip`) for long tracks.',
    request: {
      params: ActivityIdParam,
      body: { required: true, content: { 'application/json': { schema: ActivityUpload } } },
    },
    responses: {
      200: { description: 'Already stored; unchanged.', content: { 'application/json': { schema: ActivitySummary } } },
      201: { description: 'Created.', content: { 'application/json': { schema: ActivitySummary } } },
      400: problemResponse('Invalid body.'),
      ...AUTH_ERRORS,
      409: problemResponse('An activity with this id exists with a different track.'),
      413: problemResponse('Track too large: split the upload.'),
      422: problemResponse('A domain rule was broken (e.g. ends before it starts, track too short).'),
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'getActivity',
    summary: 'Activity detail',
    description: 'Summary, bounding box and km splits (use case GetActivityDetail).',
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The activity.', content: { 'application/json': { schema: ActivityDetail } } },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'patch',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'renameActivity',
    summary: 'Rename an activity',
    description: 'Use case RenameActivity.',
    request: {
      params: ActivityIdParam,
      body: { required: true, content: { 'application/json': { schema: ActivityRename } } },
    },
    responses: {
      200: { description: 'Renamed.', content: { 'application/json': { schema: ActivitySummary } } },
      400: problemResponse('Invalid body.'),
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'delete',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'deleteActivity',
    summary: 'Delete an activity',
    description: 'Deletes the activity and its track and releases its turf (use case DeleteActivity). Idempotent.',
    request: { params: ActivityIdParam },
    responses: { 204: { description: 'Deleted (or already gone).' }, ...AUTH_ERRORS },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/activities/{activityId}/track',
    tags: TAG,
    operationId: 'getActivityTrack',
    summary: 'Activity track',
    description: 'Every track point, compact (use case ActivityTrackQuery). Personal data: never cached publicly.',
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The track.', content: { 'application/json': { schema: Track } } },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
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
      200: { description: 'The claim.', content: { 'application/json': { schema: Claim } } },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });
}

import type { OpenAPIHono } from '@hono/zod-openapi';

import {
  ActivityDetail,
  ActivityList,
  ActivityListQuery,
  ActivityRename,
  ActivitySummary,
  ActivityUpload,
  Track,
} from '../schemas/activities';
import { ActivityIdParam, AUTH_ERRORS, BEARER_AUTH, problemResponse } from '../schemas/common';
import { Claim } from '../schemas/territory';
import { registerPlanned } from './planned';

const TAG = ['Activity Log'];
const NOT_FOUND = { 404: problemResponse('No activity with this id for this user.') };

/** Activity Log: list, upload, detail, rename, delete, track; and the activity's turf claim. */
export function registerActivities(app: OpenAPIHono): void {
  registerPlanned(app, {
    method: 'get',
    path: '/v1/activities',
    tags: TAG,
    operationId: 'listActivities',
    summary: 'List activities',
    description: 'Newest first, paged with `before` (use case ListActivities).',
    security: BEARER_AUTH,
    request: { query: ActivityListQuery },
    responses: {
      200: { description: 'A page of activities.', content: { 'application/json': { schema: ActivityList } } },
      400: problemResponse('Invalid query.'),
      ...AUTH_ERRORS,
    },
  });

  registerPlanned(app, {
    method: 'put',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'uploadActivity',
    summary: 'Upload a finished activity',
    description:
      'Creates the activity with its track under the id the phone minted, or answers with the stored one if it already exists (idempotent; use case ImportActivity). The server computes distance, time, splits and claims turf from the track. Bodies are limited to 4.5 MB: send gzip (`Content-Encoding: gzip`) for long tracks.',
    security: BEARER_AUTH,
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

  registerPlanned(app, {
    method: 'get',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'getActivity',
    summary: 'Activity detail',
    description: 'Summary, bounding box and km splits (use case GetActivityDetail).',
    security: BEARER_AUTH,
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The activity.', content: { 'application/json': { schema: ActivityDetail } } },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });

  registerPlanned(app, {
    method: 'patch',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'renameActivity',
    summary: 'Rename an activity',
    description: 'Use case RenameActivity.',
    security: BEARER_AUTH,
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

  registerPlanned(app, {
    method: 'delete',
    path: '/v1/activities/{activityId}',
    tags: TAG,
    operationId: 'deleteActivity',
    summary: 'Delete an activity',
    description: 'Deletes the activity and its track and releases its turf (use case DeleteActivity). Idempotent.',
    security: BEARER_AUTH,
    request: { params: ActivityIdParam },
    responses: { 204: { description: 'Deleted (or already gone).' }, ...AUTH_ERRORS },
  });

  registerPlanned(app, {
    method: 'get',
    path: '/v1/activities/{activityId}/track',
    tags: TAG,
    operationId: 'getActivityTrack',
    summary: 'Activity track',
    description: 'Every track point, compact (use case ActivityTrackQuery). Personal data: never cached publicly.',
    security: BEARER_AUTH,
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The track.', content: { 'application/json': { schema: Track } } },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });

  registerPlanned(app, {
    method: 'get',
    path: '/v1/activities/{activityId}/claim',
    tags: ['Territory'],
    operationId: 'getActivityClaim',
    summary: 'Turf claimed by an activity',
    description: 'Cells the activity covered and which were new (use case GetClaimForActivity).',
    security: BEARER_AUTH,
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The claim.', content: { 'application/json': { schema: Claim } } },
      ...AUTH_ERRORS,
      ...NOT_FOUND,
    },
  });
}

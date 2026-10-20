import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { ActivityIdParam, AUTH_ERRORS, INVALID, notFound, problemResponse } from '../schemas/common';
import { ChooseHomeCityBody, Claim, HomeCity, TurfCells, TurfCellsQuery, TurfSummary } from '../schemas/territory';
import { defineRoute } from './define';

const TAG = ['Territory'];

/** Territory: turf summary, cells and claims (recomputed from tracks), and the Home City. */
export function registerTerritory(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/turf/summary',
    tags: TAG,
    operationId: 'getTurfSummary',
    summary: 'Turf summary',
    description:
      'Area, cells, strong cells, new in the last 7 and 30 days (rolling, time-zone free), cells per type (use case GetTurfSummary).',
    responses: {
      200: { description: 'The summary.', content: { 'application/json': { schema: TurfSummary } } },
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/turf/cells',
    tags: TAG,
    operationId: 'getTurfCells',
    summary: 'Turf cells in a viewport',
    description:
      'Cells in the bounding box (padded 10%), aggregated to coarser cells past 5,000 features (use case GetTurfInViewport). Cells come without polygons: draw them from the H3 id.',
    request: { query: TurfCellsQuery },
    responses: {
      200: { description: 'The cells.', content: { 'application/json': { schema: TurfCells } } },
      ...INVALID,
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/turf/claims/{activityId}',
    tags: TAG,
    operationId: 'getClaim',
    summary: 'Turf claimed by an activity',
    description:
      'Cells the activity covered and which were new (use case GetClaimForActivity). The Claim is a Territory aggregate keyed by the activity id.',
    request: { params: ActivityIdParam },
    responses: {
      200: { description: 'The claim.', content: { 'application/json': { schema: Claim } } },
      ...INVALID,
      ...AUTH_ERRORS,
      ...notFound('claim'),
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/turf/home-city',
    tags: TAG,
    operationId: 'getHomeCity',
    summary: 'Home City',
    description: 'The city the maps open on, or null (use case GetHomeCity).',
    responses: {
      200: { description: 'The Home City.', content: { 'application/json': { schema: HomeCity } } },
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'put',
    path: '/v1/turf/home-city',
    tags: TAG,
    operationId: 'chooseHomeCity',
    summary: 'Choose or clear the Home City',
    description:
      'Only catalogue cities; `cityId: null` clears it (use case ChooseHomeCity). Last write wins on `chosenAt`: an older choice is ignored and the current one returned.',
    request: { body: { required: true, content: { 'application/json': { schema: ChooseHomeCityBody } } } },
    responses: {
      200: { description: 'The Home City now.', content: { 'application/json': { schema: HomeCity } } },
      ...INVALID,
      ...AUTH_ERRORS,
      422: problemResponse('Not a catalogue city.', 'home-city.unknown'),
    },
  });
}

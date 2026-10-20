import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AUTH_ERRORS, problemResponse } from '../schemas/common';
import {
  ChooseHomeCityBody,
  CityList,
  CitySearchQuery,
  HomeCity,
  TurfCells,
  TurfCellsQuery,
  TurfSummary,
} from '../schemas/territory';
import { defineRoute } from './define';

const TAG = ['Territory'];

/** Territory: turf summary and cells, the city catalogue, the Home City. */
export function registerTerritory(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/turf/summary',
    tags: TAG,
    operationId: 'getTurfSummary',
    summary: 'Turf summary',
    description: 'Area, cells, strong cells, new this week and month, cells per type (use case GetTurfSummary).',
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
      'Cells in the bounding box (padded 10%), aggregated to coarser cells past 5,000 features (use case GetTurfInViewport).',
    request: { query: TurfCellsQuery },
    responses: {
      200: { description: 'The cells.', content: { 'application/json': { schema: TurfCells } } },
      400: problemResponse('Invalid query.'),
      ...AUTH_ERRORS,
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/cities',
    tags: TAG,
    operationId: 'searchCities',
    security: [],
    summary: 'Search the city catalogue',
    description:
      'Accent-insensitive search of the bundled catalogue ("krakow" finds Kraków); public (use case SearchCities).',
    request: { query: CitySearchQuery },
    responses: {
      200: { description: 'Matching cities, best first.', content: { 'application/json': { schema: CityList } } },
      400: problemResponse('Invalid query.'),
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/me/home-city',
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
    path: '/v1/me/home-city',
    tags: TAG,
    operationId: 'chooseHomeCity',
    summary: 'Choose the Home City',
    description: 'Only catalogue cities (use case ChooseHomeCity).',
    request: { body: { required: true, content: { 'application/json': { schema: ChooseHomeCityBody } } } },
    responses: {
      200: { description: 'Chosen.', content: { 'application/json': { schema: HomeCity } } },
      400: problemResponse('Invalid body.'),
      ...AUTH_ERRORS,
      422: problemResponse('Not a catalogue city (`home-city.unknown`).'),
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'delete',
    path: '/v1/me/home-city',
    tags: TAG,
    operationId: 'clearHomeCity',
    summary: 'Clear the Home City',
    description: 'Use case ChooseHomeCity(null). Idempotent.',
    responses: { 204: { description: 'Cleared.' }, ...AUTH_ERRORS },
  });
}

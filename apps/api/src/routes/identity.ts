import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { AUTH_ERRORS, INVALID, problemResponse } from '../schemas/common';
import { Session, SignInBody, User } from '../schemas/identity';
import { defineRoute } from './define';

const TAG = ['Identity'];

/** Identity: sign in (mock), sign out, the current user. Use cases SignIn, SignOut, GetCurrentUser. */
export function registerIdentity(app: OpenAPIHono<AppEnv>): void {
  defineRoute(app, {
    status: 'planned',
    method: 'post',
    path: '/v1/auth/sign-in',
    tags: TAG,
    operationId: 'signIn',
    security: [],
    'x-cityturfer-env': 'dev',
    summary: 'Sign in (mock, dev only)',
    description:
      'Exchanges the mock `admin` credentials for a bearer token on local and preview servers only; production never seeds that account (decision D8). Better Auth brings its own sign-in endpoints later (D7).',
    request: { body: { required: true, content: { 'application/json': { schema: SignInBody } } } },
    responses: {
      200: { description: 'Signed in.', content: { 'application/json': { schema: Session } } },
      ...INVALID,
      401: problemResponse('Wrong email or password.', 'auth.invalid'),
      429: AUTH_ERRORS[429],
    },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'delete',
    path: '/v1/auth/session',
    tags: TAG,
    operationId: 'signOut',
    summary: 'Sign out',
    description: 'Revokes the current token (use case SignOut).',
    responses: { 204: { description: 'Signed out.' }, ...AUTH_ERRORS },
  });

  defineRoute(app, {
    status: 'planned',
    method: 'get',
    path: '/v1/me',
    tags: TAG,
    operationId: 'getMe',
    summary: 'Current user',
    description: 'Use case GetCurrentUser. Consents, export and erasure live under Privacy.',
    responses: {
      200: { description: 'The signed-in user.', content: { 'application/json': { schema: User } } },
      ...AUTH_ERRORS,
    },
  });
}

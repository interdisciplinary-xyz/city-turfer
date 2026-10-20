import type { OpenAPIHono } from '@hono/zod-openapi';

import { AUTH_ERRORS, BEARER_AUTH, problemResponse } from '../schemas/common';
import { Session, SignInBody, User } from '../schemas/identity';
import { registerPlanned } from './planned';

const TAG = ['Identity'];

/** Identity: sign in, sign out, the current user. Use cases SignIn, SignOut, GetCurrentUser. */
export function registerIdentity(app: OpenAPIHono): void {
  registerPlanned(app, {
    method: 'post',
    path: '/v1/auth/sign-in',
    tags: TAG,
    operationId: 'signIn',
    security: [],
    summary: 'Sign in',
    description: 'Exchanges credentials for a bearer token. Mock `admin` account first; Better Auth later.',
    request: { body: { required: true, content: { 'application/json': { schema: SignInBody } } } },
    responses: {
      200: { description: 'Signed in.', content: { 'application/json': { schema: Session } } },
      400: problemResponse('Invalid body.'),
      401: problemResponse('Wrong email or password.'),
    },
  });

  registerPlanned(app, {
    method: 'delete',
    path: '/v1/auth/session',
    tags: TAG,
    operationId: 'signOut',
    summary: 'Sign out',
    description: 'Revokes the current token.',
    security: BEARER_AUTH,
    responses: { 204: { description: 'Signed out.' }, ...AUTH_ERRORS },
  });

  registerPlanned(app, {
    method: 'get',
    path: '/v1/me',
    tags: TAG,
    operationId: 'getMe',
    summary: 'Current user',
    security: BEARER_AUTH,
    responses: {
      200: { description: 'The signed-in user.', content: { 'application/json': { schema: User } } },
      ...AUTH_ERRORS,
    },
  });
}

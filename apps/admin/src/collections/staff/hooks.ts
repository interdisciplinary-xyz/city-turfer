import {
  AuthenticationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeLoginHook,
  type CollectionBeforeOperationHook,
  Forbidden,
} from 'payload';

/** `req.context` flag set only by scripts/staff-create.ts (the Local API, run by the founder). */
export const STAFF_BOOTSTRAP = 'staffBootstrap';

/**
 * - No staff account is created without a signed-in staff admin, except by the staff:create script.
 *   This closes Payload's public "create first user" form on an empty database: on a fresh deploy
 *   anyone reaching /admin first could otherwise make themselves staff. (REST cannot set
 *   `req.context`, so the flag cannot be sent from outside.)
 * - No "forgot password" e-mail: there is no e-mail adapter, the endpoint is public, and Payload's
 *   console fallback would log the staff address. A staff admin resets a password instead.
 */
export const guardStaffOperations: CollectionBeforeOperationHook = ({ operation, req, args }) => {
  if (operation === 'create' && !req.user && req.context?.[STAFF_BOOTSTRAP] !== true) {
    throw new Forbidden(req.t);
  }
  if (operation === 'forgotPassword') {
    throw new Forbidden(req.t);
  }
  return args;
};

/**
 * A disabled staff member cannot sign in. Same error as a wrong password: this hook runs after the
 * password check, so a different message would confirm the password. (An open session stops at the
 * next request: access.ts.)
 */
export const refuseDisabledLogin: CollectionBeforeLoginHook = ({ user, req }) => {
  if ((user as { disabled?: boolean | null }).disabled) {
    throw new AuthenticationError(req.t);
  }
  return user;
};

/** Disabling someone ends their sessions, so re-enabling them later doesn't revive old ones. */
export const endSessionsOnDisable: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === 'update' && data.disabled === true && !originalDoc?.disabled) {
    return { ...data, sessions: [] };
  }
  return data;
};

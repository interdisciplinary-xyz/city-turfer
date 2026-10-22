import type { Access, FieldAccess } from 'payload';

import { STAFF_SLUG, type StaffRole } from './roles';

/** The fields of `req.user` these rules read; Payload's user type is wider. */
interface StaffLike {
  id: number | string;
  collection?: string;
  roles?: readonly StaffRole[] | null;
  disabled?: boolean | null;
}

type MaybeUser = StaffLike | null | undefined;

/** A signed-in, not disabled member of the staff collection. Anything else gets nothing. */
export function isActiveStaff(user: MaybeUser): user is StaffLike {
  return Boolean(user && user.collection === STAFF_SLUG && !user.disabled);
}

export function hasRole(user: MaybeUser, role: StaffRole): boolean {
  return isActiveStaff(user) && (user.roles ?? []).includes(role);
}

const canManageStaff = (user: MaybeUser) => hasRole(user, 'staff-admin');

/** Opening the admin panel at all. */
export const staffPanelAccess = ({ req }: { req: { user?: MaybeUser } }): boolean => isActiveStaff(req.user);

/** Staff admins read everyone; other staff only themselves; anyone else nothing. */
export const readStaff: Access = ({ req }) => {
  if (canManageStaff(req.user)) {
    return true;
  }
  return isActiveStaff(req.user) ? { id: { equals: req.user.id } } : false;
};

/** Staff accounts are made by staff admins (or the staff:create script, see hooks.ts). */
export const manageStaff: Access = ({ req }) => canManageStaff(req.user);

/** Staff admins edit anyone; other staff only themselves (password), never their roles (field rule). */
export const updateStaff: Access = ({ req }) => {
  if (canManageStaff(req.user)) {
    return true;
  }
  return isActiveStaff(req.user) ? { id: { equals: req.user.id } } : false;
};

/**
 * Staff admins delete other staff, never their own account. (Two admins can still remove each other
 * or a last admin can drop their own role: recovery is the staff:create script.)
 */
export const deleteStaff: Access = ({ req }) =>
  canManageStaff(req.user) ? { id: { not_equals: req.user!.id } } : false;

/** Roles and the disabled flag: only a staff admin sets them. */
export const staffAdminField: FieldAccess = ({ req }) => canManageStaff(req.user);

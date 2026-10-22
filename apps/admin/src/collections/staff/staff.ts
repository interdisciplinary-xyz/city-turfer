import type { CollectionConfig } from 'payload';

import { deleteStaff, manageStaff, readStaff, staffAdminField, staffPanelAccess, updateStaff } from './access';
import { endSessionsOnDisable, guardStaffOperations, refuseDisabledLogin } from './hooks';
import { STAFF_ROLES, STAFF_SLUG } from './roles';

const TWO_HOURS_S = 2 * 60 * 60;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Staff accounts: the only people who can open admin. They live in admin's own database and are
 * never CityTurfer users. MFA (decision AD3: SSO with provider MFA, or local login plus TOTP) is
 * still open; until it is decided, this local login must not be deployed.
 *
 * Also before a deploy (AD3, from the PR #139 review), all stock Payload auth behaviour:
 * - the 5-try lockout answers differently for a real staff e-mail, so anyone can confirm staff
 *   addresses and keep one locked out: the plan's IP allowlist or a rate limit in front;
 * - `tokenExpiration` is an idle timeout (refresh moves it), not an absolute session cap;
 * - staff change their own password and e-mail without re-entering the current password.
 */
export const Staff: CollectionConfig = {
  slug: STAFF_SLUG,
  labels: { singular: 'Staff member', plural: 'Staff' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'roles', 'disabled', 'updatedAt'],
  },
  auth: {
    tokenExpiration: TWO_HOURS_S,
    maxLoginAttempts: 5,
    lockTime: FIFTEEN_MINUTES_MS,
    useAPIKey: false,
    // Host-only (no `domain`), so it never meets the web portal's cookie; Strict, Secure on HTTPS.
    cookies: { sameSite: 'Strict', secure: process.env.NODE_ENV === 'production' },
  },
  // No document locks: Payload's internal payload-locked-documents collection allows any signed-in
  // user (a disabled one too); with no lockable collection Payload leaves it out.
  lockDocuments: false,
  access: {
    admin: staffPanelAccess,
    read: readStaff,
    create: manageStaff,
    update: updateStaff,
    delete: deleteStaff,
    unlock: manageStaff,
    readVersions: () => false,
  },
  hooks: {
    beforeOperation: [guardStaffOperations],
    beforeChange: [endSessionsOnDisable],
    beforeLogin: [refuseDisabledLogin],
  },
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['support-read'],
      options: STAFF_ROLES.map((role) => ({ label: role, value: role })),
      access: { create: staffAdminField, update: staffAdminField },
    },
    {
      name: 'disabled',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'A disabled staff member cannot sign in; an open session stops at once.' },
      access: { create: staffAdminField, update: staffAdminField },
    },
  ],
};

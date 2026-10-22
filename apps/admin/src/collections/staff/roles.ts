/**
 * Staff roles. `staff-admin` is Payload-only: it manages staff accounts here. The others name the
 * API's admin roles (docs/plans/admin-portal-2026-10-22.md, "Admin routes on the API"); once the
 * staff assertion exists, the API grants the intersection of these and its own `admin_staff` roles,
 * so a role set here alone never opens user data.
 */
export const STAFF_ROLES = [
  'staff-admin',
  'support-read',
  'support-write',
  'support-erase',
  'ops-read',
  'audit-read',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_SLUG = 'staff';

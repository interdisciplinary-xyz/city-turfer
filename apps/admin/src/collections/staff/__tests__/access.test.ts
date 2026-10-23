import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';

import {
  deleteStaff,
  hasRole,
  isActiveStaff,
  manageStaff,
  readStaff,
  staffAdminField,
  staffPanelAccess,
  updateStaff,
} from '../access';

const admin = { id: 1, collection: 'staff', roles: ['staff-admin' as const], disabled: false };
const support = { id: 2, collection: 'staff', roles: ['support-read' as const], disabled: false };
const disabledAdmin = { ...admin, id: 3, disabled: true };
const otherCollection = { id: 4, collection: 'users', roles: ['staff-admin'] };

const args = (user: unknown) => ({ req: { user } as unknown as PayloadRequest });
const fieldArgs = (user: unknown) => ({ req: { user } as unknown as PayloadRequest, data: {}, siblingData: {} });

describe('staff access', () => {
  it('only an active member of the staff collection counts as staff', () => {
    expect(isActiveStaff(admin)).toBe(true);
    expect(isActiveStaff(support)).toBe(true);
    for (const u of [null, undefined, disabledAdmin, otherCollection]) {
      expect(isActiveStaff(u as never)).toBe(false);
    }
    expect(hasRole(disabledAdmin as never, 'staff-admin')).toBe(false);
  });

  it('refuses everything to a signed-out visitor, a disabled staff member and a non-staff user', () => {
    for (const u of [null, disabledAdmin, otherCollection]) {
      expect(staffPanelAccess(args(u))).toBe(false);
      expect(readStaff(args(u))).toBe(false);
      expect(manageStaff(args(u))).toBe(false);
      expect(updateStaff(args(u))).toBe(false);
      expect(deleteStaff(args(u))).toBe(false);
      expect(staffAdminField(fieldArgs(u))).toBe(false);
    }
  });

  it('lets support staff see and edit only themselves, never their roles', () => {
    expect(staffPanelAccess(args(support))).toBe(true);
    expect(readStaff(args(support))).toEqual({ id: { equals: 2 } });
    expect(updateStaff(args(support))).toEqual({ id: { equals: 2 } });
    expect(manageStaff(args(support))).toBe(false);
    expect(deleteStaff(args(support))).toBe(false);
    expect(staffAdminField(fieldArgs(support))).toBe(false);
  });

  it('lets a staff admin manage everyone except deleting themselves', () => {
    expect(readStaff(args(admin))).toBe(true);
    expect(updateStaff(args(admin))).toBe(true);
    expect(manageStaff(args(admin))).toBe(true);
    expect(staffAdminField(fieldArgs(admin))).toBe(true);
    expect(deleteStaff(args(admin))).toEqual({ id: { not_equals: 1 } });
  });
});

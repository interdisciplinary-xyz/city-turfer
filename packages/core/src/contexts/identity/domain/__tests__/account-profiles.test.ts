import { AccountProfiles } from '../account-profiles';
import { isNeverAdopted, userId } from '../user';

const ADMIN = userId('admin');
const DEMO = userId('demo');
const ADMIN_EMAIL = 'admin@cityturfer.com';
const DEMO_EMAIL = 'demo@cityturfer.com';

describe('AccountProfiles.linkOwn (a local profile linked to its own address)', () => {
  it('links the account of the profile’s own address, trimmed and case-insensitive, and signs it in', () => {
    const p = AccountProfiles.empty();
    p.linkOwn({ id: 'u1', email: 'Admin@CityTurfer.com' }, ADMIN, ` ${ADMIN_EMAIL} `);
    expect(p.toState()).toEqual({
      entries: [{ accountId: 'u1', email: 'Admin@CityTurfer.com', profileId: 'admin', deleted: false }],
      current: 'u1',
    });
  });

  it('refuses another address', () => {
    const p = AccountProfiles.empty();
    expect(() => p.linkOwn({ id: 'u1', email: 'founder@example.com' }, ADMIN, ADMIN_EMAIL)).toThrow(
      'account.email-mismatch'
    );
    expect(p.toState()).toEqual({ entries: [], current: null });
  });

  it('refuses a profile another address holds: adopted, or a deleted account’s kept data', () => {
    const adopted = AccountProfiles.empty();
    adopted.link({ id: 'u1', email: 'founder@example.com' }, ADMIN);
    expect(() => adopted.linkOwn({ id: 'u2', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL)).toThrow(
      'account.profile-taken'
    );

    adopted.accountDeleted('u1', true);
    expect(() => adopted.linkOwn({ id: 'u2', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL)).toThrow(
      'account.profile-taken'
    );
  });

  it('refuses an account whose data already lives in another profile here', () => {
    const p = AccountProfiles.empty();
    p.link({ id: 'u1', email: ADMIN_EMAIL }, userId('a-u1'));
    expect(() => p.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL)).toThrow('account.linked-elsewhere');
  });

  it('linking again is a no-op; a newer account of the same address replaces the older one', () => {
    const p = AccountProfiles.empty();
    p.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL);
    const once = p.toState();
    p.signedOut();
    p.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL);
    expect(p.toState()).toEqual(once);

    // The server lost the account (or it was deleted elsewhere): the code proves the same mailbox.
    p.linkOwn({ id: 'u2', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL);
    expect(p.toState().entries).toEqual([{ accountId: 'u2', email: ADMIN_EMAIL, profileId: 'admin', deleted: false }]);
  });

  it('links the demo profile to its own address only', () => {
    const p = AccountProfiles.empty();
    expect(() => p.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, DEMO, DEMO_EMAIL)).toThrow('account.email-mismatch');
    p.linkOwn({ id: 'u1', email: DEMO_EMAIL }, DEMO, DEMO_EMAIL);
    expect(p.profileOf('u1')).toBe('demo');
    // The same account signing in again (code) re-enters it; nobody else does.
    p.link({ id: 'u1', email: DEMO_EMAIL }, DEMO);
    expect(() => p.link({ id: 'u2', email: 'ola@example.com' }, DEMO)).toThrow('account.never-adopted');
  });
});

describe('the password of a local profile (LP2)', () => {
  it('still opens it linked to its own address; not once another address adopted it', () => {
    const own = AccountProfiles.empty();
    own.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL);
    expect(own.opensWithPassword(ADMIN, ADMIN_EMAIL)).toBe(true);
    own.accountDeleted('u1', true);
    expect(own.opensWithPassword(ADMIN, ADMIN_EMAIL)).toBe(true);

    const adopted = AccountProfiles.empty();
    adopted.link({ id: 'u1', email: 'founder@example.com' }, ADMIN);
    expect(adopted.opensWithPassword(ADMIN, ADMIN_EMAIL)).toBe(false);
    expect(adopted.linkableToOwnEmail(ADMIN, ADMIN_EMAIL)).toBe(false);
    expect(adopted.opensWithPassword(DEMO, DEMO_EMAIL)).toBe(true);
  });

  it('stops opening it once the linked account moves to another address', () => {
    const p = AccountProfiles.empty();
    p.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL);
    p.emailChanged('u1', 'founder@example.com');
    expect(p.opensWithPassword(ADMIN, ADMIN_EMAIL)).toBe(false);
  });
});

describe('the demo profile is never placed for another account', () => {
  it('neither asked nor chosen, whatever its history', () => {
    expect(isNeverAdopted('demo')).toBe(true);
    expect(isNeverAdopted('admin')).toBe(false);
    const p = AccountProfiles.empty();
    p.linkOwn({ id: 'u1', email: ADMIN_EMAIL }, ADMIN, ADMIN_EMAIL);
    const other = { id: 'u2', email: 'ola@example.com' };
    expect(p.placementFor(other, true)).toEqual({ kind: 'known', profileId: 'a-u2' });
    expect(p.chosenProfile(other, true)).toBe('a-u2');
    expect(() => p.link(other, DEMO)).toThrow('account.never-adopted');
  });
});

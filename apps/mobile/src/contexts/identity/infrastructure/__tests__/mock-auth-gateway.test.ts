import { userId } from '@cityturfer/core/identity/ports';

import { MockAuthGateway } from '../mock-auth-gateway';

describe('MockAuthGateway', () => {
  it('knows the two local profiles by e-mail and by id', () => {
    const g = new MockAuthGateway();
    expect(g.localProfileOf({ value: 'admin@cityturfer.com' })).toBe('admin');
    expect(g.localProfileOf({ value: 'demo@cityturfer.com' })).toBe('demo');
    expect(g.localProfileOf({ value: 'ola@example.com' })).toBeNull();
    expect(g.localEmailOf('admin')).toEqual({ value: 'admin@cityturfer.com' });
    expect(g.localEmailOf('demo')).toEqual({ value: 'demo@cityturfer.com' });
    expect(g.localEmailOf('a-u1')).toBeNull();
  });

  it('gives each local profile its default name (kept by the profile once linked for backup)', async () => {
    const g = new MockAuthGateway();
    expect(await g.userById(userId('admin'))).toMatchObject({ name: 'Admin' });
    expect(await g.userById(userId('demo'))).toMatchObject({ name: 'Ola' });
  });

  it('takes its local profiles from the constructor', async () => {
    const user = { id: userId('solo'), email: 'solo@example.com', displayName: 'Solo' };
    const g = new MockAuthGateway([{ password: 'pw', user }]);
    expect(g.localProfileOf({ value: 'admin@cityturfer.com' })).toBeNull();
    expect(g.localEmailOf('solo')).toEqual({ value: 'solo@example.com' });
    expect(await g.signIn({ value: 'solo@example.com' }, 'pw')).toEqual({ kind: 'signed-in', user });
    expect(await g.userById(userId('admin'))).toBeNull();
  });
});

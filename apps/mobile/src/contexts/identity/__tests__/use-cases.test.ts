import type { SessionStore } from '@cityturfer/core/identity/ports';

import { createIdentityApi } from '..';
import { MockAuthGateway } from '../infrastructure/mock-auth-gateway';

function memoryStore(initial: string | null = null) {
  let id = initial;
  const store: SessionStore & { value: () => string | null } = {
    read: async () => id as never,
    write: async (v) => void (id = v),
    clear: async () => void (id = null),
    value: () => id,
  };
  return store;
}

function setup(opts: { stored?: string | null; recording?: boolean } = {}) {
  const sessions = memoryStore(opts.stored ?? null);
  let recording = opts.recording ?? false;
  const api = createIdentityApi({ auth: new MockAuthGateway(), sessions }, async () => recording);
  return { api, sessions, setRecording: (r: boolean) => void (recording = r) };
}

describe('SignIn', () => {
  it('signs the mock account in and remembers it', async () => {
    const { api, sessions } = setup();
    const r = await api.signIn.execute('admin@cityturfer.com', 'admin1234');
    expect(r).toEqual({ kind: 'signed-in', user: expect.objectContaining({ id: 'admin' }) });
    expect(sessions.value()).toBe('admin');
  });

  it('signs the Gdańsk demo account in with its own user id (own database)', async () => {
    const { api, sessions } = setup();
    const r = await api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(r).toEqual({ kind: 'signed-in', user: expect.objectContaining({ id: 'demo', displayName: 'Ola' }) });
    expect(sessions.value()).toBe('demo');
    expect(await api.signIn.execute('demo@cityturfer.com', 'admin1234')).toEqual({ kind: 'invalid-credentials' });
  });

  it('trims and lower-cases the email', async () => {
    const { api } = setup();
    expect((await api.signIn.execute('  Admin@CityTurfer.COM ', 'admin1234')).kind).toBe('signed-in');
  });

  it('rejects a wrong password without remembering anyone', async () => {
    const { api, sessions } = setup();
    expect(await api.signIn.execute('admin@cityturfer.com', 'admin12345')).toEqual({ kind: 'invalid-credentials' });
    expect(await api.signIn.execute('admin@cityturfer.com', 'ADMIN1234')).toEqual({ kind: 'invalid-credentials' });
    expect(sessions.value()).toBeNull();
  });

  it('rejects an unknown account', async () => {
    const { api } = setup();
    expect(await api.signIn.execute('someone@cityturfer.com', 'admin1234')).toEqual({ kind: 'invalid-credentials' });
  });

  it.each(['', 'admin', 'admin@', 'admin@cityturfer', 'a b@c.de'])('reports %j as an invalid email', async (raw) => {
    const { api, sessions } = setup();
    expect(await api.signIn.execute(raw, 'admin1234')).toEqual({ kind: 'invalid-email' });
    expect(sessions.value()).toBeNull();
  });
});

describe('GetCurrentUser', () => {
  it('returns the remembered user', async () => {
    const { api } = setup({ stored: 'admin' });
    expect(await api.currentUser.execute()).toEqual(expect.objectContaining({ id: 'admin', displayName: 'Admin' }));
  });

  it('returns null when nobody is signed in', async () => {
    expect(await setup().api.currentUser.execute()).toBeNull();
  });

  it('returns null for a stale id the gateway no longer knows', async () => {
    expect(await setup({ stored: 'deleted-user' }).api.currentUser.execute()).toBeNull();
  });
});

describe('SignOut', () => {
  it('is refused while a Recording Session is active, and keeps the user signed in', async () => {
    const { api, sessions } = setup({ stored: 'admin', recording: true });
    expect(await api.signOut.execute()).toEqual({ kind: 'recording-in-progress' });
    expect(sessions.value()).toBe('admin');
  });

  it('forgets the user once no session is active', async () => {
    const { api, sessions, setRecording } = setup({ stored: 'admin', recording: true });
    setRecording(false);
    expect(await api.signOut.execute()).toEqual({ kind: 'signed-out' });
    expect(sessions.value()).toBeNull();
    expect(await api.currentUser.execute()).toBeNull();
  });
});

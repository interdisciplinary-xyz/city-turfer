import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { deleteAccountMutation, revokeSessionsMutation, signOutMutation } from '../account-mutations';
import { createPortalClient } from '../client';
import { portalApi } from '../portal-api';

type Answer = 'network' | number;

const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ type: `https://cityturfer.app/problems/${code}`, title: 'x', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

const CODES: Record<number, string> = {
  401: 'auth.invalid',
  403: 'auth.csrf',
  500: 'internal',
  503: 'storage.unavailable',
};

/** A real API client over a fake fetch, the client's own 401 handler, and a spy for `leave`. */
function setup(answer: Answer) {
  const leave = vi.fn();
  const onUnauthorized = vi.fn();
  const client = createPortalClient({
    onUnauthorized,
    baseUrl: 'https://cityturfer.test/api',
    fetch: async () => {
      if (answer === 'network') {
        throw new TypeError('Failed to fetch');
      }
      return answer === 204 ? new Response(null, { status: 204 }) : problem(answer, CODES[answer]);
    },
  });
  const queryClient = new QueryClient();
  return { api: portalApi(client), leave, onUnauthorized, queryClient };
}

async function run<V>(
  options: ConstructorParameters<typeof MutationObserver<unknown, never, V>>[1],
  queryClient: QueryClient,
  variables: V
) {
  const observer = new MutationObserver(queryClient, options as never);
  await observer.mutate(variables as never).catch(() => undefined);
}

describe('sign out', () => {
  it.each([204, 401] as const)('leaves on %s', async (answer) => {
    const { api, leave, queryClient } = setup(answer);
    await run(signOutMutation({ api, leave }), queryClient, undefined);
    expect(leave).toHaveBeenCalledWith('signed-out');
  });

  it.each(['network', 403, 500, 503] as const)('stays signed in on %s', async (answer) => {
    const { api, leave, queryClient } = setup(answer);
    await run(signOutMutation({ api, leave }), queryClient, undefined);
    expect(leave).not.toHaveBeenCalled();
  });
});

describe('sign out everywhere (scope=all)', () => {
  it('leaves on 204', async () => {
    const { api, leave, queryClient } = setup(204);
    await run(revokeSessionsMutation({ api, leave, queryClient }), queryClient, 'all');
    expect(leave).toHaveBeenCalledWith('signed-out');
  });

  it('a 401 goes to sign-in through the client, not as "signed out"', async () => {
    const { api, leave, onUnauthorized, queryClient } = setup(401);
    await run(revokeSessionsMutation({ api, leave, queryClient }), queryClient, 'all');
    expect(onUnauthorized).toHaveBeenCalledWith('auth.invalid');
    expect(leave).not.toHaveBeenCalled();
  });

  it.each(['network', 403, 500] as const)('stays on %s', async (answer) => {
    const { api, leave, onUnauthorized, queryClient } = setup(answer);
    await run(revokeSessionsMutation({ api, leave, queryClient }), queryClient, 'all');
    expect(leave).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('scope=others never leaves', async () => {
    const { api, leave, queryClient } = setup(204);
    await run(revokeSessionsMutation({ api, leave, queryClient }), queryClient, 'others');
    expect(leave).not.toHaveBeenCalled();
  });
});

describe('delete account', () => {
  it('leaves with "deleted" on 204', async () => {
    const { api, leave, queryClient } = setup(204);
    await run(deleteAccountMutation({ api, leave }), queryClient, undefined);
    expect(leave).toHaveBeenCalledWith('deleted');
  });

  it.each(['network', 403, 500] as const)('stays on %s (nothing was erased)', async (answer) => {
    const { api, leave, queryClient } = setup(answer);
    await run(deleteAccountMutation({ api, leave }), queryClient, undefined);
    expect(leave).not.toHaveBeenCalled();
  });
});

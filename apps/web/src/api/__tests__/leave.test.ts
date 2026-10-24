import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createPortalClient } from '../client';
import { createLeave, leaveOnUnauthorized, reloadOnRestore } from '../leave';
import { portalApi } from '../portal-api';

/** A fake `window.location`: records every replace and reload. */
function fakeLocation(pathname = '/en/account/privacy', search = '') {
  const replaced: string[] = [];
  let reloads = 0;
  return {
    location: {
      pathname,
      search,
      replace: (url: string | URL) => {
        replaced.push(String(url));
      },
      reload: () => {
        reloads += 1;
      },
    },
    replaced,
    reloads: () => reloads,
  };
}

/** A query client already holding personal data, as a signed-in page would. */
function filledCache() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['me'], { email: 'walker@e2e.cityturfer.test' });
  return queryClient;
}

describe('createLeave', () => {
  it('clears the cache, then replaces the page with sign-in (reason, no next)', () => {
    const queryClient = filledCache();
    const fake = fakeLocation();
    const leave = createLeave({ queryClient, locale: 'en', location: () => fake.location });
    leave('signed-out');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(fake.replaced).toEqual(['/en/account/sign-in?reason=signed-out']);
  });

  it('returnHere adds the current portal path as a validated next', () => {
    const fake = fakeLocation('/pl/account/privacy');
    createLeave({ queryClient: filledCache(), locale: 'pl', location: () => fake.location })('expired', {
      returnHere: true,
    });
    expect(fake.replaced).toEqual(['/pl/account/sign-in?next=%2Fpl%2Faccount%2Fprivacy&reason=expired']);
  });

  it('returnHere keeps an activity id, and drops any other query', () => {
    const activity = fakeLocation('/en/account/activity', '?id=abc-1');
    createLeave({ queryClient: filledCache(), locale: 'en', location: () => activity.location })('expired', {
      returnHere: true,
    });
    expect(activity.replaced).toEqual([
      '/en/account/sign-in?next=%2Fen%2Faccount%2Factivity%3Fid%3Dabc-1&reason=expired',
    ]);
    const other = fakeLocation('/en/account/activities', '?lat=52.2');
    createLeave({ queryClient: filledCache(), locale: 'en', location: () => other.location })('expired', {
      returnHere: true,
    });
    expect(other.replaced).toEqual(['/en/account/sign-in?next=%2Fen%2Faccount%2Factivities&reason=expired']);
  });

  it('never carries a path outside the portal as next', () => {
    const fake = fakeLocation('/en/account/../../evil');
    createLeave({ queryClient: filledCache(), locale: 'en', location: () => fake.location })(null, {
      returnHere: true,
    });
    expect(fake.replaced).toEqual(['/en/account/sign-in']);
  });

  it('acts once only', () => {
    const fake = fakeLocation();
    const leave = createLeave({ queryClient: filledCache(), locale: 'en', location: () => fake.location });
    leave('expired', { returnHere: true });
    leave('signed-out');
    leave('deleted');
    expect(fake.replaced).toHaveLength(1);
  });

  it('reads the location only when leaving', () => {
    let reads = 0;
    const fake = fakeLocation();
    const leave = createLeave({
      queryClient: filledCache(),
      locale: 'en',
      location: () => {
        reads += 1;
        return fake.location;
      },
    });
    expect(reads).toBe(0);
    leave(null);
    expect(reads).toBe(1);
  });
});

describe('a 401 through the real client', () => {
  const problem = (code: string) =>
    new Response(JSON.stringify({ type: `https://cityturfer.app/problems/${code}`, title: 'x', status: 401, code }), {
      status: 401,
      headers: { 'Content-Type': 'application/problem+json' },
    });

  function setup(code: string, pathname = '/en/account') {
    const queryClient = filledCache();
    const fake = fakeLocation(pathname);
    const leave = createLeave({ queryClient, locale: 'en', location: () => fake.location });
    const client = createPortalClient({
      onUnauthorized: leaveOnUnauthorized(leave),
      baseUrl: 'https://cityturfer.test/api',
      fetch: async () => problem(code),
    });
    return { api: portalApi(client), queryClient, fake };
  }

  it('an ended session (auth.invalid) clears the cache and returns here with "expired"', async () => {
    const { api, queryClient, fake } = setup('auth.invalid', '/en/account/privacy');
    await api.me().catch(() => undefined);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(fake.replaced).toEqual(['/en/account/sign-in?next=%2Fen%2Faccount%2Fprivacy&reason=expired']);
  });

  it('no session yet (auth.missing) goes to sign-in without a notice', async () => {
    const { api, fake } = setup('auth.missing');
    await api.me().catch(() => undefined);
    expect(fake.replaced).toEqual(['/en/account/sign-in']);
  });

  it('many 401s at once leave once', async () => {
    const { api, fake } = setup('auth.invalid');
    await Promise.all([api.me(), api.me(), api.me()].map((call) => call.catch(() => undefined)));
    expect(fake.replaced).toHaveLength(1);
  });
});

describe('reloadOnRestore', () => {
  it('a page restored from the back/forward cache forgets its data and reloads', () => {
    const queryClient = filledCache();
    const fake = fakeLocation();
    reloadOnRestore({ queryClient, location: fake.location })({ persisted: true });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(fake.reloads()).toBe(1);
  });

  it('a normal page load does nothing', () => {
    const queryClient = filledCache();
    const fake = fakeLocation();
    reloadOnRestore({ queryClient, location: fake.location })({ persisted: false });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    expect(fake.reloads()).toBe(0);
  });
});

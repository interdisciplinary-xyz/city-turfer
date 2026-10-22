/**
 * The web portal in the sync chain: signs in and calls the API exactly as the portal's client does
 * (apps/web/src/api on the web-portal branch), and reads only what its pages show. No browser: the
 * pages render these answers, and the portal's own tests cover the rendering.
 *
 * Browser sessions are contract 0.5.0 (web portal Slice 0). Against an API without them the sign-in
 * returns no session cookie, and every check reports pending.
 */
import { deviceIp, LIVE_CODE, retryAfterWait } from './chain-server';
import type { Pending } from './pending';

/** The API refuses browser writes from any other origin (WEB_ORIGIN; the dev server's default). */
const WEB_ORIGIN = process.env.CITYTURFER_WEB_ORIGIN ?? 'https://cityturfer.local';
const WEB_HEADERS = { Origin: WEB_ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'CityTurfer-Client': 'web/chain-test' };
const COOKIE = /__Secure-ct_session=([^;]*)/;

export interface Device {
  id: string;
  client: 'phone' | 'browser';
  current: boolean;
}

/** What the Privacy & data page's backup panel shows (from the consents). */
export interface BackupPanel {
  backup: 'never' | 'on' | 'withdrawn';
  health: boolean;
}

export interface WebPortal {
  /** The account panel (GET /v1/me): e-mail and name; null once the session is gone. */
  account(): Promise<{ email: string | null; name: string | null } | null>;
  backupPanel(): Promise<BackupPanel>;
  /** The signed-in devices panel. */
  devices(): Promise<Device[]>;
  signedIn(): Promise<boolean>;
  /** True once the API has told the browser to drop its cookie (sign-out, revoke, erasure, 401). */
  cookieCleared(): boolean;
  signOut(): Promise<number>;
  signOutDevice(id: string): Promise<number>;
  signOutEverywhere(scope: 'others' | 'all'): Promise<number>;
  deleteAccount(): Promise<number>;
  /** "Export my data": the status code (202 started, 429 once a day). */
  requestExport(): Promise<number>;
}

export async function webSignIn(base: string, address: string): Promise<WebPortal | Pending> {
  const ip = { 'x-real-ip': deviceIp() };
  const requestCode = async () => {
    const res = await fetch(`${base}/v1/auth/codes`, {
      method: 'POST',
      headers: { ...WEB_HEADERS, ...ip, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address }),
    });
    return res.status === 429
      ? { kind: 'rate-limited', retryAfterS: Number(res.headers.get('Retry-After') ?? 60) }
      : { kind: res.status < 300 ? 'sent' : `status ${res.status}` };
  };
  const sent = await retryAfterWait(requestCode);
  if (sent.kind !== 'sent') {
    throw new Error(`web code request failed: ${sent.kind}`);
  }
  const signIn = await fetch(`${base}/v1/auth/sign-in`, {
    method: 'POST',
    headers: { ...WEB_HEADERS, ...ip, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, code: LIVE_CODE, client: 'browser' }),
  });
  const value = COOKIE.exec(signIn.headers.get('set-cookie') ?? '')?.[1];
  if (signIn.status !== 200 || !value) {
    return { pending: `browser sign-in by cookie is not on this API (answer ${signIn.status}; web portal #141)` };
  }

  let cookie: string | null = value;
  const call = async (method: string, path: string): Promise<Response> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...ip,
        ...(method === 'GET' ? {} : WEB_HEADERS),
        ...(cookie ? { Cookie: `__Secure-ct_session=${cookie}` } : {}),
      },
    });
    if (/__Secure-ct_session=;/.test(res.headers.get('set-cookie') ?? '')) {
      cookie = null;
    }
    return res;
  };
  const json = async <T>(path: string): Promise<T> => {
    const res = await call('GET', path);
    if (!res.ok) {
      throw new Error(`web GET ${path} → ${res.status}`);
    }
    return (await res.json()) as T;
  };

  return {
    async account() {
      const res = await call('GET', '/v1/me');
      if (res.status === 401) {
        return null;
      }
      const me = (await res.json()) as { email: string | null; name?: string | null };
      return { email: me.email, name: me.name ?? null };
    },
    async backupPanel() {
      const { items } = await json<{ items: { purpose: string; granted: boolean }[] }>('/v1/me/consents');
      const sync = items.find((x) => x.purpose === 'cloud-sync');
      const health = items.find((x) => x.purpose === 'apple-health-in-cloud-sync');
      return { backup: !sync ? 'never' : sync.granted ? 'on' : 'withdrawn', health: health?.granted ?? false };
    },
    async devices() {
      const { sessions } = await json<{ sessions: Device[] }>('/v1/auth/sessions');
      return sessions.map(({ id, client, current }) => ({ id, client, current }));
    },
    async signedIn() {
      return (await call('GET', '/v1/me')).status === 200;
    },
    cookieCleared: () => cookie == null,
    signOut: async () => (await call('DELETE', '/v1/auth/session')).status,
    signOutDevice: async (id) => (await call('DELETE', `/v1/auth/sessions/${encodeURIComponent(id)}`)).status,
    signOutEverywhere: async (scope) => (await call('DELETE', `/v1/auth/sessions?scope=${scope}`)).status,
    deleteAccount: async () => (await call('DELETE', '/v1/me')).status,
    requestExport: async () => (await call('POST', '/v1/me/exports')).status,
  };
}

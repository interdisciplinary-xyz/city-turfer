/**
 * The web portal in the sync chain: signs in and calls the API exactly as the portal's client does
 * (apps/web/src/api), and reads only what its pages show. No browser: the pages render these
 * answers, and the portal's own tests cover the rendering.
 *
 * Slice 0 (built) shows the account, the backup consents and the signed-in devices. Slice 1 (the
 * map and activity pages, next) reads the activities, the totals and every turf cell; those reads
 * are here already, with the browser's cookie, so the data the pages will draw is checked against
 * the phone before the pages exist.
 *
 * Browser sessions are contract 0.5.0. Against an API without them the sign-in returns no session
 * cookie, and every check reports pending.
 */
import { deviceIp, LIVE_CODE } from './chain-server';
import { isPending, type Pending } from './pending';
import { retryAfterWait } from './retry';
import {
  type ActivityTotals,
  type CellCounts,
  readActivities,
  readTotals,
  readTurfCells,
  readTurfSummary,
  type ServerActivityView,
  type TurfSummary,
} from './server-reads';

/** The API refuses browser writes from any other origin (WEB_ORIGIN; the dev server's default). */
const WEB_ORIGIN = process.env.CITYTURFER_WEB_ORIGIN ?? 'https://cityturfer.local';
const WEB_HEADERS = { Origin: WEB_ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'CityTurfer-Client': 'web/chain-test' };
/** The browser session cookie (apps/api/src/session-cookie.ts). */
const COOKIE_NAME = '__Host-ct_session';
const COOKIE = new RegExp(`${COOKIE_NAME}=([^;]*)`);

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
  /** Slice 1 reads, with the browser's cookie: the activities list and the totals. */
  activities(): Promise<ServerActivityView[]>;
  totals(): Promise<ActivityTotals | Pending>;
  /** Slice 1 reads: the turf summary and every cell the map draws. */
  turfSummary(): Promise<TurfSummary | Pending>;
  turfCells(): Promise<CellCounts[] | Pending>;
  /** `Cache-Control` of the turf cells answer (a shared computer must keep no copy on disk). */
  turfCellsCacheControl(): Promise<string | null | Pending>;
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
  if (!value) {
    // Pending only when the API has no browser sessions: it ignores `client` and signs in a phone
    // (200 with a token in the body), or has no such route. Anything else is a real failure.
    const body = (await signIn.json().catch(() => null)) as { token?: unknown } | null;
    const phoneSession = signIn.status === 200 && typeof body?.token === 'string';
    if (phoneSession || signIn.status === 404 || signIn.status === 501) {
      return { pending: `browser sign-in by cookie is not on this API (answer ${signIn.status})` };
    }
    throw new Error(
      `browser sign-in failed: ${signIn.status} (check CITYTURFER_WEB_ORIGIN against the API's WEB_ORIGIN and the fixed code)`
    );
  }

  let cookie: string | null = value;
  const call = async (method: string, path: string): Promise<Response> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...ip,
        ...(method === 'GET' ? {} : WEB_HEADERS),
        ...(cookie ? { Cookie: `${COOKIE_NAME}=${cookie}` } : {}),
      },
    });
    if ((res.headers.get('set-cookie') ?? '').includes(`${COOKIE_NAME}=;`)) {
      cookie = null;
    }
    return res;
  };
  const get = (path: string) => call('GET', path);
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
    activities: () => readActivities(get),
    totals: () => readTotals(get),
    turfSummary: () => readTurfSummary(get),
    async turfCells() {
      const read = await readTurfCells(get);
      return isPending(read) ? read : read.cells;
    },
    async turfCellsCacheControl() {
      const read = await readTurfCells(get);
      return isPending(read) ? read : read.cacheControl;
    },
  };
}

import { routePattern, type ScrubbableBreadcrumb, scrubBreadcrumb } from './scrub-breadcrumb';
import { scrubText } from './scrub-text';

/**
 * The parts of an error-tracking event the scrubber reads or drops, typed structurally so core
 * needs no SDK: a Sentry `ErrorEvent` (React Native, Node, browser) is assignable to it. Fields it
 * does not name (sdk, debug_meta, threads, stack frames…) pass through untouched.
 */
export interface ScrubbableEvent {
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: ScrubbableException[] };
  transaction?: string;
  tags?: { [key: string]: unknown };
  contexts?: { [key: string]: unknown };
  extra?: { [key: string]: unknown };
  breadcrumbs?: ScrubbableBreadcrumb[];
  request?: unknown;
  user?: unknown;
  server_name?: string;
}

export interface ScrubbableException {
  type?: string;
  value?: string;
}

/** Tag `area` of reports from Apple Health code: the report keeps the error's name and code only. */
export const HEALTH_SYNC_AREA = 'health-sync';

/**
 * Contexts a report keeps: the device, OS, app, runtime and release-like (OTA update) facts that
 * make a crash reproducible. Everything else (culture with the time zone, trace, custom contexts) goes.
 */
export const ALLOWED_CONTEXTS: readonly string[] = [
  'os',
  'device',
  'app',
  'runtime',
  'react_native_context',
  'ota_updates',
  'expo_updates',
];

/** Device fields that could name the owner ("Anna's iPhone"). */
const DEVICE_PERSONAL = ['name'];

/** Tags a health-sync report keeps (ours, plus the SDK's origin and environment tags). */
const HEALTH_TAGS = new Set(['area', 'code', 'event.origin', 'event.environment']);

const isRecord = (x: unknown): x is { [key: string]: unknown } => typeof x === 'object' && x !== null;

function scrubTags(tags: { [key: string]: unknown }, keep: (key: string) => boolean): { [key: string]: unknown } {
  const out: { [key: string]: unknown } = {};
  for (const [key, value] of Object.entries(tags)) {
    if (keep(key)) {
      out[key] = typeof value === 'string' ? scrubText(value) : value;
    }
  }
  return out;
}

function scrubContexts(contexts: { [key: string]: unknown }): { [key: string]: unknown } {
  const out: { [key: string]: unknown } = {};
  for (const key of ALLOWED_CONTEXTS) {
    const value = contexts[key];
    if (value === undefined) {
      continue;
    }
    if (key === 'device' && isRecord(value)) {
      const device = { ...value };
      for (const field of DEVICE_PERSONAL) {
        delete device[field];
      }
      out[key] = device;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Before an error report leaves the device or server: no request (body, headers, query, cookies),
 * no user, no extra, no server name, only the allowed contexts; URLs lose their query (router and
 * tile URLs keep only their host) and coordinates are redacted in the message, exception values,
 * tags and breadcrumbs; the transaction (a route) becomes its pattern. Stack frames are left as they are (symbolication needs them).
 * A report tagged `area: 'health-sync'` keeps only the error's name and its `code` tag: no message,
 * no breadcrumbs. Returns a new event; never throws on odd shapes.
 */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out: E = { ...event };
  delete out.request;
  delete out.user;
  delete out.extra;
  delete out.server_name;

  const health = isRecord(event.tags) && event.tags.area === HEALTH_SYNC_AREA;
  const code = health && typeof event.tags?.code === 'string' ? event.tags.code : undefined;

  if (isRecord(event.contexts)) {
    out.contexts = scrubContexts(event.contexts);
  }
  if (isRecord(event.tags)) {
    out.tags = scrubTags(event.tags, health ? (k) => HEALTH_TAGS.has(k) : () => true);
  }
  if (typeof event.transaction === 'string') {
    out.transaction = routePattern(event.transaction);
  }

  if (health) {
    delete out.message;
    delete out.logentry;
    delete out.breadcrumbs;
  } else {
    if (typeof event.message === 'string') {
      out.message = scrubText(event.message);
    }
    if (isRecord(event.logentry)) {
      const { message } = event.logentry;
      out.logentry = typeof message === 'string' ? { message: scrubText(message) } : {};
    }
    if (Array.isArray(event.breadcrumbs)) {
      out.breadcrumbs = event.breadcrumbs.flatMap((b) => {
        const kept = isRecord(b) ? scrubBreadcrumb(b) : null;
        return kept ? [kept] : [];
      });
    }
  }

  if (isRecord(event.exception) && Array.isArray(event.exception.values)) {
    out.exception = {
      ...event.exception,
      values: event.exception.values.map((ex) => {
        if (!isRecord(ex)) {
          return ex;
        }
        const copy = { ...ex };
        if (health) {
          if (code !== undefined) {
            copy.value = code;
          } else {
            delete copy.value;
          }
        } else if (typeof ex.value === 'string') {
          copy.value = scrubText(ex.value);
        }
        return copy;
      }),
    };
  }
  return out;
}

import enAccount from '../../messages/en/account.json';
import enAchievements from '../../messages/en/achievements.json';
import enActivity from '../../messages/en/activity.json';
import enActivityNames from '../../messages/en/activityNames.json';
import enBackup from '../../messages/en/backup.json';
import enCities from '../../messages/en/cities.json';
import enCommon from '../../messages/en/common.json';
import enDashboard from '../../messages/en/dashboard.json';
import enErrors from '../../messages/en/errors.json';
import enHealth from '../../messages/en/health.json';
import enInfo from '../../messages/en/info.json';
import enMe from '../../messages/en/me.json';
import enNav from '../../messages/en/nav.json';
import enProfile from '../../messages/en/profile.json';
import enRecord from '../../messages/en/record.json';
import enSignIn from '../../messages/en/signIn.json';
import enStats from '../../messages/en/stats.json';
import enTurf from '../../messages/en/turf.json';
import plAccount from '../../messages/pl/account.json';
import plAchievements from '../../messages/pl/achievements.json';
import plActivity from '../../messages/pl/activity.json';
import plActivityNames from '../../messages/pl/activityNames.json';
import plBackup from '../../messages/pl/backup.json';
import plCities from '../../messages/pl/cities.json';
import plCommon from '../../messages/pl/common.json';
import plDashboard from '../../messages/pl/dashboard.json';
import plErrors from '../../messages/pl/errors.json';
import plHealth from '../../messages/pl/health.json';
import plInfo from '../../messages/pl/info.json';
import plMe from '../../messages/pl/me.json';
import plNav from '../../messages/pl/nav.json';
import plProfile from '../../messages/pl/profile.json';
import plRecord from '../../messages/pl/record.json';
import plSignIn from '../../messages/pl/signIn.json';
import plStats from '../../messages/pl/stats.json';
import plTurf from '../../messages/pl/turf.json';
import { DEFAULT_LOCALE, type Locale, LOCALES } from './locales';

/*
 * The message catalogue: apps/mobile/messages/<locale>/<namespace>.json (L5). Metro bundles only
 * static imports, so every file is listed here; a new namespace is one line per locale. English is
 * the source: its shape types the keys (`useT('common')('cancel')`).
 */
const SOURCE = {
  common: enCommon,
  signIn: enSignIn,
  account: enAccount,
  backup: enBackup,
  errors: enErrors,
  record: enRecord,
  turf: enTurf,
  activity: enActivity,
  achievements: enAchievements,
  activityNames: enActivityNames,
  cities: enCities,
  health: enHealth,
  nav: enNav,
  dashboard: enDashboard,
  stats: enStats,
  info: enInfo,
  profile: enProfile,
  me: enMe,
};
export type Messages = typeof SOURCE;
export type Namespace = keyof Messages;

type Catalogue = { [N in Namespace]: Record<string, unknown> };
const RAW: Record<Locale, Catalogue> = {
  en: SOURCE,
  pl: {
    common: plCommon,
    signIn: plSignIn,
    account: plAccount,
    backup: plBackup,
    errors: plErrors,
    record: plRecord,
    turf: plTurf,
    activity: plActivity,
    achievements: plAchievements,
    activityNames: plActivityNames,
    cities: plCities,
    health: plHealth,
    nav: plNav,
    dashboard: plDashboard,
    stats: plStats,
    info: plInfo,
    profile: plProfile,
    me: plMe,
  },
};

type Tree = { [key: string]: string | Tree };
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `base` with every message `over` has replaced; keys only `base` has stay (the English fallback). */
function overlay(base: Tree, over: unknown, path: string, missing: string[]): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(base)) {
    const o = isTree(over) ? over[k] : undefined;
    if (isTree(v)) {
      out[k] = overlay(v, o, `${path}.${k}`, missing);
    } else if (typeof o === 'string' && o !== '') {
      out[k] = o;
    } else {
      out[k] = v;
      missing.push(`${path}.${k}`);
    }
  }
  return out;
}

/**
 * Every locale's messages with English under them, built once: a key a locale lacks shows the
 * English message (formatted with its values) instead of a raw key. audit:i18n keeps this empty
 * in CI; in development the gaps are reported once at launch.
 */
export const MESSAGES: Record<Locale, Messages> = Object.fromEntries(
  LOCALES.map((locale) => {
    const missing: string[] = [];
    const merged = Object.fromEntries(
      Object.entries(SOURCE).map(([ns, base]) => [ns, overlay(base as Tree, RAW[locale][ns as Namespace], ns, missing)])
    );
    if (__DEV__ && locale !== DEFAULT_LOCALE && missing.length > 0) {
      console.warn(`[i18n] ${locale} lacks ${missing.length} message(s), showing English: ${missing.join(', ')}`);
    }
    return [locale, merged];
  })
) as unknown as Record<Locale, Messages>;

/** The English text of `namespace.key` (dotted), or undefined. */
export function sourceMessage(path: string): string | undefined {
  let node: unknown = SOURCE;
  for (const part of path.split('.')) {
    node = isTree(node) ? node[part] : undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

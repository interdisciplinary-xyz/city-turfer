/**
 * Text scrubbing for error reports: query strings off URLs, router and tile URLs down to their
 * host, and anything that looks like a coordinate replaced. Pure string work (no URL class: React
 * Native's URL polyfill cannot read a host), so it runs the same on the phone and on the server.
 */

export const REDACTED_PAIR = '[coords]';
export const REDACTED_COORD = '[coord]';

/** Hosts whose paths carry coordinates (street routers): only the host survives. */
const ROUTER_HOSTS = /(^|\.)(routing\.openstreetmap\.de|router\.project-osrm\.org)$|osrm/i;

/** A map-tile path (`/z/x/y`): it locates the viewer to a few hundred metres. */
const TILE_PATH = /\/\d{1,2}\/\d+\/\d+(\D|$)/;

const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>()[\]{}`]+/gi;
const URL_PARTS = /^([a-z][a-z0-9+.-]*:\/\/)(?:[^@/?#]*@)?([^/?#]*)([^?#]*)/i;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/** Two decimals in lat/lon range next to each other: "54.352,18.654", "[18.65, 54.35]", "54.35 18.65". */
const PAIR = /(^|[^\d.])(-?\d{1,3}\.\d{2,})(\s*[,;]\s*|\s+)(-?\d{1,3}\.\d{2,})(?![\d.])/g;
/** A decimal named as a coordinate: lat=54.35, "longitude":18.654, startLng: 18.65. */
const NAMED = /(lat|lng|lon|latitude|longitude|coords?|coordinates?)(\W{1,4}?)(-?\d{1,3}\.\d{2,})(?![\d.])/gi;
/** A lone decimal with GPS precision (5+ places, ~1 m): almost never anything but a coordinate. */
const PRECISE = /(^|[^\d.])(-?\d{1,3}\.\d{5,})(?![\d.])/g;

const inRange = (s: string, max: number) => Math.abs(Number(s)) <= max;

/** Replaces coordinate-looking numbers (pairs, named values, GPS-precision decimals). */
export function redactCoordinates(text: string): string {
  return text
    .replace(PAIR, (all, pre: string, a: string, _sep: string, b: string) =>
      inRange(a, 180) && inRange(b, 180) && (inRange(a, 90) || inRange(b, 90)) ? pre + REDACTED_PAIR : all
    )
    .replace(NAMED, (all, name: string, sep: string, n: string) =>
      inRange(n, 180) ? name + sep + REDACTED_COORD : all
    )
    .replace(PRECISE, (all, pre: string, n: string) => (inRange(n, 180) ? pre + REDACTED_COORD : all));
}

/**
 * One URL without credentials, query or fragment; a router or tile URL (coordinates in its path)
 * becomes its scheme and host only.
 */
export function scrubUrl(url: string): string {
  const m = URL_PARTS.exec(url);
  if (!m) {
    return url.replace(/[?#].*$/, '');
  }
  const [, scheme, host, path] = m;
  if (ROUTER_HOSTS.test(host) || TILE_PATH.test(path)) {
    return scheme + host;
  }
  return scheme + host + path;
}

/** Every URL in a text scrubbed (scrubUrl), then coordinates redacted. */
export function scrubText(text: string): string {
  const urls = text.replace(URL_IN_TEXT, (found) => {
    const tail = TRAILING_PUNCTUATION.exec(found)?.[0] ?? '';
    return scrubUrl(found.slice(0, found.length - tail.length)) + tail;
  });
  return redactCoordinates(urls);
}

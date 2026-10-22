import { isIP } from 'node:net';

/**
 * The per-IP rate-limit bucket of a client address. An IPv6 client usually holds a whole /64 and
 * can use a fresh address per request, so IPv6 is bucketed by its /64 prefix; an IPv4-mapped IPv6
 * address counts as its IPv4. Anything that does not parse (the local `unknown`) is its own bucket.
 */
export function ipBucket(ip: string): string {
  const raw = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (mapped && isIP(mapped[1]) === 4) {
    return mapped[1];
  }
  if (isIP(raw) !== 6) {
    return raw;
  }
  const hextets = expandIpv6(raw);
  return `${hextets
    .slice(0, 4)
    .map((h) => parseInt(h, 16).toString(16))
    .join(':')}::/64`;
}

/** The eight hextets of a valid IPv6 address (`::` expanded, a trailing dotted quad converted). */
function expandIpv6(ip: string): string[] {
  let address = ip;
  const quad = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (quad) {
    const [a, b, c, d] = quad.slice(1).map(Number);
    address = `${address.slice(0, quad.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail === undefined ? [] : tail ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right];
}

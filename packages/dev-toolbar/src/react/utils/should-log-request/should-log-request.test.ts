import { describe, expect, it } from 'vitest';

import { shouldLogRequest } from './should-log-request';

const at = (href: string) => new URL(href, 'https://myapp.local');

describe('shouldLogRequest', () => {
  it.each(['/api/users/by-slug/jane', '/api/health?x=1', 'https://identitytoolkit.googleapis.com/v1/accounts:lookup'])(
    'logs %s',
    (href) => {
      expect(shouldLogRequest(at(href))).toBe(true);
    }
  );

  it.each([
    '/_next/static/chunks/main.js',
    '/__nextjs_original-stack-frames',
    '/__dev/request-log?since=4',
    '/pl/pricing?_rsc=1a2b3',
    '/_next/static/webpack/abc.webpack.hot-update.json',
    'data:text/plain,hi',
    'blob:https://myapp.local/1234',
  ])('skips %s', (href) => {
    expect(shouldLogRequest(at(href))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { parseSignInReason, safeNextPath, signInHref, signInUrl } from '../next-path';

describe('safeNextPath', () => {
  it.each(['/en/account', '/pl/account', '/en/account/activities', '/en/account/activities/abc-123/'])(
    'accepts the portal path %s',
    (path) => {
      expect(safeNextPath(path, 'en')).toBe(path.replace(/\/$/, ''));
    }
  );

  it.each([
    'https://evil.example/en/account',
    '//evil.example/en/account',
    '/\\evil.example',
    '/en/account/../../evil',
    '/en/account/%2e%2e/x',
    '/en/account?lat=52.2',
    '/en/account#52.2,21.0',
    '/en',
    '/de/account',
    '/en/accounting',
    '/en/account/sign-in',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('falls back to the portal home for %s', (path) => {
    expect(safeNextPath(path, 'pl')).toBe('/pl/account');
  });
});

describe('signInUrl', () => {
  it('adds a validated next and the reason', () => {
    expect(signInUrl('en', { next: '/en/account/activities', reason: 'expired' })).toBe(
      '/en/account/sign-in?next=%2Fen%2Faccount%2Factivities&reason=expired'
    );
  });

  it('drops a next that is the portal home or unsafe', () => {
    expect(signInUrl('en', { next: '/en/account' })).toBe('/en/account/sign-in');
    expect(signInUrl('en', { next: 'https://evil.example' })).toBe('/en/account/sign-in');
  });
});

it('parseSignInReason knows only its own words', () => {
  expect(parseSignInReason('deleted')).toBe('deleted');
  expect(parseSignInReason('<script>')).toBeNull();
  expect(parseSignInReason(null)).toBeNull();
});

it('signInHref is the sign-in page below the locale, keeping a validated next and reason', () => {
  expect(signInHref('pl', { next: '/en/account/activities', reason: 'expired' })).toBe(
    '/account/sign-in?next=%2Fen%2Faccount%2Factivities&reason=expired'
  );
  expect(signInHref('pl', { next: '//evil.example', reason: null })).toBe('/account/sign-in');
  expect(signInHref('en')).toBe('/account/sign-in');
});

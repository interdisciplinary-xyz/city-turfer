import { describe, expect, it } from 'vitest';

import {
  INITIAL_RATE_LIMIT_STATE,
  onAttempt,
  onBlockEnded,
  onFailure,
  secondsUntil,
} from '../../app/[locale]/account/_portal/sign-in-form/sign-in-form.constants';
import { PortalError } from '../errors';

const NOW = 1_000_000;
const limited = (seconds: number) => new PortalError('auth.rate-limited', { status: 429, retryAfterSeconds: seconds });
const wrongCode = new PortalError('auth.invalid-code', { status: 400 });

describe('sign-in rate limits', () => {
  it('a 429 on resend blocks only asking for a code, not signing in', () => {
    const state = onFailure(INITIAL_RATE_LIMIT_STATE, 'code', limited(40), NOW);
    expect(state.blocks).toEqual({ code: NOW + 40_000, 'sign-in': null });
    expect(state.failure?.action).toBe('code');
  });

  it('a 429 on sign-in blocks only signing in', () => {
    const state = onFailure(INITIAL_RATE_LIMIT_STATE, 'sign-in', limited(60), NOW);
    expect(state.blocks).toEqual({ code: null, 'sign-in': NOW + 60_000 });
  });

  it('an error without Retry-After blocks nothing', () => {
    const state = onFailure(INITIAL_RATE_LIMIT_STATE, 'sign-in', wrongCode, NOW);
    expect(state.blocks).toEqual({ code: null, 'sign-in': null });
    expect(state.failure?.error).toBe(wrongCode);
  });

  it('a later failure keeps the other block', () => {
    const resend = onFailure(INITIAL_RATE_LIMIT_STATE, 'code', limited(40), NOW);
    const signIn = onFailure(onAttempt(resend), 'sign-in', wrongCode, NOW + 1000);
    expect(signIn.blocks.code).toBe(NOW + 40_000);
    expect(signIn.failure?.error).toBe(wrongCode);
  });

  it('a new attempt clears the alert but not the blocks', () => {
    const state = onAttempt(onFailure(INITIAL_RATE_LIMIT_STATE, 'code', limited(40), NOW));
    expect(state.failure).toBeNull();
    expect(state.blocks.code).toBe(NOW + 40_000);
  });

  it('when its block ends, the rate-limit alert gives way to "you can try again"', () => {
    const ended = onBlockEnded(onFailure(INITIAL_RATE_LIMIT_STATE, 'code', limited(40), NOW), 'code');
    expect(ended).toEqual({ blocks: { code: null, 'sign-in': null }, failure: null, canRetry: true });
  });

  it("another action's alert stays when a block ends", () => {
    const resend = onFailure(INITIAL_RATE_LIMIT_STATE, 'code', limited(40), NOW);
    const signIn = onFailure(onAttempt(resend), 'sign-in', wrongCode, NOW + 1000);
    const ended = onBlockEnded(signIn, 'code');
    expect(ended.blocks.code).toBeNull();
    expect(ended.failure?.error).toBe(wrongCode);
    expect(ended.canRetry).toBe(false);
  });

  it('ending a block that is not set changes nothing', () => {
    expect(onBlockEnded(INITIAL_RATE_LIMIT_STATE, 'sign-in')).toBe(INITIAL_RATE_LIMIT_STATE);
  });
});

it('secondsUntil rounds up and stops at 0', () => {
  expect(secondsUntil(null, NOW)).toBe(0);
  expect(secondsUntil(NOW + 40_000, NOW)).toBe(40);
  expect(secondsUntil(NOW + 1, NOW)).toBe(1);
  expect(secondsUntil(NOW, NOW)).toBe(0);
  expect(secondsUntil(NOW - 5000, NOW)).toBe(0);
});

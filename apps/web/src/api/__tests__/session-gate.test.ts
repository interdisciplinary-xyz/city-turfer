import { describe, expect, it } from 'vitest';

import { gateView } from '../../app/[locale]/account/_portal/session-gate/session-gate.constants';
import { PortalError } from '../errors';

const offline = new PortalError('unreachable');
const resting = new PortalError('storage.unavailable', { status: 503, retryAfterSeconds: 30 });
const tooMany = new PortalError('rate-limited', { status: 429, retryAfterSeconds: 40 });
const broken = new PortalError('generic', { status: 500, requestId: 'req_1' });
const signedOut = new PortalError('signed-out', { status: 401 });

describe('gateView', () => {
  it('checks before the first answer', () => {
    expect(gateView({ hasData: false, error: null })).toEqual({ kind: 'checking' });
  });

  it('shows the page once /v1/me has answered', () => {
    expect(gateView({ hasData: true, error: null })).toEqual({ kind: 'page', refreshFailed: null });
  });

  it.each([offline, resting, tooMany, broken])(
    'keeps the page when a background refetch fails (%s), with a notice',
    (error) => {
      expect(gateView({ hasData: true, error })).toEqual({ kind: 'page', refreshFailed: error });
    }
  );

  it('leaves on a 401, even with data from before', () => {
    expect(gateView({ hasData: true, error: signedOut })).toEqual({ kind: 'leaving' });
    expect(gateView({ hasData: false, error: signedOut })).toEqual({ kind: 'leaving' });
  });

  it('says "can\'t reach" only when the backup is out of reach', () => {
    expect(gateView({ hasData: false, error: offline })).toEqual({ kind: 'unreachable', error: offline });
    expect(gateView({ hasData: false, error: resting })).toEqual({ kind: 'unreachable', error: resting });
  });

  it('shows the error itself (with its wait) for a 429 or 500 without data', () => {
    expect(gateView({ hasData: false, error: tooMany })).toEqual({ kind: 'error', error: tooMany });
    expect(gateView({ hasData: false, error: broken })).toEqual({ kind: 'error', error: broken });
  });
});

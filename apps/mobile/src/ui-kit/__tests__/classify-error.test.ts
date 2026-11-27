import { RouterRateLimited, RouterUnreachable } from '@cityturfer/core/activity-log';

import { DomainError } from '@/shared-kernel';

import { classifyError, ExpectedFailure } from '../classify-error';

describe('classifyError', () => {
  it('a stated failure keeps its message and code', () => {
    expect(classifyError(new ExpectedFailure('share.error.share', 'share-unavailable'))).toEqual({
      expected: true,
      reason: 'stated',
      code: 'share-unavailable',
      message: 'share.error.share',
    });
  });

  it('a broken business rule is expected, with its code', () => {
    expect(classifyError(new DomainError('backup.on'))).toEqual({
      expected: true,
      reason: 'domain',
      code: 'backup.on',
    });
    // From another copy of the class (a second bundle): by name.
    const foreign = Object.assign(new Error('x'), { name: 'DomainError', code: 'email.invalid' });
    expect(classifyError(foreign)).toEqual({ expected: true, reason: 'domain', code: 'email.invalid' });
  });

  it.each([
    ['fetch without a connection', new TypeError('Network request failed')],
    ['an abort', Object.assign(new Error('aborted'), { name: 'AbortError' })],
    ['a timeout', Object.assign(new Error('timed out'), { name: 'TimeoutError' })],
    ['an unreachable router', new RouterUnreachable()],
    ['iOS offline', new Error('The Internet connection appears to be offline.')],
  ])('%s is offline', (_name, error) => {
    expect(classifyError(error)).toEqual({ expected: true, reason: 'offline' });
  });

  it("the router's budget is expected", () => {
    expect(classifyError(new RouterRateLimited(1000))).toEqual({ expected: true, reason: 'router' });
  });

  it('an API refusal (4xx) is expected, a server error (5xx) is not', () => {
    expect(classifyError({ status: 409, problemCode: 'backup.version-conflict' })).toEqual({
      expected: true,
      reason: 'api',
      code: 'backup.version-conflict',
    });
    expect(classifyError({ status: 503 })).toEqual({ expected: false });
  });

  it('a permission the Turfer denied is expected', () => {
    const denied = Object.assign(new Error('denied'), { code: 'ERR_PERMISSION_DENIED' });
    expect(classifyError(denied)).toEqual({ expected: true, reason: 'permission', code: 'ERR_PERMISSION_DENIED' });
  });

  it.each([
    ['a bug', new TypeError("Cannot read properties of undefined (reading 'id')")],
    ['a plain error', new Error('capture failed')],
    ['a thrown string', 'boom'],
    ['nothing', undefined],
    ['null', null],
  ])('%s is unexpected', (_name, error) => {
    expect(classifyError(error)).toEqual({ expected: false });
  });
});

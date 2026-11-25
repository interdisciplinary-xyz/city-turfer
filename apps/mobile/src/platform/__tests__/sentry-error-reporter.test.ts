// The Sentry adapter starts the SDK with PII, tracing, replay and profiling off and the core
// scrubber in front of every event and breadcrumb, and never throws. The SDK is mocked: only its
// calls are checked here (a dev build on a device is the real check).
import { REDACTED_PAIR } from '@cityturfer/core/error-scrub';

import { ReportedFailure } from '@/platform/error-reporter';
import { startSentryReporter, stopSentry } from '@/platform/sentry-error-reporter';

const mockSdk = {
  init: jest.fn(),
  captureException: jest.fn(),
  close: jest.fn(async () => undefined),
};
jest.mock('@sentry/react-native', () => mockSdk);

const config = { dsn: 'https://key@o0.ingest.de.sentry.io/0', environment: 'production', release: 'r@1+x' };

beforeEach(() => jest.clearAllMocks());

it('starts Sentry without PII, traces, replay or profiling, scrubbing events and breadcrumbs', () => {
  expect(startSentryReporter(config)).not.toBeNull();
  const options = mockSdk.init.mock.calls[0][0];
  expect(options).toMatchObject({
    ...config,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableNetworkBreadcrumbs: false,
  });
  const event = options.beforeSend({ message: 'near 54.352,18.654', user: { email: 'a@b.c' } });
  expect(event).toEqual({ message: `near ${REDACTED_PAIR}` });
  expect(options.beforeBreadcrumb({ category: 'fetch', data: { url: 'https://x' } })).toBeNull();
});

it('captures with area and code tags; a rebuilt diagnostics failure is grouped by its code', () => {
  const reporter = startSentryReporter(config)!;
  const bug = new Error('x');
  reporter.report(bug, { area: 'ui', tags: { screen: 'history' } });
  reporter.report(new ReportedFailure('outbox.dead-letter'), { area: 'outbox', code: 'outbox.dead-letter' });
  expect(mockSdk.captureException.mock.calls).toEqual([
    [bug, { tags: { screen: 'history', area: 'ui' } }],
    [
      expect.any(ReportedFailure),
      {
        tags: { area: 'outbox', code: 'outbox.dead-letter' },
        fingerprint: ['reported-failure', 'outbox', 'outbox.dead-letter'],
      },
    ],
  ]);
});

it('never throws: a failing init means no reporter, a failing capture or close is swallowed', async () => {
  mockSdk.init.mockImplementationOnce(() => {
    throw new Error('native module missing');
  });
  expect(startSentryReporter(config)).toBeNull();
  const reporter = startSentryReporter(config)!;
  mockSdk.captureException.mockImplementationOnce(() => {
    throw new Error('transport');
  });
  expect(() => reporter.report(new Error('x'), { area: 'app' })).not.toThrow();
  mockSdk.close.mockRejectedValueOnce(new Error('closed'));
  await expect(stopSentry()).resolves.toBeUndefined();
});

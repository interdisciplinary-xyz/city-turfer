// Crash reporting follows "Send crash reports" (on by default) and never throws; task-errors in the
// field diagnostics are forwarded with a coordinate-free context; an unexpected ingest failure in
// the background batch handler is reported with its original error.
import type { Fix } from '@/contexts/recording/domain/fix';
import {
  type BatchContainer,
  createLocationBatchHandler,
} from '@/contexts/recording/infrastructure/location-batch-handler';
import { CrashReporting } from '@/platform/crash-reporting';
import { areaOf, Diagnostics } from '@/platform/diagnostics';
import {
  type CrashReportSetting,
  type ErrorContext,
  type ErrorReporter,
  ReportedFailure,
} from '@/platform/error-reporter';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

function memorySetting(initial: boolean | null = null): CrashReportSetting & { readable: boolean } {
  let value = initial;
  return {
    readable: true,
    async isEnabled() {
      if (!this.readable) {
        throw new Error('keychain locked');
      }
      return value !== false;
    },
    async setEnabled(v: boolean) {
      value = v;
    },
  };
}

function recorder() {
  const reports: { error: unknown; ctx: ErrorContext }[] = [];
  const reporter: ErrorReporter = { report: (error, ctx) => void reports.push({ error, ctx }) };
  return { reports, reporter };
}

describe('CrashReporting', () => {
  it('starts on first use when the setting was never touched (on by default)', async () => {
    const { reports, reporter } = recorder();
    const start = jest.fn(() => reporter);
    const cr = new CrashReporting({ setting: memorySetting(), start, stop: async () => undefined });
    cr.reporter.report(new Error('before'), { area: 'app' });
    await cr.ensureStarted();
    await cr.ensureStarted();
    cr.reporter.report(new Error('after'), { area: 'app' });
    expect(start).toHaveBeenCalledTimes(1);
    expect(reports.map((r) => (r.error as Error).message)).toEqual(['after']);
  });

  it('stays off when the Turfer turned it off', async () => {
    const start = jest.fn(() => recorder().reporter);
    const cr = new CrashReporting({ setting: memorySetting(false), start, stop: async () => undefined });
    await cr.ensureStarted();
    expect(start).not.toHaveBeenCalled();
    expect(await cr.isEnabled()).toBe(false);
  });

  it('turning it off stops the SDK and silences the reporter; turning it on starts it again', async () => {
    const { reports, reporter } = recorder();
    const stop = jest.fn(async () => undefined);
    const start = jest.fn(() => reporter);
    const setting = memorySetting();
    const cr = new CrashReporting({ setting, start, stop });
    await cr.ensureStarted();
    await cr.setEnabled(false);
    cr.reporter.report(new Error('while off'), { area: 'app' });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(reports).toEqual([]);
    expect(await setting.isEnabled()).toBe(false);
    await cr.setEnabled(true);
    cr.reporter.report(new Error('on again'), { area: 'app' });
    expect(start).toHaveBeenCalledTimes(2);
    expect(reports).toHaveLength(1);
  });

  it('an unreadable setting keeps it off for now and is read again next time', async () => {
    const start = jest.fn(() => recorder().reporter);
    const setting = memorySetting();
    setting.readable = false;
    const cr = new CrashReporting({ setting, start, stop: async () => undefined });
    await cr.ensureStarted();
    expect(start).not.toHaveBeenCalled();
    setting.readable = true;
    await cr.ensureStarted();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('never runs without a start function (no DSN, development, tests) and survives a failing SDK', async () => {
    await expect(
      new CrashReporting({ setting: memorySetting(), stop: async () => undefined }).ensureStarted()
    ).resolves.toBeUndefined();
    const failing = new CrashReporting({
      setting: memorySetting(),
      start: () => {
        throw new Error('native module missing');
      },
      stop: async () => undefined,
    });
    await expect(failing.ensureStarted()).resolves.toBeUndefined();
    const throwing = new CrashReporting({
      setting: memorySetting(),
      start: () => ({
        report: () => {
          throw new Error('transport');
        },
      }),
      stop: async () => undefined,
    });
    await throwing.ensureStarted();
    expect(() => throwing.reporter.report(new Error('x'), { area: 'app' })).not.toThrow();
  });
});

describe('Diagnostics forwards task-errors', () => {
  async function diagnostics() {
    const db = openNodeDatabase();
    await migrate(db);
    const { reports, reporter } = recorder();
    return { d: new Diagnostics(db, reporter), reports };
  }

  it('forwards a task-error by code and area, and nothing else', async () => {
    const { d, reports } = await diagnostics();
    d.log('batch', { received: 3 });
    d.log('task-error', { code: 'ingest-task', message: 'boom' });
    d.log('task-error', { code: 'health.import-failed', message: 'workout X' });
    d.log('task-error', { code: 'E_TASK', message: 'm' }, { area: 'recording', tags: { source: 'task' } });
    expect(reports.map((r) => r.ctx)).toEqual([
      { area: 'recording', code: 'ingest-task' },
      { area: 'health-sync', code: 'health.import-failed' },
      { area: 'recording', code: 'E_TASK', tags: { source: 'task' } },
    ]);
    expect(reports[0].error).toBeInstanceOf(ReportedFailure);
    expect((reports[0].error as Error).message).toBe('boom');
  });

  it('keeps expected outcomes and explicit opt-outs on the phone', async () => {
    const { d, reports } = await diagnostics();
    d.log('task-error', { code: 'health.route-not-saved' });
    d.log('task-error', { code: 'ingest-live' }, false);
    expect(reports).toEqual([]);
  });

  it.each([
    ['outbox.dead-letter', 'outbox'],
    ['maintenance', 'maintenance'],
    ['container-timeout-live', 'recording'],
    ['session-read-task', 'recording'],
    ['ingest-timeout-task', 'recording'],
    ['health.export-failed', 'health-sync'],
    ['something-else', 'app'],
  ])('area of %s is %s', (code, area) => {
    expect(areaOf(code)).toBe(area);
  });

  it('a dead-lettered event is reported with its type and error code, no payload', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    const { reports, reporter } = recorder();
    const c = wire('test', db, {
      tracker: {
        start: async () => undefined,
        stop: async () => undefined,
        isRunning: async () => false,
        reacquire: async () => null,
      },
      permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
      notifier: { publish: () => undefined },
      router: { route: async () => ({ distanceM: 0, coords: [] }) },
      ids: { next: () => 'id' },
      errorReporter: reporter,
    });
    expect(c.errorReporter).toBe(reporter);
    expect(await c.crashReports.isEnabled()).toBe(false); // not given: off (tests)
    c.diagnostics.log(
      'task-error',
      { code: 'outbox.dead-letter', id: 1, type: 'ActivityRecorded', attempts: 5, errorCode: 'SyntaxError' },
      { area: 'outbox', tags: { eventType: 'ActivityRecorded', errorCode: 'SyntaxError' } }
    );
    expect(reports).toEqual([
      {
        error: expect.any(ReportedFailure),
        ctx: {
          area: 'outbox',
          code: 'outbox.dead-letter',
          tags: { eventType: 'ActivityRecorded', errorCode: 'SyntaxError' },
        },
      },
    ]);
    await db.close();
  });
});

describe('background batch handler', () => {
  it('reports an unexpected ingest failure with its original error, logged on the phone without a second forward', async () => {
    const logs: { kind: string; data: Record<string, unknown>; forward?: false }[] = [];
    const { reports, reporter } = recorder();
    const bug = new TypeError('cannot read x of undefined');
    const container: BatchContainer = {
      recording: { ingestFixes: { execute: async () => Promise.reject(bug) } },
      diagnostics: { log: (kind, data, forward) => void logs.push({ kind, data, forward }) },
      errorReporter: reporter,
    };
    const handle = createLocationBatchHandler<Fix>({
      getContainer: async () => container,
      stopTracking: async () => undefined,
      toFix: (f) => f,
      describe: (source, l) => ({ source, received: l.length }),
      timeoutMs: 1000,
      warn: () => undefined,
    });
    await handle('live', []);
    expect(reports).toEqual([{ error: bug, ctx: { area: 'recording', code: 'ingest-live' } }]);
    expect(logs).toEqual([{ kind: 'task-error', data: { code: 'ingest-live', message: String(bug) }, forward: false }]);
  });
});

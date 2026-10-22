import { ActivityBackup } from '../activity-backup';
import { deviceToken, mayUpload, retryDelayMs, sourceOf } from '../backup-policy';
import { BackupSettings } from '../backup-settings';

const NOW = 1_000_000;

const queued = () => {
  const b = ActivityBackup.track('a', 1);
  b.queueUpload();
  return b;
};

describe('backup policy', () => {
  it('never uploads demo history; Apple Health imports only with their consent', () => {
    expect(sourceOf('demo-123')).toBe('demo');
    expect(sourceOf('hk-ABC')).toBe('apple-health');
    expect(sourceOf('3f9c2a64-5d1e')).toBe('recording');
    expect(mayUpload('demo-1', true)).toBe(false);
    expect(mayUpload('hk-1', false)).toBe(false);
    expect(mayUpload('hk-1', true)).toBe(true);
    expect(mayUpload('session-1', false)).toBe(true);
  });

  it('backs off 30 s, doubling, up to 6 h', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(30)).toBe(6 * 3_600_000);
  });

  it('accepts a pasted token trimmed, refuses empty or spaced ones', () => {
    expect(deviceToken('  abc.def-1 \n')).toBe('abc.def-1');
    expect(() => deviceToken('   ')).toThrow(expect.objectContaining({ code: 'backup.invalid-token' }));
    expect(() => deviceToken('two words')).toThrow(expect.objectContaining({ code: 'backup.invalid-token' }));
  });
});

describe('ActivityBackup', () => {
  it('uploads a new activity once; replays queue nothing new', () => {
    const b = queued();
    const rev = b.rev;
    b.queueUpload();
    expect(b.rev).toBe(rev);
    expect(b.nextStep(NOW)).toBe('upload');
    b.uploaded(rev, 1, NOW, false);
    expect(b.nextStep(NOW)).toBeNull();
    b.queueUpload();
    expect(b.nextStep(NOW)).toBeNull();
  });

  it('a correction queued while uploading is not lost: it becomes a replacement', () => {
    const b = queued();
    const sent = b.rev;
    b.queueCorrection(); // arrives while the upload is in flight
    b.uploaded(sent, 1, NOW, false);
    expect(b.toState()).toMatchObject({ status: 'backed-up', op: 'replace', serverVersion: 1 });
  });

  it('a delete overrides pending work and survives a finishing upload', () => {
    const b = queued();
    const sent = b.rev;
    b.queueDelete();
    b.uploaded(sent, 1, NOW, true);
    expect(b.nextStep(NOW)).toBe('delete');
    b.deleted();
    expect(b.toState()).toMatchObject({ status: 'deleted', op: null, gapsPending: false });
    b.queueUpload();
    b.queueCorrection();
    b.queueGapRoutes();
    expect(b.nextStep(NOW)).toBeNull();
  });

  it('a server tombstone is final: delete wins, nothing is ever uploaded again', () => {
    const b = queued();
    b.goneOnServer();
    b.queueUpload();
    b.queueCorrection();
    b.missingOnServer();
    b.knownOnServer(3);
    expect(b.toState()).toMatchObject({ status: 'gone', op: null });
    b.queueDelete();
    expect(b.nextStep(NOW)).toBeNull();
  });

  it('gap routes go after the activity, and only once it is on the server', () => {
    const b = queued();
    b.queueGapRoutes();
    expect(b.nextStep(NOW)).toBe('upload');
    b.uploaded(b.rev, 1, NOW, false);
    expect(b.nextStep(NOW)).toBe('gap-routes');
    b.gapRoutesSent(b.rev, 2);
    expect(b.toState()).toMatchObject({ gapsPending: false, serverVersion: 2 });
  });

  it('the manifest skips what the server has, re-queues what it lost', () => {
    const b = ActivityBackup.track('a', 1);
    b.knownOnServer(4);
    expect(b.toState()).toMatchObject({ status: 'backed-up', serverVersion: 4, op: null });
    b.missingOnServer();
    expect(b.toState()).toMatchObject({ status: 'none', serverVersion: null, op: 'upload' });
  });

  it('refused content stays refused until a correction brings new content', () => {
    const b = queued();
    b.refused(b.rev, 'upload', 'too-large', 'payload-too-large');
    expect(b.toState()).toMatchObject({ status: 'too-large', op: null, errorCode: 'payload-too-large' });
    b.queueUpload();
    b.missingOnServer();
    expect(b.nextStep(NOW)).toBeNull();
    b.queueCorrection();
    expect(b.toState()).toMatchObject({ status: 'none', op: 'upload', errorCode: null });
  });

  it('a refused replacement keeps the older server copy', () => {
    const b = queued();
    b.uploaded(b.rev, 1, NOW, false);
    b.queueCorrection();
    b.refused(b.rev, 'replace', 'rejected', 'activity.track-too-short');
    expect(b.toState()).toMatchObject({ status: 'backed-up', op: null, serverVersion: 1 });
  });

  it('waits for its retry after a failure; a new change resets the wait', () => {
    const b = queued();
    b.failed('server', NOW);
    expect(b.nextStep(NOW)).toBeNull();
    expect(b.nextStep(NOW + 30_000)).toBe('upload');
    b.failed('server', NOW);
    expect(b.toState().nextAttemptAt).toBe(NOW + 60_000);
    b.queueDelete();
    expect(b.nextStep(NOW)).toBe('delete');
  });
});

describe('BackupSettings', () => {
  it('queues nothing while off; turning on asks for a full comparison', () => {
    const s = BackupSettings.initial();
    s.queueHomeCity();
    expect(s.homeCityPending).toBe(false);
    expect(s.acceptsChanges).toBe(false);
    s.enable();
    expect(s.needsPlanning).toBe(true);
    s.planned(NOW, 'c1');
    expect(s.needsPlanning).toBe(false);
  });

  it('off withdraws both consents until delivered and stops Apple Health uploads', () => {
    const s = BackupSettings.initial();
    s.enable();
    s.includeHealth(true);
    s.disable();
    expect(s.toState()).toMatchObject({ enabled: false, healthIncluded: false });
    expect([...s.withdrawalsPending].sort()).toEqual(['apple-health-in-cloud-sync', 'cloud-sync']);
    s.withdrawalDelivered('cloud-sync');
    s.enable();
    expect(s.withdrawalsPending).toEqual(['apple-health-in-cloud-sync']);
  });

  it('Apple Health needs backup on; turning it on compares again', () => {
    const s = BackupSettings.initial();
    expect(() => s.includeHealth(true)).toThrow(expect.objectContaining({ code: 'backup.off' }));
    s.enable();
    s.planned(NOW, null);
    s.includeHealth(true);
    expect(s.needsPlanning).toBe(true);
  });

  it('an auth stop lasts until a new token; the token stays while backup is on', () => {
    const s = BackupSettings.initial();
    s.enable();
    s.runFinished(NOW, 'auth');
    expect(s.waitsForNewToken).toBe(true);
    expect(() => s.ensureTokenRemovable()).toThrow(expect.objectContaining({ code: 'backup.on' }));
    s.tokenChanged();
    expect(s.waitsForNewToken).toBe(false);
  });

  it('accepts http(s) server URLs only, without a trailing slash', () => {
    const s = BackupSettings.initial();
    s.useServer(' https://api.example.org/ ');
    expect(s.toState().serverUrl).toBe('https://api.example.org');
    s.useServer('');
    expect(s.toState().serverUrl).toBeNull();
    expect(() => s.useServer('ftp://x')).toThrow(expect.objectContaining({ code: 'backup.invalid-server-url' }));
    expect(() => s.useServer('https://a b')).toThrow();
  });
});

import { ActivityBackup } from '../activity-backup';
import { deviceToken, mayUpload, nameToUpload, retryDelayMs, sourceOf, trackHashInput } from '../backup-policy';
import { BackupSettings } from '../backup-settings';

const NOW = 1_000_000;

const queued = () => {
  const b = ActivityBackup.track('a', 1);
  b.queueUpload();
  return b;
};

describe('backup policy', () => {
  it('a full upload keeps the newer rename (last write wins on renamedAt; the server wins ties)', () => {
    const phone = (renamedAt: number | null) => ({ name: 'Phone A name', renamedAt });
    const server = (renamedAt: number | null) => ({ name: 'Server name', renamedAt });
    expect(nameToUpload(phone(null), server(null))).toBe('Phone A name'); // nobody renamed: phone's content
    expect(nameToUpload(phone(null), server(10))).toBe('Server name'); // only another phone renamed it
    expect(nameToUpload(phone(5), server(10))).toBe('Server name'); // the server's rename is newer
    expect(nameToUpload(phone(10), server(10))).toBe('Server name');
    expect(nameToUpload(phone(20), server(10))).toBe('Phone A name'); // this phone's rename is newer
    expect(nameToUpload(phone(20), server(null))).toBe('Phone A name');
  });

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
    b.gapRoutesSent(b.rev, 2, NOW - 5);
    expect(b.toState()).toMatchObject({ gapsPending: false, serverVersion: 2, gapsSentAt: NOW - 5 });
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
    s.queueHomeCity(NOW);
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

  it('after a restore, the server consent turns backup on (never Apple Health); a pending withdrawal wins', () => {
    const s = BackupSettings.initial();
    expect(s.adoptServerConsents({ cloudSync: false })).toBe(false);
    expect(s.toState()).toMatchObject({ enabled: false, healthIncluded: false });
    expect(s.adoptServerConsents({ cloudSync: true })).toBe(true);
    expect(s.toState()).toMatchObject({ enabled: true, healthIncluded: false, backfilledAt: null });
    expect(s.adoptServerConsents({ cloudSync: false })).toBe(false); // never turns off
    expect(s.enabled).toBe(true);

    const off = BackupSettings.initial();
    off.enable();
    off.disable(); // withdrawn here, the server hasn't heard yet
    expect(off.adoptServerConsents({ cloudSync: true })).toBe(false);
    expect(off.enabled).toBe(false);
  });

  it('Apple Health needs backup on; turning it on compares again', () => {
    const s = BackupSettings.initial();
    expect(() => s.includeHealth(true)).toThrow(expect.objectContaining({ code: 'backup.off' }));
    s.enable();
    s.planned(NOW, null);
    s.includeHealth(true);
    expect(s.needsPlanning).toBe(true);
  });

  it('the token stays while backup is on; a new one clears the last error', () => {
    const s = BackupSettings.initial();
    s.enable();
    s.runFinished(NOW, 'auth');
    expect(() => s.ensureTokenRemovable()).toThrow(expect.objectContaining({ code: 'backup.on' }));
    s.tokenChanged();
    expect(s.toState().lastError).toBeNull();
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

describe('ActivityBackup: renames, gap checks and reconciling', () => {
  const onServer = () => {
    const b = queued();
    b.uploaded(b.rev, 1, NOW, false);
    return b;
  };
  const same = { trackHash: 'h1', name: 'Walk' };
  const local = { ...same, renamedAt: null };

  it('a rename goes after the activity, once; an upload in flight carries it', () => {
    const b = queued();
    b.queueRename();
    expect(b.nextStep(NOW)).toBe('upload');
    b.uploaded(b.rev, 1, NOW, false);
    expect(b.nextStep(NOW)).toBeNull(); // the upload sent the current name

    b.queueRename();
    expect(b.nextStep(NOW)).toBe('rename');
    const rev = b.rev;
    b.queueRename(); // renamed again while the first was being sent
    b.renamed(rev, 2);
    expect(b.nextStep(NOW)).toBe('rename');
    b.renamed(b.rev, 3);
    expect(b.toState()).toMatchObject({ renamePending: false, serverVersion: 3 });
  });

  it('a refused rename is dropped; a deleted activity is never renamed', () => {
    const b = onServer();
    b.queueRename();
    b.refused(b.rev, 'rename', 'rejected', 'activity.invalid-name');
    expect(b.nextStep(NOW)).toBeNull();
    b.queueDelete();
    b.queueRename();
    expect(b.nextStep(NOW)).toBe('delete');
    b.deleted();
    b.queueRename();
    expect(b.nextStep(NOW)).toBeNull();
  });

  it('reconcile: another track is replaced, another name renamed, a newer gap check sent', () => {
    const track = onServer();
    track.reconcile({ trackHash: 'old', name: 'Walk' }, { ...local, gapsCheckedAt: null });
    expect(track.nextStep(NOW)).toBe('replace');

    const name = onServer();
    name.reconcile({ trackHash: 'h1', name: 'Old name' }, { ...local, renamedAt: NOW - 5, gapsCheckedAt: null });
    expect(name.nextStep(NOW)).toBe('rename');

    const gaps = onServer();
    gaps.reconcile(same, { ...local, gapsCheckedAt: NOW - 1 });
    expect(gaps.nextStep(NOW)).toBe('gap-routes');
    gaps.gapRoutesSent(gaps.rev, 2, NOW - 1);
    gaps.reconcile(same, { ...local, gapsCheckedAt: NOW - 1 });
    expect(gaps.nextStep(NOW)).toBeNull(); // the server already has that check
  });

  it("reconcile: a name this phone never renamed is not pushed over the server's", () => {
    // E.g. renamed on another phone after a restore: the server's name may be the newer one.
    const b = onServer();
    b.reconcile({ trackHash: 'h1', name: 'Renamed on phone B' }, { ...local, gapsCheckedAt: null });
    expect(b.nextStep(NOW)).toBeNull();
  });

  it('deleted on the phone while off: delete what may be on the server, nothing else', () => {
    const b = onServer();
    b.deletedOnPhone();
    expect(b.nextStep(NOW)).toBe('delete');
    const never = ActivityBackup.track('x', 1);
    never.deletedOnPhone();
    expect(never.nextStep(NOW)).toBeNull();
    const gone = onServer();
    gone.goneOnServer();
    gone.deletedOnPhone();
    expect(gone.nextStep(NOW)).toBeNull();
  });

  it('a new track on the server has no gap routes: the next check is sent again', () => {
    const b = onServer();
    b.queueGapRoutes();
    b.gapRoutesSent(b.rev, 2, NOW - 1);
    b.queueCorrection();
    b.uploaded(b.rev, 3, NOW, true);
    expect(b.toState()).toMatchObject({ gapsSentAt: null, gapsPending: true });
  });
});

describe('BackupSettings: accounts, withdrawals, Home City', () => {
  it('adopts the first account as is; another one resets everything and turns backup off', () => {
    const s = BackupSettings.initial();
    s.enable();
    s.planned(NOW, 'c9');
    expect(s.useAccount('https://api|u1')).toBe(false);
    expect(s.needsPlanning).toBe(true); // adopted, but compared again
    s.planned(NOW, 'c10');
    expect(s.useAccount('https://api|u1')).toBe(false);
    expect(s.needsPlanning).toBe(false);
    expect(s.enabled).toBe(true);
    expect(s.useAccount('https://api|u2')).toBe(true);
    expect(s.toState()).toMatchObject({
      enabled: false,
      cursor: null,
      backfilledAt: null,
      accountKey: 'https://api|u2',
    });
  });

  it('a delivered backup withdrawal means nothing is on the server; Apple Health only its own', () => {
    const s = BackupSettings.initial();
    s.enable();
    s.planned(NOW, 'c1');
    s.homeCityDelivered(NOW - 5);
    s.disable();
    s.withdrawalDelivered('apple-health-in-cloud-sync');
    expect(s.toState()).toMatchObject({ cursor: 'c1', homeCitySentAt: NOW - 5 });
    s.withdrawalDelivered('cloud-sync');
    expect(s.toState()).toMatchObject({
      cursor: null,
      backfilledAt: null,
      homeCitySentAt: null,
      withdrawalsPending: [],
    });
  });

  it('keeps the token until the server has heard about a withdrawal', () => {
    const s = BackupSettings.initial();
    s.enable();
    expect(() => s.ensureTokenRemovable()).toThrow(expect.objectContaining({ code: 'backup.on' }));
    s.disable();
    expect(() => s.ensureTokenRemovable()).toThrow(expect.objectContaining({ code: 'backup.withdrawal-pending' }));
    s.withdrawalDelivered('cloud-sync');
    s.withdrawalDelivered('apple-health-in-cloud-sync');
    expect(() => s.ensureTokenRemovable()).not.toThrow();
  });

  it('queues a Home City choice only when the server does not have that one', () => {
    const s = BackupSettings.initial();
    s.enable();
    s.homeCityRestored(NOW - 10);
    s.queueHomeCity(NOW - 10);
    expect(s.homeCityPending).toBe(false);
    s.queueHomeCity(NOW);
    expect(s.homeCityPending).toBe(true);
  });
});

describe('canonical track (the server hashes exactly this)', () => {
  it('is [lon, lat, whole-ms t, segment, alt | null] as JSON without spaces', () => {
    const track = [
      { lat: 52.2297, lon: 21.0122, t: 1760857920000.4, segment: 0, alt: 98.5, accuracy: 4, speed: 3 },
      { lat: 52.2299, lon: 21.0125, t: 1760857923000, segment: 1, alt: null, accuracy: null, speed: null },
    ];
    expect(trackHashInput(track)).toBe(
      '[[21.0122,52.2297,1760857920000,0,98.5],[21.0125,52.2299,1760857923000,1,null]]'
    );
  });
});

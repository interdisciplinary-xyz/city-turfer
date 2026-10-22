import { createHash, randomBytes } from 'node:crypto';

import { strToU8, type Zippable, zipSync } from 'fflate';

import { AppError } from '../backup/app-error';
import type { ChangeRecord } from '../backup/model';
import type { BackupStore } from '../backup/ports';
import type { Clock } from '../backup/use-cases';
import type { ApiLog } from '../deps';
import type { Mailer, MailMessage } from '../identity/mailer';
import { gpxOf } from './gpx';
import type { ExportRecord, ExportStore, FileStorage } from './ports';

/**
 * RequestDataExport, GetDataExport, DownloadDataExport (GDPR art. 15 and 20; contract 0.4.0). The
 * zip — `data.json` (account, consents, activities with tracks and gap routes, tombstones, Home
 * City) and one GPX 1.1 per activity — is built at once, stored behind the FileStorage port and its
 * one-time download link (24 h) is e-mailed: the phone cannot save files without a native module.
 * One export per 24 hours. The link's key is never stored, only its SHA-256.
 */

export const EXPORT_TTL_MS = 24 * 60 * 60_000;
/** Bigger zips fail (`failed`) rather than outgrow a function's memory; ~15 years of daily runs. */
export const MAX_EXPORT_BYTES = 200_000_000;
const PAGE = 200;

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function exportLinkMail(to: string, url: string, expiresAt: number): MailMessage {
  return {
    to,
    subject: 'Your CityTurfer data export',
    text: [
      'Your CityTurfer data export is ready: every activity with its GPS track (GPX), and a data.json',
      'with your account, consents and settings.',
      '',
      `Download it (works once, until ${new Date(expiresAt).toUTCString()}):`,
      url,
      '',
      'If you did not ask for it, ignore this e-mail; the link expires on its own.',
    ].join('\n'),
  };
}

export class ExportService {
  constructor(
    private readonly store: BackupStore,
    private readonly exports: ExportStore,
    private readonly files: FileStorage,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly publicUrl: string,
    private readonly log: ApiLog
  ) {}

  /** RequestDataExport: 429 within 24 h of the last one, 422 without an e-mail to send it to. */
  async request(userId: string): Promise<ExportRecord> {
    const now = this.clock.now();
    await this.files.purgeExpired(now);
    const last = await this.exports.latest(userId);
    if (last && now - last.requestedAt < EXPORT_TTL_MS) {
      const retryAfterS = Math.ceil((last.requestedAt + EXPORT_TTL_MS - now) / 1000);
      throw new AppError('rate-limited', { 'Retry-After': String(retryAfterS) });
    }
    const user = await this.store.read(userId).user();
    if (!user?.email) {
      throw new AppError('export.no-email');
    }
    const id = `exp_${randomBytes(12).toString('base64url')}`;
    let record: ExportRecord = {
      id,
      status: 'failed',
      requestedAt: now,
      readyAt: null,
      expiresAt: null,
      downloadedAt: null,
      fileKey: null,
      byteSize: null,
    };
    try {
      const zip = await this.buildZip(userId, now);
      if (zip.byteLength > MAX_EXPORT_BYTES) {
        throw new Error('export too large');
      }
      const key = randomBytes(32).toString('base64url');
      const expiresAt = now + EXPORT_TTL_MS;
      const fileKey = `exports/${userId}/${id}.zip`;
      await this.files.put(fileKey, zip, { ownerId: userId, contentType: 'application/zip', expiresAt });
      record = { ...record, status: 'ready', readyAt: this.clock.now(), expiresAt, fileKey, byteSize: zip.byteLength };
      await this.exports.insert(userId, record, sha256(key));
      await this.mailer.send(exportLinkMail(user.email, `${this.publicUrl}/v1/exports/${key}`, expiresAt));
      return record;
    } catch {
      this.log.event?.({ msg: 'export.failed' });
      if (record.status === 'failed') {
        await this.exports.insert(userId, record, null);
      }
      return record;
    }
  }

  /** GetDataExport: the job of this user (404 otherwise); a ready one past its expiry is `expired`. */
  async get(userId: string, id: string): Promise<ExportRecord> {
    const record = await this.exports.get(userId, id);
    if (!record) {
      throw new AppError('not-found');
    }
    if (record.status === 'ready' && record.expiresAt !== null && record.expiresAt <= this.clock.now()) {
      return { ...record, status: 'expired' };
    }
    return record;
  }

  /** DownloadDataExport: once, within 24 h (410 `export.gone` after); unknown keys are 404. */
  async download(key: string): Promise<{ bytes: Uint8Array; fileName: string }> {
    const now = this.clock.now();
    const claimed = await this.exports.claim(sha256(key), now);
    if (claimed === null) {
      throw new AppError('not-found');
    }
    if (claimed === 'gone' || !claimed.export.fileKey) {
      throw new AppError('export.gone');
    }
    const file = await this.files.get(claimed.export.fileKey);
    if (!file) {
      throw new AppError('export.gone');
    }
    await this.files.delete(claimed.export.fileKey);
    const day = new Date(claimed.export.requestedAt).toISOString().slice(0, 10);
    return { bytes: file.bytes, fileName: `cityturfer-export-${day}.zip` };
  }

  /** Everything the server holds for the user, paged through the changes feed (bounded memory per page). */
  private async buildZip(userId: string, now: number): Promise<Uint8Array> {
    const reader = this.store.read(userId);
    const user = await reader.user();
    const consents = await reader.consents();
    const files: Zippable = {};
    const activities: unknown[] = [];
    const tombstones: unknown[] = [];
    let homeCity: unknown = null;
    let after = 0;
    for (;;) {
      const page: ChangeRecord[] = await reader.changesSince(after, PAGE);
      for (const change of page) {
        if (change.kind === 'activity') {
          const a = change.activity;
          const points = (await reader.track(a.id)) ?? [];
          const gaps = await reader.gapRoutes(a.id);
          files[`activities/${new Date(a.startedAt).toISOString().slice(0, 10)}-${a.id}.gpx`] = strToU8(
            gpxOf(a, points)
          );
          activities.push({
            id: a.id,
            type: a.type,
            name: a.name,
            renamedAt: iso(a.renamedAt),
            source: a.source,
            startedAt: iso(a.startedAt),
            endedAt: iso(a.endedAt),
            timeZone: a.timeZone,
            resumedSegments: a.resumedSegments,
            summary: a.summary,
            estimatedDistanceM: a.estimatedDistanceM,
            estimatedMovingS: a.estimatedMovingS,
            version: a.version,
            updatedAt: iso(a.updatedAt),
            trackHash: a.trackHash,
            track: { columns: ['lon', 'lat', 't', 'segment', 'altitudeM'], points },
            gapRoutes: gaps ? { checkedAt: iso(gaps.checkedAt), routes: gaps.routes } : null,
          });
        } else if (change.kind === 'tombstone') {
          tombstones.push({ activityId: change.tombstone.activityId, deletedAt: iso(change.tombstone.deletedAt) });
        } else {
          homeCity = { cityId: change.homeCity.cityId, chosenAt: iso(change.homeCity.chosenAt) };
        }
      }
      if (page.length < PAGE) {
        break;
      }
      after = page.at(-1)!.seq;
    }
    const data = {
      format: 'cityturfer-export',
      version: 1,
      exportedAt: iso(now),
      account: { id: userId, email: user?.email ?? null, createdAt: iso(user?.createdAt ?? null) },
      consents: consents.map((c) => ({
        purpose: c.purpose,
        granted: c.granted,
        policyVersion: c.policyVersion,
        at: iso(c.at),
      })),
      activities,
      tombstones,
      homeCity,
    };
    files['data.json'] = strToU8(JSON.stringify(data, null, 2));
    // GPX and JSON compress ~10×; level 6 is fflate's default balance of time and size.
    return zipSync(files, { level: 6 });
  }
}

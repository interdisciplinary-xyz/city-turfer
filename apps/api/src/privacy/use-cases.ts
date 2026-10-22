import { createHash, randomBytes } from 'node:crypto';

import { strToU8, Zip, ZipDeflate } from 'fflate';

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
 * City) and one GPX 1.1 per activity — is built in the request, streamed into fflate so only the
 * compressed bytes stay in memory, stored behind the FileStorage port, and its download link is
 * e-mailed (the phone cannot save files without a native module). The link works **repeatedly
 * until it expires (24 h)**: mail link scanners fetch links before people do, and a broken download
 * must be retryable. One export per 24 hours, reserved under the user's row lock. The link's key is
 * never stored, only its SHA-256.
 */

export const EXPORT_TTL_MS = 24 * 60 * 60_000;
/** Bigger zips fail (`failed`) rather than outgrow a function's memory (years of daily runs). */
export const MAX_EXPORT_BYTES = 50_000_000;
/** Activities read per page (tracks and gap routes in one query each). */
const PAGE = 50;

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
      `Download it (until ${new Date(expiresAt).toUTCString()}):`,
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

  /**
   * RequestDataExport: 429 within 24 h of the last export that did not fail, 422 without an e-mail.
   * Any failure (build, size, storage, mail) leaves the export `failed`, its file deleted, and the
   * user free to ask again at once.
   */
  async request(userId: string): Promise<ExportRecord> {
    const now = this.clock.now();
    await this.files.purgeExpired(now);
    const user = await this.store.read(userId).user();
    if (!user?.email) {
      throw new AppError('export.no-email');
    }
    const id = `exp_${randomBytes(12).toString('base64url')}`;
    const pending: ExportRecord = {
      id,
      status: 'pending',
      requestedAt: now,
      readyAt: null,
      expiresAt: null,
      downloadedAt: null,
      fileKey: null,
      byteSize: null,
    };
    const reservation = await this.exports.reserve(userId, pending, EXPORT_TTL_MS);
    if (!reservation.reserved) {
      const retryAfterS = Math.max(1, Math.ceil((reservation.last.requestedAt + EXPORT_TTL_MS - now) / 1000));
      throw new AppError('rate-limited', { 'Retry-After': String(retryAfterS) });
    }
    const fileKey = `exports/${userId}/${id}.zip`;
    try {
      const zip = await this.buildZip(userId, now);
      const key = randomBytes(32).toString('base64url');
      const expiresAt = now + EXPORT_TTL_MS;
      await this.files.put(fileKey, zip, { ownerId: userId, contentType: 'application/zip', expiresAt });
      const done = { readyAt: this.clock.now(), expiresAt, fileKey, byteSize: zip.byteLength };
      await this.exports.complete(userId, id, { ...done, keyHash: sha256(key) });
      await this.mailer.send(exportLinkMail(user.email, `${this.publicUrl}/v1/exports/${key}`, expiresAt));
      return { ...pending, status: 'ready', ...done };
    } catch {
      this.log.event?.({ msg: 'export.failed' });
      await this.files.delete(fileKey).catch(() => undefined);
      await this.exports.fail(userId, id);
      return { ...pending, status: 'failed' };
    }
  }

  /** GetDataExport: the job of this user (404 otherwise), with `expired` / `downloaded` derived. */
  async get(userId: string, id: string): Promise<ExportRecord> {
    const record = await this.exports.get(userId, id);
    if (!record) {
      throw new AppError('not-found');
    }
    return withLiveStatus(record, this.clock.now());
  }

  /** DownloadDataExport: as often as needed until `expiresAt` (then 410 `export.gone`); unknown keys 404. */
  async download(key: string): Promise<{ bytes: Uint8Array; fileName: string }> {
    const now = this.clock.now();
    const found = await this.exports.byKeyHash(sha256(key));
    if (!found) {
      throw new AppError('not-found');
    }
    const e = withLiveStatus(found.export, now);
    if ((e.status !== 'ready' && e.status !== 'downloaded') || !e.fileKey) {
      throw new AppError('export.gone');
    }
    const file = await this.files.get(e.fileKey);
    if (!file) {
      throw new AppError('export.gone');
    }
    await this.exports.markDownloaded(found.userId, e.id, now);
    const day = new Date(e.requestedAt).toISOString().slice(0, 10);
    return { bytes: file.bytes, fileName: `cityturfer-export-${day}.zip` };
  }

  /**
   * Everything the server holds for the user, paged through the changes feed (PAGE activities, one
   * query for their tracks and one for their gap routes), streamed into the zip: memory holds the
   * compressed output plus one page. Throws past MAX_EXPORT_BYTES.
   */
  private async buildZip(userId: string, now: number): Promise<Uint8Array> {
    const reader = this.store.read(userId);
    const user = await reader.user();
    const consents = await reader.consents();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let zipError: Error | null = null;
    const zip = new Zip((err, chunk) => {
      if (err) {
        zipError = err;
        return;
      }
      size += chunk.byteLength;
      chunks.push(chunk);
    });
    const check = () => {
      if (zipError) {
        throw zipError;
      }
      if (size > MAX_EXPORT_BYTES) {
        throw new Error('export too large');
      }
    };
    // GPX and JSON compress ~10×; level 6 is fflate's default balance of time and size.
    const json = new ZipDeflate('data.json', { level: 6 });
    zip.add(json);
    const head = {
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
    };
    json.push(strToU8(`${JSON.stringify(head).slice(0, -1)},"activities":[`));
    const tombstones: unknown[] = [];
    let homeCity: unknown = null;
    let first = true;
    let after = 0;
    for (;;) {
      const page: ChangeRecord[] = await reader.changesSince(after, PAGE);
      const ids = page.flatMap((c) => (c.kind === 'activity' ? [c.activity.id] : []));
      const [tracks, gaps] = await Promise.all([reader.tracksOf(ids), reader.gapRoutesOf(ids)]);
      for (const change of page) {
        if (change.kind === 'activity') {
          const a = change.activity;
          const points = tracks.get(a.id) ?? [];
          const g = gaps.get(a.id);
          const gpx = new ZipDeflate(`activities/${new Date(a.startedAt).toISOString().slice(0, 10)}-${a.id}.gpx`, {
            level: 6,
          });
          zip.add(gpx);
          gpx.push(strToU8(gpxOf(a, points)), true);
          const entry = {
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
            gapRoutes: g ? { checkedAt: iso(g.checkedAt), routes: g.routes } : null,
          };
          json.push(strToU8(`${first ? '' : ','}${JSON.stringify(entry)}`));
          first = false;
        } else if (change.kind === 'tombstone') {
          tombstones.push({ activityId: change.tombstone.activityId, deletedAt: iso(change.tombstone.deletedAt) });
        } else {
          homeCity = { cityId: change.homeCity.cityId, chosenAt: iso(change.homeCity.chosenAt) };
        }
      }
      check();
      if (page.length < PAGE) {
        break;
      }
      after = page.at(-1)!.seq;
    }
    json.push(strToU8(`],"tombstones":${JSON.stringify(tombstones)},"homeCity":${JSON.stringify(homeCity)}}`), true);
    zip.end();
    check();
    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out;
  }
}

/** `expired` once past `expiresAt`; `downloaded` once fetched (still served until then). */
function withLiveStatus(e: ExportRecord, now: number): ExportRecord {
  if ((e.status === 'ready' || e.status === 'downloaded') && e.expiresAt !== null && e.expiresAt <= now) {
    return { ...e, status: 'expired' };
  }
  if (e.status === 'ready' && e.downloadedAt !== null) {
    return { ...e, status: 'downloaded' };
  }
  return e;
}

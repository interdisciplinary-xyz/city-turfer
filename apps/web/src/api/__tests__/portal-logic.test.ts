import { describe, expect, it } from 'vitest';

import en from '../../../messages/en.json';
import pl from '../../../messages/pl.json';
import { backupState } from '../../app/[locale]/account/_portal/backup-status/backup-status.constants';
import { confirmationMatches } from '../../app/[locale]/account/_portal/delete-account/delete-account.constants';
import { sortSessions } from '../../app/[locale]/account/_portal/devices-panel/devices-panel.constants';
import { canRequestExport } from '../../app/[locale]/account/_portal/export-panel/export-panel.constants';
import { describeWait } from '../../app/[locale]/account/_portal/format';
import { sanitizeCode } from '../../app/[locale]/account/_portal/sign-in-form/sign-in-form.constants';
import { EXPORT_POLL_MS, exportPollInterval } from '../hooks';
import type { AuthSession, Consent, DataExportJob } from '../schema';

const job = (status: DataExportJob['status']): DataExportJob => ({
  id: 'exp_test',
  status,
  requestedAt: '2026-10-22T09:00:00Z',
  readyAt: null,
  expiresAt: null,
});

const consent = (purpose: Consent['purpose'], granted: boolean, at: string): Consent => ({
  purpose,
  granted,
  at,
  policyVersion: '2026-10',
});

describe('backupState', () => {
  it('never decided → never', () => {
    expect(backupState([])).toEqual({ kind: 'never' });
  });
  it('withdrawn → withdrawn, with the date', () => {
    expect(backupState([consent('cloud-sync', false, '2026-10-20T10:00:00Z')])).toEqual({
      kind: 'withdrawn',
      at: '2026-10-20T10:00:00Z',
    });
  });
  it('on, Apple Health not shared', () => {
    const state = backupState([consent('cloud-sync', true, '2026-10-01T10:00:00Z')]);
    expect(state).toMatchObject({ kind: 'on', health: { included: false } });
  });
  it('on, Apple Health shared', () => {
    const state = backupState([
      consent('cloud-sync', true, '2026-10-01T10:00:00Z'),
      consent('apple-health-in-cloud-sync', true, '2026-10-02T10:00:00Z'),
    ]);
    expect(state).toMatchObject({ kind: 'on', health: { included: true, since: '2026-10-02T10:00:00Z' } });
  });
  it('Apple Health granted but backup withdrawn → withdrawn', () => {
    const state = backupState([
      consent('cloud-sync', false, '2026-10-03T10:00:00Z'),
      consent('apple-health-in-cloud-sync', true, '2026-10-02T10:00:00Z'),
    ]);
    expect(state.kind).toBe('withdrawn');
  });
});

it('sanitizeCode keeps up to six digits of typed or pasted text', () => {
  expect(sanitizeCode('493 027')).toBe('493027');
  expect(sanitizeCode('Your code: 493027.')).toBe('493027');
  expect(sanitizeCode('12345678')).toBe('123456');
  expect(sanitizeCode('abc')).toBe('');
});

it('confirmationMatches ignores case, accents and spaces only', () => {
  expect(confirmationMatches(' delete ', 'DELETE')).toBe(true);
  expect(confirmationMatches('usuń', 'USUŃ')).toBe(true);
  expect(confirmationMatches('usun', 'USUŃ')).toBe(true);
  expect(confirmationMatches('USUŃ', 'USUN')).toBe(true);
  expect(confirmationMatches('usuwam', 'USUWAM')).toBe(true);
  expect(confirmationMatches(' Usuwam ', 'USUWAM')).toBe(true);
  expect(confirmationMatches('usuwa', 'USUWAM')).toBe(false);
  expect(confirmationMatches('DELET', 'DELETE')).toBe(false);
});

it('the Polish confirmation word needs no Polish letters', () => {
  expect(pl.portal.privacy.delete.confirmWord).toMatch(/^[A-Z]+$/);
  expect(en.portal.privacy.delete.confirmWord).toMatch(/^[A-Z]+$/);
});

it('canRequestExport: before asking, and after a failed or expired export', () => {
  expect(canRequestExport(null)).toBe(true);
  expect(canRequestExport(job('failed'))).toBe(true);
  expect(canRequestExport(job('expired'))).toBe(true);
  expect(canRequestExport(job('pending'))).toBe(false);
  expect(canRequestExport(job('ready'))).toBe(false);
  expect(canRequestExport(job('downloaded'))).toBe(false);
});

describe('exportPollInterval', () => {
  it('polls while pending', () => {
    expect(exportPollInterval({ status: 'success', data: { status: 'pending' } })).toBe(EXPORT_POLL_MS);
  });
  it('stops once the export is settled', () => {
    expect(exportPollInterval({ status: 'success', data: { status: 'ready' } })).toBe(false);
    expect(exportPollInterval({ status: 'pending' })).toBe(false);
  });
  it('stops on an error, even with an older pending answer', () => {
    expect(exportPollInterval({ status: 'error', data: { status: 'pending' } })).toBe(false);
  });
});

it('describeWait picks a readable unit', () => {
  expect(describeWait(42)).toEqual({ key: 'waitSeconds', count: 42 });
  expect(describeWait(0.2)).toEqual({ key: 'waitSeconds', count: 1 });
  expect(describeWait(600)).toEqual({ key: 'waitMinutes', count: 10 });
  expect(describeWait(86_400)).toEqual({ key: 'waitHours', count: 24 });
});

it('sortSessions puts this browser first, then the most recent', () => {
  const session = (id: string, lastActiveAt: string, current = false): AuthSession => ({
    id,
    client: 'phone',
    createdAt: '2026-10-01T00:00:00Z',
    lastActiveAt,
    expiresAt: '2026-12-01T00:00:00Z',
    current,
  });
  const sorted = sortSessions([
    session('old', '2026-10-02T00:00:00Z'),
    session('me', '2026-10-01T00:00:00Z', true),
    session('new', '2026-10-20T00:00:00Z'),
  ]);
  expect(sorted.map((s) => s.id)).toEqual(['me', 'new', 'old']);
});

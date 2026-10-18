import { describe, expect, it } from 'vitest';

import type { RequestLogEntry } from '../../utils/request-log';
import {
  countDuplicates,
  duplicateKey,
  filterRequestLog,
  formatBytes,
  formatStatus,
  isErrorStatus,
  sizeClassName,
  statusClassName,
  summarizeRequestLog,
} from './request-logger.utils';

const entry = (overrides: Partial<RequestLogEntry>): RequestLogEntry => ({
  id: 'b1',
  source: 'browser',
  method: 'GET',
  url: '/api/health',
  page: '/',
  via: null,
  status: 200,
  startedAt: 0,
  durationMs: 5,
  sizeBytes: 100,
  ...overrides,
});

describe('request-logger utils', () => {
  it('filters by page + source and sorts oldest first across sources', () => {
    const entries = [
      entry({ id: 'b1', startedAt: 30 }),
      entry({ id: 'b2', page: '/pricing', startedAt: 10 }),
      entry({ id: 's1', source: 'server', startedAt: 20 }),
      entry({ id: 's2', source: 'server', page: null, startedAt: 5 }),
    ];
    expect(filterRequestLog(entries, 'page', '/').map((e) => e.id)).toEqual(['s1', 'b1']);
    expect(filterRequestLog(entries, 'all', '/', 'server').map((e) => e.id)).toEqual(['s2', 's1']);
    expect(filterRequestLog(entries, 'all', '/')).toHaveLength(4);
  });

  it('counts duplicates per source + method + URL', () => {
    const entries = [
      entry({ id: 'b1' }),
      entry({ id: 'b2' }),
      entry({ id: 'b3', method: 'POST' }),
      entry({ id: 's1', source: 'server' }),
    ];
    const counts = countDuplicates(entries);
    expect(counts.get(duplicateKey(entries[0]!))).toBe(2);
    expect(counts.get(duplicateKey(entries[2]!))).toBe(1);
    expect(counts.get(duplicateKey(entries[3]!))).toBe(1);
  });

  it('summarises count, duplicates, bytes, errors and slowest', () => {
    const summary = summarizeRequestLog([
      entry({ id: 'b1', sizeBytes: 1000, durationMs: 40 }),
      entry({ id: 'b2', sizeBytes: 500, durationMs: 90 }),
      entry({ id: 'b3', url: '/api/x', sizeBytes: null, status: 500 }),
    ]);
    expect(summary).toEqual({
      count: 3,
      errors: 1,
      duplicates: 1,
      totalBytes: 1500,
      unknownSize: 1,
      slowestMs: 90,
    });
  });

  it('treats 4xx, 5xx and network failures as errors', () => {
    expect(isErrorStatus(404)).toBe(true);
    expect(isErrorStatus(500)).toBe(true);
    expect(isErrorStatus('failed')).toBe(true);
    expect(isErrorStatus(200)).toBe(false);
    expect(isErrorStatus(302)).toBe(false);
    expect(isErrorStatus('pending')).toBe(false);
  });

  it('formats statuses, sizes and their colours', () => {
    expect(formatStatus('pending')).toBe('…');
    expect(formatStatus('failed')).toBe('ERR');
    expect(formatStatus(201)).toBe('201');
    expect(statusClassName(503)).toBe('text-red-400');
    expect(statusClassName(304)).toBe('text-amber-300');
    expect(statusClassName(200)).toBe('text-emerald-400');
    expect(formatBytes(null)).toBe('?');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
    expect(sizeClassName(150 * 1024)).toBe('text-red-400');
    expect(sizeClassName(30 * 1024)).toBe('text-amber-300');
  });
});

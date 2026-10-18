import { describe, expect, it } from 'vitest';

import { DEV_LOCAL_CLIENT_HEADER } from '../protocol.js';
import { clientAddress, isLocalClient, markLocalClient } from './local-client.js';

type FakeRequest = {
  socket: { remoteAddress?: string };
  headers: Record<string, string | undefined>;
};

const request = (remoteAddress: string, headers: Record<string, string> = {}): FakeRequest => ({
  socket: { remoteAddress },
  headers: { ...headers },
});

describe('dev-server local-client gate', () => {
  it('trusts the socket address on a direct connection', () => {
    expect(isLocalClient(request('127.0.0.1'))).toBe(true);
    expect(isLocalClient(request('::1'))).toBe(true);
    expect(isLocalClient(request('192.168.0.23'))).toBe(false);
  });

  it('behind the loopback proxy, uses the LAST X-Forwarded-For hop', () => {
    // Portless appends the real peer; the last entry is the one it wrote.
    expect(clientAddress(request('127.0.0.1', { 'x-forwarded-for': '127.0.0.1' }))).toBe('127.0.0.1');
    expect(isLocalClient(request('127.0.0.1', { 'x-forwarded-for': '192.168.0.23' }))).toBe(false);
  });

  it('ignores forged leading hops', () => {
    expect(
      isLocalClient(
        request('127.0.0.1', {
          'x-forwarded-for': '127.0.0.1, 192.168.0.23',
        })
      )
    ).toBe(false);
  });

  it('ignores X-Forwarded-For when the socket itself is not loopback', () => {
    expect(clientAddress(request('192.168.0.5', { 'x-forwarded-for': '127.0.0.1' }))).toBe('192.168.0.5');
  });

  it('marks local requests and strips a forged marker from LAN ones', () => {
    const local = request('127.0.0.1');
    markLocalClient(local);
    expect(local.headers[DEV_LOCAL_CLIENT_HEADER]).toBe('1');

    const lan = request('127.0.0.1', {
      'x-forwarded-for': '192.168.0.23',
      [DEV_LOCAL_CLIENT_HEADER]: '1',
    });
    markLocalClient(lan);
    expect(lan.headers[DEV_LOCAL_CLIENT_HEADER]).toBeUndefined();
  });
});

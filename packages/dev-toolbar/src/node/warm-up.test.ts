import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { withDevWarmUp } from './warm-up.js';

const request = (headers: Record<string, string> = {}) => ({ headers }) as unknown as IncomingMessage;
const response = {} as ServerResponse;

describe('dev-server warm-up', () => {
  it('requires the host app to inject the route to compile first', () => {
    const handler = vi.fn();
    expect(() => withDevWarmUp(handler, { port: 3000 } as never)).toThrow(TypeError);
    expect(() => withDevWarmUp(handler, { port: 3000, path: 'api/pages' })).toThrow(TypeError);
  });

  it('lets the warm-up request itself through immediately', () => {
    const handler = vi.fn();
    const warmUp = withDevWarmUp(handler, { port: 3000, path: '/api/x' });
    warmUp.handler(request({ 'x-dev-warm-up': '1' }), response);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('holds other requests until the warm-up settles, and a failed warm-up releases them', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = vi.fn();
    // Port 1: nothing listens, so the warm-up errors out — the worst case
    // must be "no hold", never a stuck server.
    const warmUp = withDevWarmUp(handler, { port: 1, path: '/api/x' });
    const held = warmUp.handler(request(), response);
    expect(handler).not.toHaveBeenCalled();
    warmUp.start();
    await held;
    expect(handler).toHaveBeenCalledTimes(1);
    warmUp.handler(request(), response);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

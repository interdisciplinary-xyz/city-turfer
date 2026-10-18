import { describe, expect, it } from 'vitest';

import { isLocalHostname } from './is-local-hostname';

describe('isLocalHostname', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', 'myapp.local', 'app.localhost'])('treats %s as local', (host) => {
    expect(isLocalHostname(host)).toBe(true);
  });

  it.each(['myapp.com', 'myapp-git-main.vercel.app', 'local.example.com'])('treats %s as remote', (host) => {
    expect(isLocalHostname(host)).toBe(false);
  });
});

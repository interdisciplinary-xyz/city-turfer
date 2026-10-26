import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf8');

// Each language is its own root layout (it owns <html>). next-intl's client-side Link would swap
// <html> in the browser, dropping the classes the boot scripts set (`loaded`) and leaving the hero
// hidden. A plain <a> forces a full page load, which runs the boot scripts again.
describe('LanguageSwitcher', () => {
  it('uses plain anchors with a locale pathname, not next-intl Link', () => {
    expect(source).toMatch(/<a\s[^>]*href=\{getPathname\(/s);
    expect(source).not.toMatch(/import\s+\{[^}]*\bLink\b[^}]*\}\s+from/);
    expect(source).not.toMatch(/<Link\b/);
  });
});

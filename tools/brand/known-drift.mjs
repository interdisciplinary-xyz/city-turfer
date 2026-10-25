/**
 * Brand findings that are known and accepted for now, so `pnpm run audit:brand` can gate everything
 * else. Each entry is a to-do for the branding plan or a lasting exception, with its reason:
 *
 *   rule, file   the finding it covers (same `rule` and repo-relative `file` as the audit prints)
 *   match        text that must appear in the finding's message (pins the exact literal)
 *   reason       why it stays; `todo: true` marks drift the plan should fix
 *
 * The audit reports covered findings as "known". An entry that no longer matches any finding is an
 * error: delete it when the drift is fixed, so this list never hides a regression.
 */

/** @type {readonly { rule: string, file: string, match: string, reason: string, todo?: boolean }[]} */
export const KNOWN_DRIFT = [
  {
    rule: 'brand-rgb',
    file: 'apps/mobile/src/contexts/territory/ui/layers.tsx',
    match: 'rgb(123,47,247)',
    reason:
      'Turf Map heatmap: the faint tier at 55% alpha, written as channels. Needs a brand helper for a token with alpha.',
    todo: true,
  },
  {
    rule: 'named-scheme',
    file: 'apps/admin/src/brand/theme.ts',
    match: 'THEMES.light',
    reason:
      "Admin follows Payload's light/dark toggle, so it maps both schemes; the dark label on pink is deliberate in both.",
  },
  {
    rule: 'named-scheme',
    file: 'apps/admin/src/brand/theme.ts',
    match: "cssVariables('light'",
    reason: 'Scheme-free values (fonts, radii, display case) read from one scheme; SITE_SCHEME would say the same.',
    todo: true,
  },
];

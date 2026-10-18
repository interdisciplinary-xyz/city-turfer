import type { Config } from 'tailwindcss';

// Tailwind styles ONLY the dev toolbar (`@interdisciplinary/dev-toolbar`); the landing page itself
// is plain CSS (globals.css). Preflight is off so Tailwind's reset never touches the page, and the
// CSS is imported from the dev-only toolbar adapter, so it never reaches the production export.
export default {
  content: ['../../packages/dev-toolbar/src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
} satisfies Config;

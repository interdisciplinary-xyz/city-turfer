import { ACCENT, BODY_FONT_FAMILY, SITE_SCHEME, SYSTEM_FONT_STACK, THEMES, WEB_ON_ACCENT } from '@cityturfer/brand';
import { create } from 'storybook/theming';

/** The website's body face (Barlow, @font-face in manager-head.html and preview-head.html), system fallback. */
const FONT = `'${BODY_FONT_FAMILY}', ${SYSTEM_FONT_STACK}`;

/** The website's scheme (dark, like the app): Storybook's own UI matches the pages it documents. */
const SITE = THEMES[SITE_SCHEME];

/**
 * Sidebar logo: the brand mark plus the night wordmark ("CITY" in white, "TURFER" in the Ramp). Under the
 * site header (https://cityturfer.local/storybook, apps/web/tools/storybook-route.mjs) the header has the
 * logo, so the logo hides and the "Design system" label shows instead. As HTML because Storybook shows
 * `brandTitle` as markup when there is no `brandImage`. Relative paths, so it also works under
 * https://cityturfer.local/storybook.
 */
const BRAND_TITLE = `<span class="ct-sb-logo" style="display:inline-flex;align-items:center;gap:10px">
<img src="./brand/mark.svg" width="34" height="34" alt="" style="border-radius:8px"/>
<img src="./brand/wordmark.svg" height="20" alt="CityTurfer"/>
</span><span class="ct-sb-label" style="display:none">Design system</span>`;

/** Storybook's own UI (sidebar, toolbar, panels, docs pages) in the site's dark palette. */
export const cityTurferTheme = create({
  base: SITE_SCHEME,
  brandTitle: BRAND_TITLE,
  brandUrl: './',
  brandTarget: '_self',

  // Pink as text (selected story, links, toolbar highlights): the scheme's AA text variant.
  colorPrimary: SITE.accentText,
  colorSecondary: SITE.accentText,

  appBg: SITE.bg,
  appContentBg: SITE.card,
  appPreviewBg: SITE.bg,
  appBorderColor: SITE.border,
  appBorderRadius: 12,

  fontBase: FONT,
  fontCode: "ui-monospace, 'SF Mono', Menlo, monospace",

  textColor: SITE.text,
  textMutedColor: SITE.muted,
  textInverseColor: WEB_ON_ACCENT,

  barBg: SITE.card,
  barTextColor: SITE.muted,
  barHoverColor: SITE.accentText,
  barSelectedColor: SITE.accentText,

  buttonBg: SITE.card,
  buttonBorder: SITE.borderControl,
  // A filled toggle: the pink fill, its label in textInverseColor (onAccent).
  booleanBg: SITE.bg,
  booleanSelectedBg: ACCENT,

  inputBg: SITE.card,
  inputBorder: SITE.borderControl,
  inputTextColor: SITE.text,
  inputBorderRadius: 8,
});

import { ACCENT, DARK, ON_ACCENT, TIER_COLOR } from '@cityturfer/brand';
import { create } from 'storybook/theming';

/** Same stack as the website (apps/web/src/app/globals.css). */
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Sidebar logo: the brand mark plus the wordmark ("City" cream, "Turfer" in the glow ramp), as
 * HTML because Storybook shows `brandTitle` as markup when there is no `brandImage`. Relative
 * paths, so it also works under https://cityturfer.local/storybook.
 */
const BRAND_TITLE = `<span style="display:inline-flex;align-items:center;gap:10px">
<img src="./brand/mark.svg" width="34" height="34" alt="" style="border-radius:8px"/>
<span style="font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${TIER_COLOR.blazing}">City<span style="background:linear-gradient(90deg,${TIER_COLOR.glowing},${TIER_COLOR.strong} 70%,${TIER_COLOR.blazing});-webkit-background-clip:text;background-clip:text;color:transparent">Turfer</span></span>
</span>`;

/** Storybook's own UI (sidebar, toolbar, panels, docs pages) in the app's dark palette. */
export const cityTurferTheme = create({
  base: 'dark',
  brandTitle: BRAND_TITLE,
  brandUrl: './',
  brandTarget: '_self',

  colorPrimary: ACCENT,
  colorSecondary: ACCENT,

  appBg: DARK.bg,
  appContentBg: DARK.bg,
  appPreviewBg: DARK.bg,
  appBorderColor: DARK.border,
  appBorderRadius: 12,

  fontBase: FONT,
  fontCode: "ui-monospace, 'SF Mono', Menlo, monospace",

  textColor: DARK.text,
  textMutedColor: DARK.muted,
  textInverseColor: ON_ACCENT,

  barBg: DARK.card,
  barTextColor: DARK.muted,
  barHoverColor: ACCENT,
  barSelectedColor: ACCENT,

  buttonBg: DARK.card,
  buttonBorder: DARK.border,
  booleanBg: DARK.bg,
  booleanSelectedBg: ACCENT,

  inputBg: DARK.bg,
  inputBorder: DARK.border,
  inputTextColor: DARK.text,
  inputBorderRadius: 8,
});

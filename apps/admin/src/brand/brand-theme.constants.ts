import { displayFont } from './fonts';
import { brandThemeCss } from './theme';

/** The brand theme stylesheet, built once from @cityturfer/brand tokens. */
export const BRAND_THEME_CSS = brandThemeCss(displayFont.style.fontFamily);

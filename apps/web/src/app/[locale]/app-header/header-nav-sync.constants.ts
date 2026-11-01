/** The header's section links (rendered by AppHeaderView); each `href` is `#<section id>`. */
export const NAV_LINK_SELECTOR = '.app-header-nav a[href^="#"]';

/** The sections the page is made of, in page order: the hero, the waitlist strip, every home section. */
export const SECTION_SELECTOR = 'main > section';

/** The footer: seen means the page bottom, which marks the last link. */
export const FOOTER_SELECTOR = 'footer.site-footer';

/**
 * The band of the viewport that counts as "reading here": from just under the sticky header (64 px
 * from 960 px, plus a little air) down to 40% of the viewport height.
 */
export const READING_BAND = '-80px 0px -60% 0px';

/** The state of the current link for assistive tech and for `.app-header-nav a[aria-current]` styles. */
export const CURRENT_VALUE = 'location';

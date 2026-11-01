/** The header's section links (rendered by AppHeaderView); each `href` is `#<section id>`. */
export const NAV_LINK_SELECTOR = '.app-header-nav a[href^="#"]';

/** The sections the page is made of, in page order: the hero, the waitlist strip, every home section. */
export const SECTION_SELECTOR = 'main > section';

/** The footer: seen means the page bottom, which marks the last link. */
export const FOOTER_SELECTOR = 'footer.site-footer';

/**
 * The band of the viewport that counts as "reading here": from just under the sticky bar (its height is
 * read from the `--header-h` variable, plus this much air) down to 40% of the viewport height.
 */
export const READING_BAND_AIR_PX = 16;
export const READING_BAND_BOTTOM = '-60%';

/**
 * The closing call to action has no link, so while it is the section in the band the walk-back keeps
 * the FAQ link lit (the last linked section above it): intended, not a leftover.
 */

/** The state of the current link for assistive tech and for `.app-header-nav a[aria-current]` styles. */
export const CURRENT_VALUE = 'location';

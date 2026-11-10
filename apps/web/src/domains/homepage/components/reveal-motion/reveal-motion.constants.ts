/** Elements that fade up once as they scroll into view: section heads and cards. */
export const REVEAL_ATTRIBUTE = 'data-reveal';
export const REVEAL_SELECTOR = `[${REVEAL_ATTRIBUTE}]`;

/** Where in the viewport an element counts as arrived (a little before it is fully in). */
export const REVEAL_START = 'top 92%';

/** How far an element rises as it appears (`web-motion`: a short rise, never more than half a line). */
export const REVEAL_RISE = '0.4em';

/** Gap between elements revealed in one batch, and the batch window, in seconds. */
export const REVEAL_STAGGER = 0.08;
export const REVEAL_INTERVAL = 0.1;

/** Social share image (Open Graph / Twitter), served from apps/web/public. */
/** `?v=` busts social-network caches when the image is re-rendered at the same URL: bump it then. */
export const OG_IMAGE_PATH = '/og-image.png?v=3';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** The portal's copy (`portal.*` in messages/*.json): provided only by the portal root's layout. */
export const PORTAL_NAMESPACE = 'portal';

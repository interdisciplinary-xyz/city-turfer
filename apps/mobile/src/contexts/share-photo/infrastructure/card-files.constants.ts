/**
 * Name prefix of the rendered card on Android (view-shot's `fileName`; the file is
 * `<prefix><digits>.jpg` in the app's cache). The sweep deletes only files with this prefix, so it
 * never touches the picker's copies or anything else in the cache.
 */
export const CARD_FILE_PREFIX = 'cityturfer-share-card';

/**
 * How long an Android card is kept after it was rendered: one hour. On Android the share sheet
 * resolves when the chooser returns, not when the target has read the file, and targets read it
 * late: Quick Share and Bluetooth send in the background, Drive and Gmail upload on a slow network,
 * Instagram keeps it open in its own editor. An hour covers those with room to spare; a leftover
 * card is about 1 MB of cache the OS may clear anyway.
 */
export const CARD_KEEP_MS = 60 * 60 * 1000;

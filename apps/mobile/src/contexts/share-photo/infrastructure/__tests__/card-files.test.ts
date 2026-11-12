import { cardFileName, isStaleCard } from '../card-files';
import { CARD_FILE_PREFIX, CARD_KEEP_MS } from '../card-files.constants';

const NOW = 1_800_000_000_000;
const CARD = `${CARD_FILE_PREFIX}4821937.jpg`;

describe('isStaleCard', () => {
  it('deletes our card once it is older than the keep window', () => {
    expect(isStaleCard(CARD, NOW - CARD_KEEP_MS, NOW)).toBe(true);
    expect(isStaleCard(CARD, NOW - 3 * CARD_KEEP_MS, NOW)).toBe(true);
  });

  it('keeps a card a target may still be reading', () => {
    expect(isStaleCard(CARD, NOW - CARD_KEEP_MS + 1, NOW)).toBe(false);
    expect(isStaleCard(CARD, NOW, NOW)).toBe(false);
  });

  it('keeps a card with an unknown or future modification time', () => {
    expect(isStaleCard(CARD, null, NOW)).toBe(false);
    expect(isStaleCard(CARD, NOW + CARD_KEEP_MS, NOW)).toBe(false);
  });

  it('never touches files that are not our cards', () => {
    const old = NOW - 10 * CARD_KEEP_MS;
    expect(isStaleCard('ReactNative-snapshot-image123.jpg', old, NOW)).toBe(false);
    expect(isStaleCard('ImagePicker', old, NOW)).toBe(false);
    expect(isStaleCard('photo.jpg', old, NOW)).toBe(false);
    expect(isStaleCard(`${CARD_FILE_PREFIX}1.png`, old, NOW)).toBe(false);
    expect(isStaleCard(`x-${CARD_FILE_PREFIX}1.jpg`, old, NOW)).toBe(false);
  });
});

describe('cardFileName', () => {
  it('names a card the sweep recognises once it is old', () => {
    const name = cardFileName(NOW, () => 0.123456);
    expect(name).toBe(`${CARD_FILE_PREFIX}${NOW}123456.jpg`);
    expect(name).toMatch(new RegExp(`^${CARD_FILE_PREFIX}\\d+\\.jpg$`));
    expect(isStaleCard(name, NOW - CARD_KEEP_MS, NOW)).toBe(true);
  });

  it('gives cards rendered in the same millisecond different names', () => {
    expect(cardFileName(NOW, () => 0.1)).not.toBe(cardFileName(NOW, () => 0.2));
  });

  it('pads the random digits so names stay digits only', () => {
    expect(cardFileName(NOW, () => 0)).toBe(`${CARD_FILE_PREFIX}${NOW}000000.jpg`);
  });
});

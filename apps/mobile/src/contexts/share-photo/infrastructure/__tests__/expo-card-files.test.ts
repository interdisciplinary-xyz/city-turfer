import { CARD_FILE_PREFIX, CARD_KEEP_MS } from '../card-files.constants';
import { ExpoCardFiles } from '../expo-card-files';

const NOW = 1_800_000_000_000;
const INTERNAL = '/data/user/0/com.cityturfer.app/cache';
const EXTERNAL = '/storage/emulated/0/Android/data/com.cityturfer.app/cache';

type MockEntry = { name: string; lastModified: number | null; dir?: boolean };
const mockTree = new Map<string, MockEntry[]>();
const mockDeleted: string[] = [];

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    name: string;
    lastModified: number | null;
    constructor(path: string, name: string, lastModified: number | null) {
      this.uri = path;
      this.name = name;
      this.lastModified = lastModified;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  }
  class Directory {
    path: string;
    constructor(uri: string) {
      this.path = uri.replace('file://', '');
    }
    get exists() {
      return mockTree.has(this.path);
    }
    list() {
      return (mockTree.get(this.path) ?? []).map((e) =>
        e.dir
          ? new Directory(`file://${this.path}/${e.name}`)
          : new File(`${this.path}/${e.name}`, e.name, e.lastModified)
      );
    }
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///data/user/0/com.cityturfer.app/cache/' } } };
});

beforeEach(() => {
  mockTree.clear();
  mockDeleted.length = 0;
  mockTree.set(INTERNAL, [
    { name: `${CARD_FILE_PREFIX}111.jpg`, lastModified: NOW - 2 * CARD_KEEP_MS },
    { name: `${CARD_FILE_PREFIX}222.jpg`, lastModified: NOW - 60_000 },
    { name: 'ReactNative-snapshot-image9.jpg', lastModified: NOW - 9 * CARD_KEEP_MS },
    { name: 'ImagePicker', lastModified: NOW - 9 * CARD_KEEP_MS, dir: true },
  ]);
  mockTree.set(EXTERNAL, [{ name: `${CARD_FILE_PREFIX}333.jpg`, lastModified: NOW - CARD_KEEP_MS }]);
});

describe('ExpoCardFiles', () => {
  it('Android: keeps the shared card and sweeps only our old cards in both caches', async () => {
    const cards = new ExpoCardFiles('android', () => NOW);
    expect(cards.deleteAfterShare).toBe(false);
    await cards.sweep();
    expect(mockDeleted).toEqual([`${INTERNAL}/${CARD_FILE_PREFIX}111.jpg`, `${EXTERNAL}/${CARD_FILE_PREFIX}333.jpg`]);
  });

  it('Android: a missing external cache is skipped', async () => {
    mockTree.delete(EXTERNAL);
    await new ExpoCardFiles('android', () => NOW).sweep();
    expect(mockDeleted).toEqual([`${INTERNAL}/${CARD_FILE_PREFIX}111.jpg`]);
  });

  it('iOS: deletes right after sharing and sweeps nothing', async () => {
    const cards = new ExpoCardFiles('ios', () => NOW);
    expect(cards.deleteAfterShare).toBe(true);
    await cards.sweep();
    expect(mockDeleted).toEqual([]);
  });
});

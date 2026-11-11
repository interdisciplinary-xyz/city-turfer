import { cacheDirs, isInside, normalisePath, tempRoots } from '../temp-paths';

const IOS = 'file:///var/mobile/Containers/Data/Application/ABC';
const IOS_ROOTS = tempRoots(`${IOS}/Library/Caches/`, `${IOS}/Documents/`);
const ANDROID_ROOTS = tempRoots(
  'file:///data/user/0/com.cityturfer.app/cache/',
  'file:///data/user/0/com.cityturfer.app/files/'
);

describe('temp paths', () => {
  it('normalises the scheme, /private and dot segments', () => {
    expect(normalisePath('file:///private/var/mobile/x/../y/./z.jpg')).toBe('/var/mobile/y/z.jpg');
    expect(normalisePath('/private/etc/hosts')).toBe('/private/etc/hosts');
  });

  it("matches view-shot's iOS device path under /private/var (the card JPEG)", () => {
    expect(isInside('/private/var/mobile/Containers/Data/Application/ABC/tmp/ReactNative/1.jpg', IOS_ROOTS)).toBe(true);
    expect(
      isInside('file:///private/var/mobile/Containers/Data/Application/ABC/tmp/ReactNative/1.jpg', IOS_ROOTS)
    ).toBe(true);
  });

  it("matches the picker's cache copies", () => {
    expect(isInside(`${IOS}/Library/Caches/ImagePicker/p.jpg`, IOS_ROOTS)).toBe(true);
    expect(isInside('file:///data/user/0/com.cityturfer.app/cache/ImagePicker/p.jpg', ANDROID_ROOTS)).toBe(true);
    expect(
      isInside('/storage/emulated/0/Android/data/com.cityturfer.app/cache/ReactNative-snapshot.jpg', ANDROID_ROOTS)
    ).toBe(true);
  });

  it('refuses anything else: documents, other apps, escapes, the root itself', () => {
    expect(isInside(`${IOS}/Documents/turftrack-u1.db`, IOS_ROOTS)).toBe(false);
    expect(isInside(`${IOS}/Library/Caches/../../Documents/x.db`, IOS_ROOTS)).toBe(false);
    expect(isInside('file:///var/mobile/Containers/Data/Application/OTHER/tmp/a.jpg', IOS_ROOTS)).toBe(false);
    expect(isInside(`${IOS}/tmp`, IOS_ROOTS)).toBe(false);
    expect(isInside('/storage/emulated/0/Android/data/other.app/cache/a.jpg', ANDROID_ROOTS)).toBe(false);
  });

  it("lists Android's internal and external cache folders (where the card may be)", () => {
    expect(cacheDirs('file:///data/user/0/com.cityturfer.app/cache/')).toEqual([
      '/data/user/0/com.cityturfer.app/cache',
      '/storage/emulated/0/Android/data/com.cityturfer.app/cache',
    ]);
    expect(cacheDirs(`${IOS}/Library/Caches/`)).toEqual(['/var/mobile/Containers/Data/Application/ABC/Library/Caches']);
  });
});

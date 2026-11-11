import type { PickedPhoto } from '../../index';
import { createPhotoHandoff } from '../photo-handoff';

const A: PickedPhoto = { uri: 'file:///cache/ImagePicker/a.jpg', width: 3024, height: 4032 };
const B: PickedPhoto = { uri: 'file:///cache/ImagePicker/b.jpg', width: 1080, height: 1920 };

describe('photo handoff', () => {
  it('gives the photo to its token once', () => {
    const h = createPhotoHandoff();
    const token = h.give(A);
    expect(h.take(token)).toEqual(A);
    expect(h.take(token)).toBeNull();
  });

  it('gives no photo for an unknown or missing token (a crafted deep link)', () => {
    const h = createPhotoHandoff();
    h.give(A);
    expect(h.take('file:///cache/somebody-elses.jpg')).toBeNull();
    expect(h.take('')).toBeNull();
    expect(h.take(undefined)).toBeNull();
  });

  it('keeps the photo after a wrong token', () => {
    const h = createPhotoHandoff();
    const token = h.give(A);
    expect(h.take('nope')).toBeNull();
    expect(h.take(token)).toEqual(A);
  });

  it('drops an unclaimed photo when a new one is handed over', () => {
    const dropped: PickedPhoto[] = [];
    const h = createPhotoHandoff((p) => dropped.push(p));
    const first = h.give(A);
    const second = h.give(B);
    expect(first).not.toBe(second);
    expect(dropped).toEqual([A]);
    expect(h.take(first)).toBeNull();
    expect(h.take(second)).toEqual(B);
  });

  it('never drops a photo that was taken', () => {
    const onDropped = jest.fn();
    const h = createPhotoHandoff(onDropped);
    h.take(h.give(A));
    h.give(B);
    expect(onDropped).not.toHaveBeenCalled();
  });
});

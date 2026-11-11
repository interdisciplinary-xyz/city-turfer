import { createSharePhotoApi } from '../../index';
import { fakeSharePhotoDeps } from '../../test-support/fakes';

describe('PickPhoto', () => {
  it('returns the photo from the camera or the library', async () => {
    const { deps } = fakeSharePhotoDeps();
    const api = createSharePhotoApi(deps);
    expect(await api.pickPhoto.execute('camera')).toEqual({
      uri: 'file:///cache/camera.jpg',
      width: 3024,
      height: 4032,
    });
    expect(await api.pickPhoto.execute('library')).toMatchObject({ uri: 'file:///cache/library.jpg' });
  });

  it('passes a cancel and a refused camera through', async () => {
    const api = createSharePhotoApi(fakeSharePhotoDeps({ camera: 'denied', library: 'cancelled' }).deps);
    expect(await api.pickPhoto.execute('camera')).toBe('denied');
    expect(await api.pickPhoto.execute('library')).toBe('cancelled');
  });

  it('treats a picker error as a cancel', async () => {
    const f = fakeSharePhotoDeps();
    f.state.pickThrows = true;
    expect(await createSharePhotoApi(f.deps).pickPhoto.execute('camera')).toBe('cancelled');
  });
});

describe('ShareCard', () => {
  it('sweeps old cards, renders, shares, then deletes the rendered file (iOS)', async () => {
    const f = fakeSharePhotoDeps();
    expect(await createSharePhotoApi(f.deps).share.execute({})).toEqual({ kind: 'shared' });
    expect(f.log).toEqual(['sweep', 'render', 'share file:///tmp/card.jpg', 'delete file:///tmp/card.jpg']);
  });

  it('keeps a shared card for a later sweep where the target may still read it (Android)', async () => {
    const f = fakeSharePhotoDeps({ keepShared: true });
    expect(await createSharePhotoApi(f.deps).share.execute({})).toEqual({ kind: 'shared' });
    expect(f.log).toEqual(['sweep', 'render', 'share file:///tmp/card.jpg']);
  });

  it('a failed render shares nothing and leaves no file', async () => {
    const f = fakeSharePhotoDeps();
    f.state.renderFails = true;
    expect(await createSharePhotoApi(f.deps).share.execute({})).toEqual({ kind: 'render-failed' });
    expect(f.log).toEqual(['sweep']);
  });

  it.each([false, true])(
    'a failed or unavailable share sheet still deletes the file (keepShared %s)',
    async (keepShared) => {
      const f = fakeSharePhotoDeps({ keepShared });
      f.state.shareFails = true;
      expect(await createSharePhotoApi(f.deps).share.execute({})).toEqual({ kind: 'share-failed' });
      expect(f.log).toEqual(['sweep', 'render', 'delete file:///tmp/card.jpg']);

      const g = fakeSharePhotoDeps({ keepShared });
      g.state.shareAvailable = false;
      expect(await createSharePhotoApi(g.deps).share.execute({})).toEqual({ kind: 'share-failed' });
      expect(g.log).toEqual(['sweep', 'render', 'delete file:///tmp/card.jpg']);
    }
  );

  it('a failed sweep never stops the share', async () => {
    const f = fakeSharePhotoDeps({ keepShared: true });
    f.state.sweepFails = true;
    expect(await createSharePhotoApi(f.deps).share.execute({})).toEqual({ kind: 'shared' });
    expect(f.log).toEqual(['render', 'share file:///tmp/card.jpg']);
  });
});

describe('SweepCards', () => {
  it('sweeps the kept cards', async () => {
    const f = fakeSharePhotoDeps({ keepShared: true });
    await createSharePhotoApi(f.deps).sweepCards.execute();
    expect(f.log).toEqual(['sweep']);
  });

  it('never throws', async () => {
    const f = fakeSharePhotoDeps({ keepShared: true });
    f.state.sweepFails = true;
    await expect(createSharePhotoApi(f.deps).sweepCards.execute()).resolves.toBeUndefined();
  });
});

it('DiscardPhoto deletes the picked copy', async () => {
  const f = fakeSharePhotoDeps();
  await createSharePhotoApi(f.deps).discardPhoto.execute('file:///cache/library.jpg');
  expect(f.log).toEqual(['delete file:///cache/library.jpg']);
});

describe('SharePromptSetting', () => {
  it("remembers Don't ask again per user", async () => {
    const f = fakeSharePhotoDeps();
    const api = createSharePhotoApi(f.deps);
    expect(await api.prompt.isOff('u1')).toBe(false);
    await api.prompt.turnOff('u1');
    expect(await api.prompt.isOff('u1')).toBe(true);
    expect(await api.prompt.isOff('u2')).toBe(false);
  });

  it('reads a broken keychain as off (never nags)', async () => {
    const f = fakeSharePhotoDeps();
    f.deps.prompt.isOff = () => Promise.reject(new Error('keychain'));
    expect(await createSharePhotoApi(f.deps).prompt.isOff('u1')).toBe(true);
  });
});

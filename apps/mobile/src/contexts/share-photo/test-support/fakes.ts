import type { SharePhotoDeps } from '../application/use-cases';
import type { PhotoPick } from '../domain/ports';

/** In-memory Share Photo adapters: what was rendered, shared and deleted, in order. */
export function fakeSharePhotoDeps(over: { camera?: PhotoPick; library?: PhotoPick } = {}) {
  const log: string[] = [];
  const flags = new Set<string>();
  const state = { renderFails: false, shareAvailable: true, shareFails: false, pickThrows: false };
  const deps: SharePhotoDeps = {
    photos: {
      takePhoto: async () => {
        if (state.pickThrows) {
          throw new Error('no camera');
        }
        return over.camera ?? { uri: 'file:///cache/camera.jpg', width: 3024, height: 4032 };
      },
      pickPhoto: async () => over.library ?? { uri: 'file:///cache/library.jpg', width: 1170, height: 2532 },
    },
    renderer: {
      render: async () => {
        if (state.renderFails) {
          throw new Error('capture failed');
        }
        log.push('render');
        return 'file:///tmp/card.jpg';
      },
    },
    share: {
      isAvailable: async () => state.shareAvailable,
      share: async (uri) => {
        if (state.shareFails) {
          throw new Error('sheet failed');
        }
        log.push(`share ${uri}`);
      },
    },
    files: {
      delete: async (uri) => {
        log.push(`delete ${uri}`);
      },
    },
    prompt: {
      isOff: async (uid) => flags.has(uid),
      turnOff: async (uid) => {
        flags.add(uid);
      },
      forget: async (uid) => {
        flags.delete(uid);
      },
    },
  };
  return { deps, log, state, flags };
}

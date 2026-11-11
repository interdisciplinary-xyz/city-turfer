import type { PickedPhoto } from '../index';

/**
 * Hands a picked photo from the activity screen to the share screen in memory, never through the
 * route: a `turftrack://` link reaches the share screen and must not be able to name a file (the
 * screen deletes its photo on leaving). The route carries only an opaque token; the share screen
 * takes the photo once, on mount. An unknown, used or replaced token gives no photo, so a crafted
 * link opens the screen in its normal "pick a photo" state.
 *
 * One photo waits at a time: handing over a new one drops the unclaimed one (`onDropped` deletes
 * its cache file).
 */
export function createPhotoHandoff(onDropped: (photo: PickedPhoto) => void = () => {}) {
  let pending: { token: string; photo: PickedPhoto } | null = null;
  let counter = 0;
  return {
    /** Keep `photo` for the share screen; the returned token goes into the route. */
    give(photo: PickedPhoto): string {
      if (pending) {
        onDropped(pending.photo);
      }
      counter += 1;
      const token = `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2)}`;
      pending = { token, photo };
      return token;
    },
    /** The photo handed over under `token`, once; null for anything else. */
    take(token: string | undefined): PickedPhoto | null {
      if (!token || !pending || pending.token !== token) {
        return null;
      }
      const { photo } = pending;
      pending = null;
      return photo;
    },
  };
}
export type PhotoHandoff = ReturnType<typeof createPhotoHandoff>;

import { useCallback, useEffect, useState } from 'react';

import { showSharePrompt } from '../index';
import { sharePhoto } from './share-photo-api';

/**
 * The after-Finish "Share a photo?" card: shown only with `justFinished` and while the Turfer hasn't
 * chosen Don't ask again; Not now (or a choice) hides it for this visit.
 */
export function useSharePrompt(userId: string | null, justFinished: boolean) {
  const [neverAsk, setNeverAsk] = useState<boolean | null>(null);
  const [handled, setHandled] = useState(false);
  useEffect(() => {
    let live = true;
    setNeverAsk(null);
    if (userId && justFinished) {
      void sharePhoto.prompt.isOff(userId).then((off) => live && setNeverAsk(off));
    }
    return () => {
      live = false;
    };
  }, [userId, justFinished]);
  return {
    visible: showSharePrompt({ justFinished, neverAsk, handled }),
    /** Not now, or a photo source was chosen. */
    hide: useCallback(() => setHandled(true), []),
    /** Don't ask again: hidden now and after every later Finish. */
    never: useCallback(() => {
      setNeverAsk(true);
      if (userId) {
        void sharePhoto.prompt.turnOff(userId);
      }
    }, [userId]),
  };
}

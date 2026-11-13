import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import type { PhotoSourceKind, PickedPhoto } from '../index';
import { sharePhoto } from './share-photo-api';
import { DISMISS_FALLBACK_MS } from './use-photo-picker.constants';

/**
 * Camera or library, from the action sheet or straight from a button, with the camera-denied
 * explainer. The system picker is launched only once our sheet has gone: on iOS strictly on the
 * modal's `onDismiss` (UIKit refuses to present over a dismissing modal, and the launch would
 * hang); on Android after a short delay, as its `onDismiss` may never come.
 */
export function usePhotoPicker(onPicked: (photo: PickedPhoto) => void) {
  const [sheet, setSheet] = useState(false);
  const [denied, setDenied] = useState(false);
  const pending = useRef<PhotoSourceKind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  const picked = useRef(onPicked);
  picked.current = onPicked;

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const launch = useCallback(async (source: PhotoSourceKind) => {
    const r = await sharePhoto.pickPhoto.execute(source);
    if (!live.current) {
      if (typeof r === 'object') {
        void sharePhoto.discardPhoto.execute(r.uri);
      }
      return;
    }
    if (r === 'denied') {
      setDenied(true);
    } else if (r !== 'cancelled') {
      picked.current(r);
    }
  }, []);

  /** Runs the source chosen in a closing modal, once (onDismiss or the fallback, whichever is first). */
  const afterDismiss = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const source = pending.current;
    pending.current = null;
    if (source) {
      void launch(source);
    }
  }, [launch]);

  const closeThen = useCallback(
    (source: PhotoSourceKind | null) => {
      pending.current = source;
      setSheet(false);
      setDenied(false);
      if (source && Platform.OS !== 'ios') {
        timer.current = setTimeout(afterDismiss, DISMISS_FALLBACK_MS);
      }
    },
    [afterDismiss]
  );

  return {
    sheetVisible: sheet,
    deniedVisible: denied,
    /** Show the action sheet (Take photo / Choose from library / Cancel). */
    open: useCallback(() => setSheet(true), []),
    /** A choice in the sheet or the explainer. */
    choose: useCallback((source: PhotoSourceKind) => closeThen(source), [closeThen]),
    /** Straight from a button (no sheet open). */
    pick: useCallback((source: PhotoSourceKind) => void launch(source), [launch]),
    close: useCallback(() => closeThen(null), [closeThen]),
    openSettings: useCallback(() => {
      setDenied(false);
      void Linking.openSettings();
    }, []),
    afterDismiss,
  };
}
export type PhotoPicker = ReturnType<typeof usePhotoPicker>;

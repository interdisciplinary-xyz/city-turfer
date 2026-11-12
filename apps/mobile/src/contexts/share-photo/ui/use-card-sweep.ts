import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { AppStateLike } from '@/platform/foreground';

import { sharePhoto } from './share-photo-api';

/**
 * Runs `sweep` whenever the app is in the foreground: now if it already is (app launch), then on
 * every change to 'active'. A headless launch (the OS delivering locations) sweeps nothing until
 * the Turfer opens the app. Returns the unsubscribe.
 */
export function sweepWhenActive(appState: AppStateLike, sweep: () => void): () => void {
  if (appState.currentState === 'active') {
    sweep();
  }
  const sub = appState.addEventListener('change', (state) => {
    if (state === 'active') {
      sweep();
    }
  });
  return () => sub.remove();
}

/**
 * Keeps the promise in the plan's privacy row: Android cards kept for the share target are deleted
 * once older than an hour even if the share screen is never opened again. Mounted once, in the root
 * layout. Lives in ui/ with the Share Photo wiring, never in the composition root (the background
 * task must not load Share Photo's native modules).
 */
export function useCardSweep(): void {
  useEffect(() => sweepWhenActive(AppState, () => void sharePhoto.sweepCards.execute()), []);
}

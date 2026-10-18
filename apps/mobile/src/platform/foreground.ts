/** The slice of react-native's AppState used here (injectable for tests). */
export interface AppStateLike {
  readonly currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

/**
 * Runs `job` once the app is in the foreground: now if it already is, else on
 * the first change to 'active'. Headless launches (the OS waking us to deliver
 * locations) then never spend their short background time on maintenance work.
 * Returns a cancel function.
 */
export function runWhenForeground(appState: AppStateLike, job: () => void): () => void {
  if (appState.currentState === 'active') {
    job();
    return () => undefined;
  }
  let done = false;
  const sub = appState.addEventListener('change', (state) => {
    if (done || state !== 'active') {
      return;
    }
    done = true;
    sub.remove();
    job();
  });
  return () => {
    done = true;
    sub.remove();
  };
}

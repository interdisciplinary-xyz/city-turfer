import type { LiveSessionNotifier } from '../application/ports';
import type { LiveSnapshot } from '../domain/recording-session';

type Listener = (s: LiveSnapshot | null) => void;

/** In-memory snapshot store shared by the background task and the UI (same JS runtime). */
export class LiveSessionStore implements LiveSessionNotifier {
  private snapshot: LiveSnapshot | null = null;
  private readonly listeners = new Set<Listener>();

  publish(snapshot: LiveSnapshot | null) {
    this.snapshot = snapshot;
    this.listeners.forEach((l) => l(snapshot));
  }
  get() {
    return this.snapshot;
  }
  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const liveSessionStore = new LiveSessionStore();

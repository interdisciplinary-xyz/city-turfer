import type { LiveSessionNotifier } from '../application/ports';
import type { LiveSnapshot } from '../domain/RecordingSession';

type Listener = (s: LiveSnapshot | null) => void;

/** In-memory snapshot store shared by the background task and the UI (same JS runtime). */
export class LiveSessionStore implements LiveSessionNotifier {
  private snapshot: LiveSnapshot | null = null;
  private version = 0;
  private readonly listeners = new Set<Listener>();

  publish(snapshot: LiveSnapshot | null) {
    this.snapshot = snapshot;
    this.version++;
    this.listeners.forEach((l) => l(snapshot));
  }
  get() {
    return this.snapshot;
  }
  getVersion() {
    return this.version;
  }
  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const liveSessionStore = new LiveSessionStore();

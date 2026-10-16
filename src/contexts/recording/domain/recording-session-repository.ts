import type { TrackPoint } from '@/shared-kernel';

import type { RecordingSession } from './recording-session';

export interface RecordingSessionRepository {
  /** The single Recording/Paused/AutoPaused session, if any. */
  getActive(): Promise<RecordingSession | null>;
  get(id: string): Promise<RecordingSession | null>;
  /** Atomic: session state + new track points + pulled domain events (outbox), one transaction. */
  save(session: RecordingSession, newPoints: readonly TrackPoint[]): Promise<void>;
  pointsOf(sessionId: string): Promise<TrackPoint[]>;
  purgePoints(sessionId: string): Promise<void>;
}

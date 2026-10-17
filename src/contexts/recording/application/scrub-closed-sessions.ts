import type { RecordingSessionRepository } from '../domain/recording-session-repository';

/**
 * One-off data repair (retention): finished/discarded sessions recorded before
 * a closed session dropped its position still hold the last fix in their
 * state, and discarded ones may still hold track points. Clears both.
 */
export class ScrubClosedSessions {
  constructor(private readonly d: { sessions: RecordingSessionRepository }) {}
  async execute(): Promise<{ scrubbed: number }> {
    return { scrubbed: await this.d.sessions.scrubClosedSessions() };
  }
}

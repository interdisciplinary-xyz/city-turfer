import type { ActivityType, DomainEvent } from '@/shared-kernel';

export interface SessionStarted extends DomainEvent<'SessionStarted'> {
  sessionId: string;
  activityType: ActivityType;
}
export interface SessionPaused extends DomainEvent<'SessionPaused'> {
  sessionId: string;
  auto: boolean;
}
export interface SessionResumed extends DomainEvent<'SessionResumed'> {
  sessionId: string;
  auto: boolean;
  segment: number;
}
export interface SessionFinished extends DomainEvent<'SessionFinished'> {
  sessionId: string;
  activityType: ActivityType;
  startedAt: number;
  endedAt: number;
  /**
   * Track Point segment numbers that begin with a manual Resume; every other segment after the
   * first begins after a GPS gap. null/absent: unknown (session started by an older build).
   */
  resumedSegments?: number[] | null;
}
export interface SessionDiscarded extends DomainEvent<'SessionDiscarded'> {
  sessionId: string;
}

export type RecordingEvent = SessionStarted | SessionPaused | SessionResumed | SessionFinished | SessionDiscarded;

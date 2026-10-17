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
}
export interface SessionDiscarded extends DomainEvent<'SessionDiscarded'> {
  sessionId: string;
}

export type RecordingEvent = SessionStarted | SessionPaused | SessionResumed | SessionFinished | SessionDiscarded;

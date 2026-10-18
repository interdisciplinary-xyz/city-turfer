// Public API of the Recording context.
import { ScrubClosedSessions } from './application/scrub-closed-sessions';
import {
  DiscardRecording,
  FinishedTrackQuery,
  FinishRecording,
  GetLiveSnapshot,
  GetLiveTrack,
  IngestFixes,
  PauseRecording,
  PrepareRecording,
  PurgeRecordedSession,
  type RecordingDeps,
  RecoverSession,
  ResumeRecording,
  StartRecording,
} from './application/use-cases';

export { SerialCommandExecutor } from './application/command-executor';

export function createRecordingApi(deps: RecordingDeps) {
  return {
    prepare: new PrepareRecording(deps),
    start: new StartRecording(deps),
    pause: new PauseRecording(deps),
    resume: new ResumeRecording(deps),
    ingestFixes: new IngestFixes(deps),
    finish: new FinishRecording(deps),
    discard: new DiscardRecording(deps),
    recover: new RecoverSession(deps),
    liveSnapshot: new GetLiveSnapshot(deps),
    liveTrack: new GetLiveTrack(deps),
    finishedTrack: new FinishedTrackQuery(deps),
    purgeRecorded: new PurgeRecordedSession(deps),
    scrubClosedSessions: new ScrubClosedSessions(deps),
  };
}
export type RecordingApi = ReturnType<typeof createRecordingApi>;
export type { FinishResult, RecordingDeps, RecoveryResult, StartResult } from './application/use-cases';
export type { SessionFinished } from './domain/events';
export type { LiveSnapshot, SessionStatus } from './domain/recording-session';

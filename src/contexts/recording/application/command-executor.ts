/**
 * Runs Recording commands one at a time, in the order they were submitted.
 *
 * Every command is load → change the RecordingSession → save. Two commands
 * interleaving (a background IngestFixes batch and the user's Finish, say)
 * would each save their own copy of the session and the later save would win,
 * e.g. turning a finished session back into a recording one. So every command
 * of one container (Start, IngestFixes, Pause, Resume, Finish, Discard,
 * Recover; auto-pause happens inside IngestFixes) goes through ONE executor,
 * shared by the UI and the background location task.
 *
 * The queue position is taken synchronously when `run` is called. A command
 * must never `run` another command on the same executor (it would wait for
 * itself); use cases don't call each other anyway.
 */
export class SerialCommandExecutor {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(command: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => command());
    // A failed command must not block the ones queued behind it.
    this.tail = result.catch(() => undefined);
    return result;
  }
}

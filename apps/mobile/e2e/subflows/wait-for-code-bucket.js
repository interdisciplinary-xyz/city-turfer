// Waits until 65 s have passed since the last code was requested (output.codeAt, set by the flow).
// The API mails at most one code a minute per address (docs/decisions/api-accounts-2026-10-22.md, A5);
// a request inside that minute answers 429. Maestro has no sleep command, so spin on the clock.
var since = Date.now() - (output.codeAt || 0);
var remaining = 65000 - since;
if (remaining > 0) {
  var end = Date.now() + remaining;
  while (Date.now() < end) {
    // busy wait: Maestro runs this script synchronously on the host
  }
}

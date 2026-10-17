#!/usr/bin/env bash
# Run the Maestro e2e suite on the iOS Simulator.
#   e2e/run.sh                 # all flows, booted simulator
#   e2e/run.sh 02-record-run   # single flow
# Env: DEVICE (simulator UDID, default: first booted), MAESTRO (path), DEV_URL (dev-client link;
# auto-detected when Metro runs on :8081, empty = installed release build).
set -euo pipefail
cd "$(dirname "$0")/.."
MAESTRO="${MAESTRO:-$(command -v maestro || echo "$HOME/.maestro/maestro/bin/maestro")}"
DEVICE="${DEVICE:-$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1)}"
[[ -n "$DEVICE" ]] || { echo "Boot an iOS simulator first (xcrun simctl boot <udid>)." >&2; exit 1; }
BUNDLE=com.turftrack.poc

if [[ -z "${DEV_URL+x}" ]]; then
  if curl -fs http://127.0.0.1:8081/status >/dev/null 2>&1; then
    DEV_URL="exp+turftrack://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
  else
    DEV_URL=""
  fi
fi

# Deterministic location setup: always-allow + start at the first fixture point.
xcrun simctl privacy "$DEVICE" grant location-always "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl location "$DEVICE" clear >/dev/null 2>&1 || true   # stop any running route replay
xcrun simctl location "$DEVICE" set 52.213302,20.998991

# Clean slate for full runs and the auth flow: Maestro's clearState does not remove
# the SQLite files on the iOS 27 simulator, so wipe them (and the keychain) ourselves.
if [[ $# -eq 0 || "$1" == "01-auth" ]]; then
  xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
  DATA="$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data 2>/dev/null || true)"
  [[ -n "$DATA" ]] && rm -rf "$DATA/Documents/SQLite"
  xcrun simctl keychain "$DEVICE" reset >/dev/null 2>&1 || true
fi

OUT="e2e-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
TARGET="e2e"
[[ $# -gt 0 ]] && TARGET="e2e/$1.yaml"
"$MAESTRO" --device "$DEVICE" test "$TARGET" \
  $( [[ "$TARGET" == "e2e" ]] && echo "--config e2e/config.yaml" ) \
  -e DEV_URL="$DEV_URL" \
  --format junit --output "$OUT/report.xml" --test-output-dir "$OUT"

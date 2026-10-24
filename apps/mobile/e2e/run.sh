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
# Dev builds add Expo's dev menu: it can open at launch, and its floating "Tools" button sits over
# the top-right map chips (record-turf, recenter), swallowing taps. Switch both off, in the app's
# own preferences (UserDefaults.standard) and through the simulator's defaults, with the app closed.
xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
APP_PREFS="$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data 2>/dev/null || true)/Library/Preferences/$BUNDLE.plist"
for key in EXDevMenuShowsAtLaunch EXDevMenuShowFloatingActionButton; do
  xcrun simctl spawn "$DEVICE" defaults write "$BUNDLE" "$key" -bool NO >/dev/null 2>&1 || true
  if [[ -f "$APP_PREFS" ]]; then plutil -replace "$key" -bool NO "$APP_PREFS" >/dev/null 2>&1 || true; fi
done

# Clean slate for full runs and the auth flow: Maestro's clearState does not remove
# the SQLite files on the iOS 27 simulator, so wipe them (and the keychain) ourselves.
if [[ $# -eq 0 || "$1" == "01-auth" ]]; then
  xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
  DATA="$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data 2>/dev/null || true)"
  [[ -n "$DATA" ]] && rm -rf "$DATA/Documents/SQLite"
  xcrun simctl keychain "$DEVICE" reset >/dev/null 2>&1 || true
fi

# Flows tagged `account` need the API dev server (AUTH_FIXED_CODE) and a bundle that points at it.
API_URL="${E2E_API_URL:-http://127.0.0.1:8787}"
AUTH_FIXED_CODE="${AUTH_FIXED_CODE:-000000}"
EXCLUDE=()
if ! curl -fs "$API_URL/v1/health" >/dev/null 2>&1 && ! curl -s -o /dev/null "$API_URL/"; then
  if [[ $# -gt 0 && ( "$1" == "15-account-settings" || "$1" == "17-local-profile-backup" ) ]]; then
    echo "The API is not answering at $API_URL. Start it: AUTH_FIXED_CODE=$AUTH_FIXED_CODE pnpm --filter @cityturfer/api dev" >&2
    echo "and start Metro with EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 (docs/quality/e2e.md)." >&2
    exit 1
  fi
  echo "WARNING: API not answering at $API_URL; skipping flows tagged 'account' (15-account-settings and 17-local-profile-backup NOT run)." >&2
  EXCLUDE=(--exclude-tags=account)
fi

OUT="e2e-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
TARGET="e2e"
[[ $# -gt 0 ]] && TARGET="e2e/$1.yaml"
"$MAESTRO" --device "$DEVICE" test "$TARGET" \
  $( [[ "$TARGET" == "e2e" ]] && echo "--config e2e/config.yaml" ) \
  -e DEV_URL="$DEV_URL" -e AUTH_FIXED_CODE="$AUTH_FIXED_CODE" \
  ${EXCLUDE[@]+"${EXCLUDE[@]}"} \
  --format junit --output "$OUT/report.xml" --test-output-dir "$OUT"

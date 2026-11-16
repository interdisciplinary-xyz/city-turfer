#!/usr/bin/env bash
# Copies CityTurfer's database from a connected iPhone and prints the
# coordinate-free timeline of the latest recording (tools/diagnose-recording.mjs).
# The copy stays on this Mac in ~/ct-phone. Usage: tools/device-diagnose.sh [device-udid]
# BUNDLE picks the app: com.cityturfer.app (default) or com.turftrack.poc for installs from before
# the TestFlight bundle id (v0.16.0 and older).
set -euo pipefail
DEVICE="${1:-00008120-0001591C3493C01E}"
BUNDLE="${BUNDLE:-com.cityturfer.app}"
DEST="$HOME/ct-phone"
mkdir -p "$DEST"
if ! out=$(xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier "$BUNDLE" --source Documents/SQLite --destination "$DEST" 2>&1); then
  echo "Copy failed for $BUNDLE on $DEVICE (wrong id, locked phone, or not a development build?" >&2
  echo "Installs from v0.16.0 or older: BUNDLE=com.turftrack.poc). devicectl said:" >&2
  echo "$out" >&2
  exit 1
fi
node "$(dirname "$0")/diagnose-recording.mjs" "$DEST/turftrack-admin.db"

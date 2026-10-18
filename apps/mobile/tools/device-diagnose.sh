#!/usr/bin/env bash
# Copies CityTurfer's database from a connected iPhone and prints the
# coordinate-free timeline of the latest recording (tools/diagnose-recording.mjs).
# The copy stays on this Mac in ~/ct-phone. Usage: tools/device-diagnose.sh [device-udid]
set -euo pipefail
DEVICE="${1:-00008120-0001591C3493C01E}"
DEST="$HOME/ct-phone"
mkdir -p "$DEST"
xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier com.turftrack.poc --source Documents/SQLite --destination "$DEST" >/dev/null
node "$(dirname "$0")/diagnose-recording.mjs" "$DEST/turftrack-admin.db"

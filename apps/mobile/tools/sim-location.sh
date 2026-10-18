#!/usr/bin/env bash
# Replay a GPX track into a running iOS Simulator or Android emulator so the
# app's background location task receives real movement.
#
#   tools/sim-location.sh ios tools/fixtures/run-5k.gpx [speed_m_s]
#   tools/sim-location.sh android tools/fixtures/run-5k.gpx [seconds_per_point]
#   tools/sim-location.sh ios --clear
#
# iOS: uses `xcrun simctl location booted start` (Xcode 14+), which interpolates
#      between waypoints at the given speed. Waypoints are thinned to keep the
#      command line short.
# Android: uses `adb emu geo fix <lon> <lat> <alt>` once per point, in real time.
#          For long tracks, prefer loading the GPX in the emulator's
#          Extended Controls → Location → Routes / "Load GPX/KML".
set -euo pipefail

platform="${1:-}"
file="${2:-}"
here="$(cd "$(dirname "$0")" && pwd)"

if [[ "$platform" == "ios" && "$file" == "--clear" ]]; then
  xcrun simctl location booted clear
  echo "Cleared simulated location."
  exit 0
fi

if [[ -z "$platform" || -z "$file" || ! -f "$file" ]]; then
  sed -n '2,15p' "$0"
  exit 1
fi

# Emit "lat lon ele" lines from the GPX via the shared parser.
points() {
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    import { parseGpx } from '$here/lib/geo.mjs';
    const { points } = parseGpx(readFileSync(process.argv[1], 'utf8'));
    const step = Math.max(1, Math.floor(points.length / (Number(process.argv[2]) || points.length)));
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      console.log(p.lat.toFixed(6), p.lon.toFixed(6), (p.ele ?? 0).toFixed(1));
    }
  " "$file" "${1:-0}"
}

case "$platform" in
  ios)
    speed="${3:-3}"
    waypoints=()
    while read -r lat lon _; do waypoints+=("$lat,$lon"); done < <(points 400)
    echo "Replaying ${#waypoints[@]} waypoints at ${speed} m/s into the booted iOS Simulator…"
    xcrun simctl location booted start --speed="$speed" "${waypoints[@]}"
    echo "Running. Stop with: tools/sim-location.sh ios --clear"
    ;;
  android)
    delay="${3:-1}"
    adb get-state >/dev/null
    total=$(points | wc -l | tr -d ' ')
    i=0
    while read -r lat lon ele; do
      adb emu geo fix "$lon" "$lat" "$ele" >/dev/null
      i=$((i + 1))
      printf '\r%d/%d' "$i" "$total"
      sleep "$delay"
    done < <(points)
    echo
    ;;
  *)
    echo "Platform must be ios or android" >&2
    exit 1
    ;;
esac

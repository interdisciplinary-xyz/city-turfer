#!/usr/bin/env bash
# Workaround: on this machine Xcode's Swift Package Manager hangs while
# downloading MapLibre's binary artifact. This script downloads it with curl
# and wraps it in a local Swift package (vendor/maplibre-spm) that the
# with-local-maplibre config plugin points CocoaPods/SPM at.
set -euo pipefail
VERSION="${1:-6.31.0}"
CHECKSUM="de3aaa435dd86768b06d90245e630d068dd7eef1491afae7217d1654c52c462a"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/maplibre-spm"
if [[ -f "$DEST/.version" && "$(cat "$DEST/.version")" == "$VERSION" ]]; then echo "MapLibre $VERSION already vendored"; exit 0; fi
rm -rf "$DEST" && mkdir -p "$DEST"
ZIP="$DEST/MapLibre.dynamic.xcframework.zip"
curl -fL --retry 3 -o "$ZIP" "https://github.com/maplibre/maplibre-native/releases/download/ios-v$VERSION/MapLibre.dynamic.xcframework.zip"
ACTUAL="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"
if [[ "$VERSION" == "6.31.0" && "$ACTUAL" != "$CHECKSUM" ]]; then echo "Checksum mismatch: $ACTUAL" >&2; exit 1; fi
(cd "$DEST" && unzip -q "$ZIP" && rm "$ZIP")
cat > "$DEST/Package.swift" <<SWIFT
// swift-tools-version:5.9
import PackageDescription
let package = Package(
  name: "MapLibre",
  platforms: [.iOS(.v12)],
  products: [.library(name: "MapLibre", targets: ["MapLibre"])],
  targets: [.binaryTarget(name: "MapLibre", path: "MapLibre.xcframework")]
)
SWIFT
(cd "$DEST" && git init -q && git add -A && git -c user.name=turftrack -c user.email=build@localhost commit -qm "MapLibre $VERSION" && git tag "$VERSION")
echo "$VERSION" > "$DEST/.version"
echo "Vendored MapLibre $VERSION at $DEST"

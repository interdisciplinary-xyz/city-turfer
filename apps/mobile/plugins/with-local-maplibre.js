// Expo config plugin: if tools/fetch-maplibre-ios.sh vendored MapLibre into
// vendor/maplibre-spm, point @maplibre/maplibre-react-native's SPM dependency
// at that local package instead of downloading the binary through Xcode
// (which hangs on this machine). Without the vendored folder: no change.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# with-local-maplibre';

module.exports = function withLocalMapLibre(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (!src.includes(MARKER)) {
        const snippet = `${MARKER}
local_maplibre = File.expand_path('../vendor/maplibre-spm', __dir__)
if File.exist?(File.join(local_maplibre, 'Package.swift'))
  $MLRN_SPM_SPEC = {
    url: "file://#{local_maplibre}",
    requirement: { kind: "exactVersion", version: File.read(File.join(local_maplibre, '.version')).strip },
    product_name: "MapLibre"
  }
end
`;
        src = snippet + '\n' + src;
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
};

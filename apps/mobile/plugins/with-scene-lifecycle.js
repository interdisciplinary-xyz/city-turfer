// Expo config plugin: adopt UIKit's scene-based life cycle, which iOS 27
// requires (apps without it trap at launch: "NoSceneLifecycleAdoption").
// Expo SDK 57 ships ExpoAppSceneDelegate + ExpoReactNativeFactoryProvider but
// the default template does not wire them up yet. Remove this plugin once the
// Expo template does.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
        ],
      },
    };
    return cfg;
  });

  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle expects a Swift AppDelegate');
    }
    let src = cfg.modResults.contents;
    src = src.replace(
      /class AppDelegate: ExpoAppDelegate \{/,
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
    );
    // The scene delegate creates the window and starts React Native.
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/,
      '// Window + startReactNative happen in ExpoAppSceneDelegate (scene life cycle, iOS 27).\n\n    '
    );
    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame:')) {
      throw new Error('with-scene-lifecycle: AppDelegate template changed; update the plugin');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};

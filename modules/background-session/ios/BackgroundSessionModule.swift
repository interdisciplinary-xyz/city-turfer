import CoreLocation
import ExpoModulesCore

/// Holds an iOS 17+ CLBackgroundActivitySession while a recording is active, so iOS
/// keeps the location session (and the app) alive with the screen locked.
public class BackgroundSessionModule: Module {
  private var session: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("BackgroundSession")

    AsyncFunction("start") { () -> Bool in
      guard #available(iOS 17.0, *) else { return false }
      if self.session == nil {
        self.session = CLBackgroundActivitySession()
      }
      return true
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      if #available(iOS 17.0, *) {
        (self.session as? CLBackgroundActivitySession)?.invalidate()
      }
      self.session = nil
    }.runOnQueue(.main)

    Function("isActive") { () -> Bool in
      self.session != nil
    }

    Function("isLowPowerMode") { () -> Bool in
      ProcessInfo.processInfo.isLowPowerModeEnabled
    }
  }
}

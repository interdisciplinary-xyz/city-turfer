import CoreLocation
import ExpoModulesCore

/// Workout-style background tracking on Apple's current API (iOS 17+): a
/// CLBackgroundActivitySession keeps the app eligible to run with the screen
/// locked, and CLLocationUpdate.liveUpdates(.fitness) streams fixes to JS as
/// `onLocations` events. If iOS relaunches the app while a recording is active,
/// the stream restarts on module creation and buffers until JS subscribes.
public class BackgroundSessionModule: Module {
  private static let activeKey = "cityturfer.liveLocation.active"
  private static let maxBuffer = 600

  private var session: AnyObject?
  private var stream: Task<Void, Never>?
  private var buffer: [LiveFix] = []
  private var observing = false

  public func definition() -> ModuleDefinition {
    Name("BackgroundSession")

    Events("onLocations")

    OnCreate {
      if UserDefaults.standard.bool(forKey: Self.activeKey) {
        DispatchQueue.main.async { self.startLive() }
      }
    }

    OnStartObserving {
      DispatchQueue.main.async {
        self.observing = true
        self.flush()
      }
    }

    OnStopObserving {
      DispatchQueue.main.async { self.observing = false }
    }

    AsyncFunction("start") { () -> Bool in
      self.startLive()
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.stopLive()
    }.runOnQueue(.main)

    Function("isActive") { () -> Bool in
      self.session != nil
    }

    Function("isStreaming") { () -> Bool in
      self.stream != nil
    }

    Function("isLowPowerMode") { () -> Bool in
      ProcessInfo.processInfo.isLowPowerModeEnabled
    }
  }

  // MARK: - Main queue only

  @discardableResult
  private func startLive() -> Bool {
    guard #available(iOS 17.0, *) else { return false }
    UserDefaults.standard.set(true, forKey: Self.activeKey)
    if session == nil {
      session = CLBackgroundActivitySession()
    }
    if stream == nil {
      stream = Task { [weak self] in
        do {
          for try await update in CLLocationUpdate.liveUpdates(.fitness) {
            if Task.isCancelled { break }
            guard let loc = update.location else { continue }
            let fix = LiveFix(loc)
            DispatchQueue.main.async { self?.deliver(fix) }
          }
        } catch {}
        DispatchQueue.main.async { self?.stream = nil }
      }
    }
    return true
  }

  private func stopLive() {
    UserDefaults.standard.set(false, forKey: Self.activeKey)
    stream?.cancel()
    stream = nil
    if #available(iOS 17.0, *) {
      (session as? CLBackgroundActivitySession)?.invalidate()
    }
    session = nil
    buffer.removeAll()
  }

  private func deliver(_ fix: LiveFix) {
    buffer.append(fix)
    if buffer.count > Self.maxBuffer {
      buffer.removeFirst(buffer.count - Self.maxBuffer)
    }
    if observing {
      flush()
    }
  }

  private func flush() {
    guard !buffer.isEmpty else { return }
    let batch = buffer
    buffer.removeAll()
    sendEvent("onLocations", ["locations": batch.map(\.asLocationObject)])
  }
}

/// A fix as plain values, safe to hand from the location stream to the main queue.
private struct LiveFix: Sendable {
  let timestampMs: Double
  let latitude: Double
  let longitude: Double
  let altitude: Double?
  let accuracy: Double?
  let speed: Double?

  init(_ loc: CLLocation) {
    timestampMs = loc.timestamp.timeIntervalSince1970 * 1000
    latitude = loc.coordinate.latitude
    longitude = loc.coordinate.longitude
    altitude = loc.verticalAccuracy >= 0 ? loc.altitude : nil
    accuracy = loc.horizontalAccuracy >= 0 ? loc.horizontalAccuracy : nil
    speed = loc.speed >= 0 ? loc.speed : nil
  }

  /// Same shape as expo-location's LocationObject, so the JS anti-corruption layer is shared.
  var asLocationObject: [String: Any] {
    [
      "timestamp": timestampMs,
      "coords": [
        "latitude": latitude,
        "longitude": longitude,
        "altitude": altitude ?? NSNull(),
        "accuracy": accuracy ?? NSNull(),
        "speed": speed ?? NSNull(),
      ] as [String: Any],
    ]
  }
}

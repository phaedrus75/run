import Foundation
import CoreLocation

struct ExportedPoint {
  let lat: Double
  let lng: Double
  let timestampMs: Int64
}

final class WatchLocationManager: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()

  private let minAccuracyM: CLLocationAccuracy = 60
  private let minDistanceBetweenPointsM: Double = 3

  private var maxSpeedMps: Double = 6.0
  private var lastAccepted: CLLocation?
  private var rawPoints: [CLLocation] = []
  private var elevationGainM: Double = 0
  private var lastAlt: Double?

  var onSnapshot: ((distanceKm: Double, elevationGainM: Double)) -> Void = { _ in }

  private var distanceM: Double = 0
  private var isPaused = false

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = 3
    manager.activityType = .fitness
  }

  func startTracking(for kind: ActivityKind) {
    maxSpeedMps = kind == .run ? 9.5 : 6.0
    reset()
    manager.requestWhenInUseAuthorization()
    manager.startUpdatingLocation()
  }

  func pauseTracking() {
    isPaused = true
    manager.stopUpdatingLocation()
  }

  func resumeTracking() {
    isPaused = false
    manager.startUpdatingLocation()
  }

  func stopTracking() {
    manager.stopUpdatingLocation()
  }

  func reset() {
    stopTracking()
    rawPoints.removeAll()
    lastAccepted = nil
    distanceM = 0
    elevationGainM = 0
    lastAlt = nil
    isPaused = false
  }

  func exportPoints() -> [ExportedPoint] {
    rawPoints.map {
      ExportedPoint(lat: $0.coordinate.latitude, lng: $0.coordinate.longitude, timestampMs: Int64($0.timestamp.timeIntervalSince1970 * 1000))
    }
  }

  private func accept(_ loc: CLLocation) -> Bool {
    if loc.horizontalAccuracy < 0 || loc.horizontalAccuracy > minAccuracyM { return false }
    if loc.speed >= 0 && loc.speed > maxSpeedMps { return false }
    guard let prev = lastAccepted else { return true }
    let d = loc.distance(from: prev)
    if d < minDistanceBetweenPointsM { return false }
    return true
  }

  private func accumulateElevation(_ loc: CLLocation) {
    guard loc.verticalAccuracy >= 0, loc.verticalAccuracy < 30 else { return }
    let alt = loc.altitude
    if let la = lastAlt {
      let diff = alt - la
      if diff > 0.5 { elevationGainM += diff }
    }
    lastAlt = alt
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard !isPaused else { return }
    for loc in locations {
      guard accept(loc) else { continue }
      if let prev = lastAccepted {
        distanceM += loc.distance(from: prev)
      }
      lastAccepted = loc
      rawPoints.append(loc)
      accumulateElevation(loc)
    }
    let km = distanceM / 1000.0
    onSnapshot((km, elevationGainM))
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}

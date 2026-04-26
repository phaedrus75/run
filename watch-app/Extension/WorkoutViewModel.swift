import Foundation
import Combine

enum ActivityKind: String, Codable {
  case walk
  case run
}

enum WorkoutPhase {
  case idle
  case active
  case paused
  case finished
}

final class WorkoutViewModel: ObservableObject {
  @Published private(set) var phase: WorkoutPhase = .idle
  @Published private(set) var activity: ActivityKind = .walk
  @Published private(set) var distanceKm: Double = 0
  @Published private(set) var durationSeconds: Double = 0
  @Published private(set) var paceText: String = "—"
  @Published private(set) var elevationGainM: Double = 0

  private let location = WatchLocationManager()
  private var tick: Timer?
  private var startedAt: Date?

  init() {
    location.onSnapshot = { [weak self] snap in
      DispatchQueue.main.async {
        guard let self else { return }
        self.distanceKm = snap.distanceKm
        self.elevationGainM = snap.elevationGainM
        self.paceText = Self.formatPace(durationSec: self.durationSeconds, distanceKm: snap.distanceKm)
      }
    }
  }

  func begin(_ kind: ActivityKind) {
    activity = kind
    phase = .active
    startedAt = Date()
    durationSeconds = 0
    distanceKm = 0
    elevationGainM = 0
    paceText = "—"
    location.startTracking(for: kind)
    tick?.invalidate()
    tick = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self else { return }
      if self.phase == .active {
        self.durationSeconds += 1
        self.paceText = Self.formatPace(durationSec: self.durationSeconds, distanceKm: self.distanceKm)
      }
    }
    RunLoop.main.add(tick!, forMode: .common)
  }

  func pause() {
    guard phase == .active else { return }
    phase = .paused
    location.pauseTracking()
  }

  func resume() {
    guard phase == .paused else { return }
    phase = .active
    location.resumeTracking()
  }

  func stopToSummary() {
    tick?.invalidate()
    tick = nil
    location.stopTracking()
    phase = .finished
  }

  func discard() {
    tick?.invalidate()
    tick = nil
    location.reset()
    phase = .idle
    distanceKm = 0
    durationSeconds = 0
    elevationGainM = 0
    paceText = "—"
    startedAt = nil
  }

  /// Build payload for WatchConnectivity (property-list friendly).
  func buildSavePayload() -> [String: Any] {
    let points = location.exportPoints()
    let pointsData: [[Any]] = points.map { [$0.lat, $0.lng, $0.timestampMs] }
    let jsonData = try! JSONSerialization.data(withJSONObject: pointsData)
    let pointsJSON = String(data: jsonData, encoding: .utf8) ?? "[]"

    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime]
    let started = startedAt.map { iso.string(from: $0) } ?? iso.string(from: Date())

    return [
      "zenRun": true,
      "type": activity.rawValue,
      "distance_km": distanceKm,
      "duration_seconds": Int(max(1, durationSeconds.rounded())),
      "elevation_gain_m": elevationGainM,
      "started_at": started,
      "pointsJSON": pointsJSON,
    ]
  }

  private static func formatPace(durationSec: Double, distanceKm: Double) -> String {
    guard distanceKm > 0.01, durationSec > 0 else { return "—" }
    let secPerKm = durationSec / distanceKm
    let m = Int(secPerKm) / 60
    let s = Int(secPerKm) % 60
    return String(format: "%d:%02d /km", m, s)
  }
}

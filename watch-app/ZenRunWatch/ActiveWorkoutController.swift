/**
 * ActiveWorkoutController
 * -----------------------
 * The brain of an in-progress watch workout. Combines `WorkoutLocationManager`
 * (filtered GPS) and `WorkoutHealthManager` (background runtime) under a
 * single `ObservableObject` so the SwiftUI views can render live metrics
 * without touching CoreLocation / HealthKit directly.
 *
 * State machine:
 *   .idle ──start──▶ .recording ──pause──▶ .paused ──resume──▶ .recording
 *                                                       │
 *                          stop()                       │ stop()
 *                          │                            │
 *                          ▼                            ▼
 *                       .ended (immutable snapshot for the summary view)
 *                       │
 *                       discard() / send() ──▶ .idle
 *
 * Snapshot fields mirror `WalkSnapshot` in `walkLocationTracker.ts` so the
 * iPhone-side payload uploader sees identical shapes regardless of recorder.
 *
 * Heads-up: HKWorkoutSession can fail to start (HK off, simulator, etc).
 * We treat that as non-fatal — the GPS path still works, we just lose the
 * background-runtime guarantee. The UI surfaces a quiet warning so the user
 * knows to keep the wrist raised.
 */

import Foundation
import Combine
import CoreLocation

enum WorkoutState {
    case idle
    case recording
    case paused
    case ended
}

final class ActiveWorkoutController: ObservableObject {
    // MARK: - Published state

    @Published private(set) var state: WorkoutState = .idle
    @Published private(set) var kind: WorkoutKind = .walk
    @Published private(set) var startedAt: Date?
    @Published private(set) var endedAt: Date?
    @Published private(set) var distanceKm: Double = 0
    @Published private(set) var durationSec: TimeInterval = 0
    @Published private(set) var elevationGainM: Double = 0
    @Published private(set) var pointCount: Int = 0
    @Published private(set) var paceText: String = "--:--"
    @Published private(set) var lastError: String?
    @Published private(set) var locationAuthorization: CLAuthorizationStatus = .notDetermined
    @Published private(set) var healthAuthorizationOk: Bool = false

    // MARK: - Internals

    private let location = WorkoutLocationManager()
    private let health = WorkoutHealthManager()

    private var points: [TrackedPoint] = []
    private var pausedAccumulatedSec: TimeInterval = 0
    private var pausedAt: Date?
    private var ticker: Timer?

    init() {
        location.onPoint = { [weak self] point in
            self?.handlePoint(point)
        }
        location.onAuthorizationChange = { [weak self] status in
            self?.locationAuthorization = status
        }
        // Reflect the cached value immediately so the UI doesn't flash
        // "permission unknown" while we wait for the system callback.
        self.locationAuthorization = location.authorizationStatus
    }

    // MARK: - Permission entry points (called from the home screen on tap)

    func ensureLocationPermission() {
        if location.authorizationStatus == .notDetermined {
            location.requestAuthorization()
        }
    }

    func ensureHealthAuthorization(completion: ((Bool) -> Void)? = nil) {
        health.requestAuthorization { [weak self] ok in
            self?.healthAuthorizationOk = ok
            completion?(ok)
        }
    }

    // MARK: - Lifecycle

    func start(kind: WorkoutKind) {
        guard state == .idle || state == .ended else { return }
        // Reset per-session state.
        self.kind = kind
        self.points = []
        self.pausedAccumulatedSec = 0
        self.pausedAt = nil
        self.distanceKm = 0
        self.durationSec = 0
        self.elevationGainM = 0
        self.pointCount = 0
        self.paceText = "--:--"
        self.lastError = nil
        self.endedAt = nil

        let now = Date()
        self.startedAt = now
        self.state = .recording

        location.start(maxSpeedMps: kind.maxSpeedMps)
        do {
            try health.startSession(kind: kind, startDate: now)
        } catch {
            // Non-fatal: we still record GPS, just without background runtime.
            self.lastError = "HealthKit: \(error.localizedDescription)"
        }
        startTicker()
    }

    func pause() {
        guard state == .recording else { return }
        state = .paused
        pausedAt = Date()
        health.pauseSession()
    }

    func resume() {
        guard state == .paused else { return }
        if let pa = pausedAt {
            pausedAccumulatedSec += Date().timeIntervalSince(pa)
        }
        pausedAt = nil
        state = .recording
        health.resumeSession()
    }

    /// Stop without saving — points are kept in memory so the summary screen
    /// can let the user choose to save or discard.
    func stop() {
        guard state == .recording || state == .paused else { return }
        if state == .paused, let pa = pausedAt {
            pausedAccumulatedSec += Date().timeIntervalSince(pa)
            pausedAt = nil
        }
        endedAt = Date()
        state = .ended
        location.stop()
        health.endSession()
        stopTicker()
        // Recompute one final time so the summary view sees up-to-date numbers.
        recomputeDuration(now: endedAt ?? Date())
    }

    /// Throw away the current session and return to idle. Called by the
    /// summary view's Discard button.
    func reset() {
        points = []
        pausedAccumulatedSec = 0
        pausedAt = nil
        startedAt = nil
        endedAt = nil
        distanceKm = 0
        durationSec = 0
        elevationGainM = 0
        pointCount = 0
        paceText = "--:--"
        lastError = nil
        state = .idle
    }

    // MARK: - Read-only views the summary / send code uses

    var allPoints: [TrackedPoint] { points }
    var startedAtIso: String? {
        startedAt.map { ISO8601DateFormatter().string(from: $0) }
    }
    var endedAtIso: String? {
        endedAt.map { ISO8601DateFormatter().string(from: $0) }
    }

    // MARK: - Live metrics

    private func startTicker() {
        stopTicker()
        let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.recomputeDuration(now: Date())
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    private func recomputeDuration(now: Date) {
        guard let started = startedAt else { return }
        var paused = pausedAccumulatedSec
        if state == .paused, let pa = pausedAt {
            paused += now.timeIntervalSince(pa)
        }
        let total = now.timeIntervalSince(started) - paused
        durationSec = max(0, total)
        paceText = paceFromDistance(durationSec: durationSec, distanceKm: distanceKm)
    }

    private func handlePoint(_ point: TrackedPoint) {
        // Ingestion still fires while paused — but the controller decides
        // whether to count distance or just keep the point as a breadcrumb.
        // Matching `walkLocationTracker.ts` we credit distance even in the
        // paused state IF a fresh point arrives, since the soft pause is a
        // duration-only flag. Manual pause (via the UI) is hard-stop on
        // distance, so:
        if state != .recording { return }

        let prev = points.last
        var addedKm = 0.0
        var elevAdd = 0.0
        if let p = prev {
            let m = haversineMeters(lat1: p.lat, lng1: p.lng, lat2: point.lat, lng2: point.lng)
            addedKm = m / 1000.0
            if let prevAlt = p.altitude, let curAlt = point.altitude {
                let dAlt = curAlt - prevAlt
                if dAlt > 0.5 { elevAdd = dAlt }
            }
        }
        points.append(point)
        distanceKm += addedKm
        elevationGainM += elevAdd
        pointCount = points.count

        recomputeDuration(now: Date())
    }
}

// MARK: - Pace helper

func paceFromDistance(durationSec: TimeInterval, distanceKm: Double) -> String {
    guard distanceKm >= 0.05 else { return "--:--" }
    let secPerKm = durationSec / distanceKm
    guard secPerKm.isFinite, secPerKm > 0 else { return "--:--" }
    let m = Int(secPerKm) / 60
    let s = Int(secPerKm) % 60
    return String(format: "%d:%02d", m, s)
}

func formatDurationHms(_ seconds: TimeInterval) -> String {
    let total = max(0, Int(seconds))
    let h = total / 3600
    let m = (total % 3600) / 60
    let s = total % 60
    if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
    return String(format: "%d:%02d", m, s)
}

func formatDistanceKm(_ km: Double) -> String {
    if km < 1.0 {
        return "\(Int(km * 1000)) m"
    }
    return String(format: "%.2f km", km)
}

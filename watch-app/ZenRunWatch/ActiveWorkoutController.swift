/**
 * ActiveWorkoutController
 * -----------------------
 * The brain of an in-progress watch workout. Combines `WorkoutLocationManager`
 * (filtered GPS) and `WorkoutHealthManager` (background runtime + live HR /
 * energy / VO₂ Max) under a single `ObservableObject` so the SwiftUI views
 * can render live metrics without touching CoreLocation / HealthKit directly.
 *
 * State machine:
 *   .idle ──start──▶ .recording ──pause──▶ .paused ──resume──▶ .recording
 *                                                       │
 *                          stop()                       │ stop()
 *                          │                            │
 *                          ▼                            ▼
 *                       .ended (immutable snapshot for the summary view)
 *                       │
 *                       saveAndPersist() / discard() ──▶ .idle
 *
 * Build 33 additions:
 *   • Live heart rate (latest sample), avg, max
 *   • Time-in-zone accumulation (seconds per HRZone)
 *   • Active energy (kcal) — cumulative for the workout
 *   • VO₂ Max read on init (used by the home screen footer)
 *   • Save vs Discard now actually means something — Save persists the
 *     workout to Apple Health, Discard drops it.
 *
 * Heads-up: HKWorkoutSession can fail to start (HK off, simulator, etc).
 * We treat that as non-fatal — the GPS path still works, we just lose the
 * background-runtime guarantee plus all HR/energy metrics. The UI surfaces
 * a quiet warning so the user knows to keep the wrist raised.
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

    // Heart rate
    @Published private(set) var currentHr: Double = 0
    @Published private(set) var avgHr: Double = 0
    @Published private(set) var maxHr: Double = 0
    @Published private(set) var currentZone: HRZone?
    @Published private(set) var timeInZoneSec: [HRZone: TimeInterval] = [:]

    // Energy
    @Published private(set) var activeEnergyKcal: Double = 0

    // Latest user VO₂ Max from HealthKit (set on init / on home-screen mount).
    @Published private(set) var latestVO2Max: Double?

    /// User max-HR setting for zone calculation. Build 33 uses the default;
    /// build 34 will let the iPhone push a user-overridden value.
    @Published var maxHrSetting: Double = HeartRateZones.defaultMaxHR

    // MARK: - Internals

    private let location = WorkoutLocationManager()
    private let health = WorkoutHealthManager()

    private var points: [TrackedPoint] = []
    private var pausedAccumulatedSec: TimeInterval = 0
    private var pausedAt: Date?
    private var ticker: Timer?

    /// HR running totals — kept separately so we don't recompute every tick.
    private var hrSampleCount: Int = 0
    private var hrSum: Double = 0

    /// Last instant we updated time-in-zone, so we can credit the elapsed
    /// delta to the current zone on the next tick.
    private var lastZoneTickAt: Date?

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

        health.onHeartRate = { [weak self] bpm in
            self?.handleHeartRate(bpm)
        }
        health.onActiveEnergy = { [weak self] kcal in
            self?.activeEnergyKcal = kcal
        }
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
            // Pull VO₂ Max once auth is granted — it's a one-shot read used
            // by the home screen, no need to keep polling.
            if ok { self?.refreshVO2Max() }
            completion?(ok)
        }
    }

    /// Read the user's most recent VO₂ Max sample. Safe to call from anywhere;
    /// no-op if HealthKit auth hasn't been granted yet.
    func refreshVO2Max() {
        health.fetchLatestVO2Max { [weak self] value in
            self?.latestVO2Max = value
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
        self.currentHr = 0
        self.avgHr = 0
        self.maxHr = 0
        self.currentZone = nil
        self.timeInZoneSec = [:]
        self.activeEnergyKcal = 0
        self.hrSampleCount = 0
        self.hrSum = 0
        self.lastZoneTickAt = nil

        let now = Date()
        self.startedAt = now
        self.state = .recording

        location.start(maxSpeedMps: kind.maxSpeedMps)
        do {
            try health.startSession(kind: kind, startDate: now)
        } catch {
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
        // Reset the zone-tick anchor so we don't credit paused time to a
        // zone bucket on the next tick.
        lastZoneTickAt = Date()
        health.resumeSession()
    }

    /// Stop without saving — points and HR stats are kept in memory so the
    /// summary screen can let the user choose to save or discard.
    func stop() {
        guard state == .recording || state == .paused else { return }
        if state == .paused, let pa = pausedAt {
            pausedAccumulatedSec += Date().timeIntervalSince(pa)
            pausedAt = nil
        }
        endedAt = Date()
        state = .ended
        location.stop()
        stopTicker()
        // Recompute one final time so the summary view sees up-to-date numbers.
        recomputeDuration(now: endedAt ?? Date())
        // Note: we do NOT call health.discardWorkout() / saveWorkoutToHealth()
        // here — the user chooses one in the summary view.
    }

    /// Called by the summary view's Save button. Persists the workout to
    /// Apple Health, then resets the controller. Async because the HK save
    /// is non-trivial; the completion fires once the write is durable.
    func saveAndPersistToHealth(completion: @escaping (Bool) -> Void) {
        guard state == .ended, let ended = endedAt else {
            completion(false)
            return
        }
        health.saveWorkoutToHealth(endDate: ended) { [weak self] ok in
            // Whether the HK persist succeeded or not, we still want to clear
            // local state and let the user move on. The iPhone payload was
            // already queued separately.
            self?.reset()
            completion(ok)
        }
    }

    /// Called by the summary view's Discard button. Drops the workout from
    /// HealthKit (no record kept) and returns to idle.
    func discard() {
        health.discardWorkout()
        reset()
    }

    /// Internal reset — clears all state without touching HealthKit. Used by
    /// `saveAndPersistToHealth` / `discard` after they've handled HK.
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
        currentHr = 0
        avgHr = 0
        maxHr = 0
        currentZone = nil
        timeInZoneSec = [:]
        activeEnergyKcal = 0
        hrSampleCount = 0
        hrSum = 0
        lastZoneTickAt = nil
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

    /// Total time-in-zone seconds across all zones, for normalising the bar.
    var totalZoneSec: TimeInterval {
        timeInZoneSec.values.reduce(0, +)
    }

    // MARK: - HR + zone updates

    private func handleHeartRate(_ bpm: Double) {
        guard bpm.isFinite, bpm > 0 else { return }
        currentHr = bpm
        hrSampleCount += 1
        hrSum += bpm
        avgHr = hrSum / Double(hrSampleCount)
        maxHr = max(maxHr, bpm)
        currentZone = HeartRateZones.zone(for: bpm, maxHR: maxHrSetting)
    }

    /// Credit elapsed time since the last tick to whichever zone the user
    /// is currently in. Called by the ticker every second so the summary
    /// shows minute-resolution accuracy regardless of how often HR samples
    /// arrive.
    private func updateTimeInZone(now: Date) {
        guard state == .recording, let zone = currentZone else {
            lastZoneTickAt = now
            return
        }
        if let last = lastZoneTickAt {
            let dt = now.timeIntervalSince(last)
            if dt > 0, dt < 5 {  // sanity-clamp on long ticker pauses
                timeInZoneSec[zone, default: 0] += dt
            }
        }
        lastZoneTickAt = now
    }

    // MARK: - Live metrics ticker

    private func startTicker() {
        stopTicker()
        lastZoneTickAt = Date()
        let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            let now = Date()
            self?.recomputeDuration(now: now)
            self?.updateTimeInZone(now: now)
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
        // Manual pause is hard-stop on distance accumulation. Soft pause
        // (auto-pause) is duration-only — we still credit incoming points.
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

/**
 * WorkoutHealthManager
 * --------------------
 * Owns the `HKWorkoutSession` so the watch keeps recording when the screen
 * sleeps. Build 33 promotes this from a pure background-runtime carrier to
 * an actual data source — it now streams live heart rate and active energy
 * from `HKLiveWorkoutBuilder` and queries the user's most recent VO₂ Max
 * sample on demand.
 *
 * Lifecycle:
 *   start                ← `requestAuthorization` once, then `startSession`
 *   live updates         ← HKLiveWorkoutBuilderDelegate.workoutBuilder(_:didCollectDataOf:)
 *   pause / resume       ← `session.pause()` / `session.resume()`
 *   stop                 ← caller picks one of:
 *                            saveWorkoutToHealth(...)  — persists to Apple Health
 *                            discardWorkout()          — drops the session entirely
 *
 * The save vs discard decision lives in `WorkoutSummaryView` — the user
 * explicitly chooses which path on the summary screen.
 */

import Foundation
import HealthKit

final class WorkoutHealthManager: NSObject {
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    // MARK: - Live update callbacks (set by ActiveWorkoutController)

    /// Latest heart-rate sample, in BPM. Fired on the main queue.
    var onHeartRate: ((Double) -> Void)?

    /// Cumulative active energy, in kcal. Fired on the main queue.
    var onActiveEnergy: ((Double) -> Void)?

    /// Most recent error encountered during live collection.
    /// Surfaced quietly — the workout can still proceed without these signals.
    var onCollectionError: ((Error) -> Void)?

    /// Latest known authorization status (cached on `requestAuthorization`).
    private(set) var lastAuthorizationOk: Bool = false

    // MARK: - Type sets

    private static let typesToShare: Set<HKSampleType> = {
        var s: Set<HKSampleType> = [HKObjectType.workoutType()]
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { s.insert(energy) }
        if let distWalk = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) { s.insert(distWalk) }
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { s.insert(hr) }
        return s
    }()

    private static let typesToRead: Set<HKObjectType> = {
        var s: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { s.insert(hr) }
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { s.insert(energy) }
        if let distWalk = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) { s.insert(distWalk) }
        if let vo2 = HKObjectType.quantityType(forIdentifier: .vo2Max) { s.insert(vo2) }
        return s
    }()

    // MARK: - Authorization

    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false)
            return
        }
        healthStore.requestAuthorization(toShare: Self.typesToShare, read: Self.typesToRead) { [weak self] ok, _ in
            DispatchQueue.main.async {
                self?.lastAuthorizationOk = ok
                completion(ok)
            }
        }
    }

    // MARK: - Session lifecycle

    /// Start the workout session for the given activity.
    /// Throws on configuration errors so the controller can surface them.
    func startSession(kind: WorkoutKind, startDate: Date) throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let cfg = HKWorkoutConfiguration()
        cfg.activityType = kind.hkActivityType
        cfg.locationType = .outdoor

        let session = try HKWorkoutSession(healthStore: healthStore, configuration: cfg)
        let builder = session.associatedWorkoutBuilder()
        builder.dataSource = HKLiveWorkoutDataSource(
            healthStore: healthStore,
            workoutConfiguration: cfg
        )
        builder.delegate = self
        session.delegate = self

        self.session = session
        self.builder = builder

        session.startActivity(with: startDate)
        builder.beginCollection(withStart: startDate) { _, _ in
            // Errors here just mean HR/energy won't be aggregated; the
            // session itself still has the background-runtime privilege.
        }
    }

    func pauseSession() { session?.pause() }
    func resumeSession() { session?.resume() }

    /// Persist the workout into Apple Health, then tear down the session.
    /// Calls `endCollection` → `finishWorkout` so the workout shows up in the
    /// iPhone Health app and contributes to activity rings.
    func saveWorkoutToHealth(endDate: Date, completion: @escaping (Bool) -> Void) {
        guard let session, let builder else {
            completion(false)
            return
        }
        session.end()
        builder.endCollection(withEnd: endDate) { [weak self] _, error in
            if let error = error {
                self?.onCollectionError?(error)
                self?.cleanup()
                DispatchQueue.main.async { completion(false) }
                return
            }
            builder.finishWorkout { [weak self] _, error in
                if let error = error {
                    self?.onCollectionError?(error)
                }
                self?.cleanup()
                DispatchQueue.main.async { completion(error == nil) }
            }
        }
    }

    /// Drop the session and discard the in-memory builder. Used by the
    /// summary screen's "Discard" button.
    func discardWorkout() {
        session?.end()
        builder?.discardWorkout()
        cleanup()
    }

    private func cleanup() {
        session = nil
        builder = nil
    }

    // MARK: - VO2 Max one-off query

    /// Resolves to the most recent VO₂ Max sample from HealthKit, or nil if
    /// none is available (no data in Health, or read auth declined).
    /// Returned value is in mL·kg⁻¹·min⁻¹ — Apple's standard unit.
    func fetchLatestVO2Max(completion: @escaping (Double?) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: .vo2Max) else {
            completion(nil)
            return
        }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            DispatchQueue.main.async {
                if let s = samples?.first as? HKQuantitySample {
                    let unit = HKUnit(from: "ml/kg*min")
                    completion(s.quantity.doubleValue(for: unit))
                } else {
                    completion(nil)
                }
            }
        }
        healthStore.execute(q)
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutHealthManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ builder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  let stats = builder.statistics(for: quantityType) else { continue }

            switch quantityType.identifier {
            case HKQuantityTypeIdentifier.heartRate.rawValue:
                // Use the most-recent rather than average so the live BPM
                // reflects what the user feels right now. The summary view
                // pulls avg/max from the controller's accumulated state.
                if let q = stats.mostRecentQuantity() {
                    let bpm = q.doubleValue(for: HKUnit.count().unitDivided(by: HKUnit.minute()))
                    DispatchQueue.main.async { [weak self] in
                        self?.onHeartRate?(bpm)
                    }
                }

            case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
                if let q = stats.sumQuantity() {
                    let kcal = q.doubleValue(for: .kilocalorie())
                    DispatchQueue.main.async { [weak self] in
                        self?.onActiveEnergy?(kcal)
                    }
                }

            default:
                break
            }
        }
    }

    func workoutBuilderDidCollectEvent(_ builder: HKLiveWorkoutBuilder) {
        // Events (pause/resume markers etc.) — nothing to do, the controller
        // already manages its own pause state.
    }
}

// MARK: - HKWorkoutSessionDelegate (state changes only — used for diagnostics)

extension WorkoutHealthManager: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        // No-op; the controller drives state transitions from the user's
        // pause/resume taps. This delegate method is required by the protocol
        // but we don't react to system-initiated state changes.
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        onCollectionError?(error)
    }
}

/**
 * WorkoutHealthManager
 * --------------------
 * Owns the `HKWorkoutSession` so the watch keeps recording when the screen
 * sleeps. Without this, watchOS suspends the app a few seconds after the
 * wrist drops and CoreLocation stops delivering updates.
 *
 * We don't actually surface HK metrics in build 31's UI — the session's job
 * is purely background-runtime. HR / energy / per-step distance can be
 * pulled from the live workout builder later if we want to show them.
 *
 * Permission flow: `requestAuthorization` asks the user once, then the
 * session reuses that authorization. Failures are non-fatal; the workout
 * still records GPS and shows duration / distance, just without the
 * background guarantee. The UI flags that case so the user can re-grant.
 */

import Foundation
import HealthKit

final class WorkoutHealthManager: NSObject {
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    /// Latest known authorization status (cached on `requestAuthorization`).
    /// HealthKit only tells us "share authorization" — read auth is opaque,
    /// so we surface this status mainly so the UI can show a banner when
    /// the user explicitly denies.
    private(set) var lastAuthorizationOk: Bool = false

    /// Types we *write* (the workout itself + active energy + distance).
    /// Read auth is requested too so we can pull HR / energy from the
    /// live data source in a later build.
    private static let typesToShare: Set<HKSampleType> = {
        var s: Set<HKSampleType> = [HKObjectType.workoutType()]
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            s.insert(energy)
        }
        if let distWalk = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) {
            s.insert(distWalk)
        }
        return s
    }()

    private static let typesToRead: Set<HKObjectType> = {
        var s: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { s.insert(hr) }
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            s.insert(energy)
        }
        if let distWalk = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) {
            s.insert(distWalk)
        }
        return s
    }()

    /// Idempotent. Resolves once HealthKit returns whether the user
    /// granted *write* authorization (which is all we get to know).
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

    /// Start the workout session for the given activity. Safe to call even
    /// if HK isn't available — it just won't grant background runtime.
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

        self.session = session
        self.builder = builder

        session.startActivity(with: startDate)
        builder.beginCollection(withStart: startDate) { _, _ in
            // Errors here just mean HR/energy won't be aggregated; the
            // session itself still has the background-runtime privilege.
        }
    }

    func pauseSession() {
        session?.pause()
    }

    func resumeSession() {
        session?.resume()
    }

    /// Cleanly close out the session and discard the in-memory builder.
    /// We don't `finishCollection` + `finishWorkout` — that path persists
    /// the workout into Apple Health, which we'd want to opt into deliberately
    /// once the round-trip via the iPhone is proven. For build 31 we keep
    /// the session purely as a background-runtime carrier.
    func endSession() {
        session?.end()
        builder?.discardWorkout()
        session = nil
        builder = nil
    }
}

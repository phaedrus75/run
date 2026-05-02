/**
 * WorkoutKind
 * -----------
 * Walks vs runs differ only in their tracker tunables (max plausible speed,
 * auto-pause threshold) and the activity type we hand to HealthKit. Everything
 * else — UI, GPS pipeline, payload shape, persistence — is shared.
 *
 * Values mirror `WALK_CONFIG` / `RUN_CONFIG` in
 * `frontend/services/walkLocationTracker.ts` so a workout recorded on the
 * watch behaves the same as one recorded on the phone.
 */

import Foundation
import HealthKit

enum WorkoutKind: String, Codable {
    case walk
    case run

    var displayName: String {
        switch self {
        case .walk: return "Walk"
        case .run: return "Run"
        }
    }

    /// Used for the iPhone payload's `type` field so the existing
    /// `watchBridge.ts` upload routes correctly.
    var payloadType: String { rawValue }

    /// HealthKit's view of the activity. `HKWorkoutSession` uses this to
    /// pick the right sensor profile (e.g. running cadence vs walking).
    var hkActivityType: HKWorkoutActivityType {
        switch self {
        case .walk: return .walking
        case .run: return .running
        }
    }

    /// Anything above this speed is treated as a GPS jump and discarded.
    /// Matches `WALK_CONFIG.maxSpeedMps` / `RUN_CONFIG.maxSpeedMps`.
    var maxSpeedMps: Double {
        switch self {
        case .walk: return 6.0   // ~21.6 km/h
        case .run: return 9.5    // ~34 km/h, covers sprints
        }
    }

    /// Average speed below this for the auto-pause window flips the soft
    /// pause flag. Distance still accumulates if a fresh point arrives,
    /// but duration stops growing.
    var autoPauseSpeedMps: Double {
        switch self {
        case .walk: return 0.4   // ~1.4 km/h
        case .run: return 0.5
        }
    }

    /// How long the user must be stationary before auto-pause kicks in.
    var autoPauseWindow: TimeInterval {
        switch self {
        case .walk: return 30
        case .run: return 45
        }
    }
}

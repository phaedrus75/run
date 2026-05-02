/**
 * WorkoutLocationManager
 * ----------------------
 * Watch-side `CLLocationManager` wrapper. Owns the location-permission flow
 * and emits filtered `TrackedPoint`s via `onPoint` so the controller can
 * accumulate distance without coupling SwiftUI state to CoreLocation.
 *
 * The filtering pipeline mirrors `walkLocationTracker.ts` ingest():
 *   - drop low-accuracy fixes (>60m horizontalAccuracy)
 *   - drop ordering inversions
 *   - drop near-duplicate points (<3m)
 *   - drop physically impossible jumps (speed > kind.maxSpeedMps)
 *
 * Background privileges come from the paired `HKWorkoutSession`. CoreLocation
 * keeps delivering updates whenever the workout session is active, even with
 * the watch screen off.
 */

import Foundation
import CoreLocation

struct TrackedPoint: Codable, Equatable {
    let lat: Double
    let lng: Double
    let timestamp: Date
    let altitude: Double?
    let accuracy: Double?
    let speed: Double?
}

private let MIN_ACCEPTABLE_ACCURACY_M: Double = 60
private let MIN_DISTANCE_BETWEEN_POINTS_M: Double = 3

final class WorkoutLocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private weak var lastEmitted: NSObject?  // unused; placeholder for future delegate handoff
    private var lastPoint: TrackedPoint?
    private var maxSpeedMps: Double = 9.5
    private var isRecording = false

    /// Called on the main queue with each accepted point.
    var onPoint: ((TrackedPoint) -> Void)?

    /// Called on the main queue with status changes; useful for surfacing
    /// "permission denied" in the UI.
    var onAuthorizationChange: ((CLAuthorizationStatus) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 3
        manager.activityType = .fitness
    }

    var authorizationStatus: CLAuthorizationStatus {
        manager.authorizationStatus
    }

    /// Triggers the system permission prompt. The user must explicitly tap
    /// "Allow Once" or "Allow While Using App" — we do NOT need "Always" on
    /// watchOS because the workout session keeps us active in the background.
    func requestAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func start(maxSpeedMps: Double) {
        self.maxSpeedMps = maxSpeedMps
        self.lastPoint = nil
        self.isRecording = true
        manager.startUpdatingLocation()
    }

    func pause() {
        // Keep the manager running so we can resume instantly without a fresh
        // permission round-trip. The controller suppresses point ingestion
        // while paused — the manager-level pause would also kill the GPS
        // hardware and add a 5-10s reacquisition delay on resume.
        // Intentional no-op.
    }

    func resume() {
        // Mirrors `pause()`: nothing to do here either.
    }

    func stop() {
        isRecording = false
        manager.stopUpdatingLocation()
        lastPoint = nil
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard isRecording else { return }
        for loc in locations {
            ingest(loc)
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        DispatchQueue.main.async {
            self.onAuthorizationChange?(manager.authorizationStatus)
        }
    }

    private func ingest(_ loc: CLLocation) {
        // Drop fixes that are obviously garbage. -1 means "unknown" per CL docs.
        let acc = loc.horizontalAccuracy
        guard acc >= 0, acc <= MIN_ACCEPTABLE_ACCURACY_M else { return }

        let candidate = TrackedPoint(
            lat: loc.coordinate.latitude,
            lng: loc.coordinate.longitude,
            timestamp: loc.timestamp,
            altitude: loc.verticalAccuracy >= 0 ? loc.altitude : nil,
            accuracy: acc,
            speed: loc.speed >= 0 ? loc.speed : nil
        )

        if let prev = lastPoint {
            // Strict ordering — out-of-order fixes confuse downstream pace.
            if candidate.timestamp <= prev.timestamp { return }

            let distM = haversineMeters(
                lat1: prev.lat, lng1: prev.lng,
                lat2: candidate.lat, lng2: candidate.lng
            )
            if distM < MIN_DISTANCE_BETWEEN_POINTS_M { return }

            let dtSec = max(0.001, candidate.timestamp.timeIntervalSince(prev.timestamp))
            let speedMps = distM / dtSec
            if speedMps > maxSpeedMps { return }
        }

        lastPoint = candidate
        DispatchQueue.main.async {
            self.onPoint?(candidate)
        }
    }
}

// MARK: - Geo helpers

func haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
    let R = 6371000.0
    let toRad = { (deg: Double) -> Double in deg * .pi / 180 }
    let dLat = toRad(lat2 - lat1)
    let dLng = toRad(lng2 - lng1)
    let l1 = toRad(lat1)
    let l2 = toRad(lat2)
    let sinDLat = sin(dLat / 2)
    let sinDLng = sin(dLng / 2)
    let h = sinDLat * sinDLat + cos(l1) * cos(l2) * sinDLng * sinDLng
    return 2 * R * asin(min(1, sqrt(h)))
}

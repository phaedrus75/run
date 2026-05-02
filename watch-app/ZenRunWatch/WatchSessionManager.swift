/**
 * WatchSessionManager
 * -------------------
 * One-stop owner of the watch's WCSession. Replaces the previous
 * `WatchSession.swift` / `ExtensionDelegate.swift` split that lived in the
 * deprecated WatchKit 2 extension target.
 *
 * Responsibilities:
 *   - Activate WCSession on app launch (once).
 *   - Publish activation / reachability state for the SwiftUI view.
 *   - Send hello payloads to the iPhone via transferUserInfo (queued, durable)
 *     and updateApplicationContext (last-state, persists across launches).
 *   - Reply to live `ping` / `resend_last` messages from the iPhone-side
 *     `WatchBridgeSession` (already deployed in build 26+).
 *
 * Payloads include `zenRun: true` and a monotonically-incrementing `_seq` so
 * the iPhone-side bridge filters and deduplicates correctly.
 */

import Foundation
import WatchConnectivity
import Combine

final class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    // MARK: - Published UI state

    @Published private(set) var activationState: WCSessionActivationState = .notActivated
    @Published private(set) var isReachable: Bool = false
    @Published private(set) var isCompanionAppInstalled: Bool = false
    @Published private(set) var lastSendStatus: String = "idle"
    @Published private(set) var lastSendAt: Date? = nil
    @Published private(set) var sendCount: Int = 0
    @Published private(set) var lastError: String? = nil

    // MARK: - Internal state

    private static let kSeqKey = "ZenRun.lastSeq"
    private static let kLastPayloadKey = "ZenRun.lastSentPayload"
    private var hasStarted = false

    private override init() {
        super.init()
    }

    /// Idempotent — safe to call multiple times. Only activates WCSession once
    /// per process lifetime.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true
        guard WCSession.isSupported() else {
            DispatchQueue.main.async { self.lastSendStatus = "WCSession unsupported" }
            return
        }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    // MARK: - Send actions (called by ContentView buttons)

    func sendHello() {
        guard ensureActivated() else { return }
        let payload = makePayload(kind: "hello", channel: "userInfo")
        WCSession.default.transferUserInfo(payload)
        persistLastPayload(payload)
        bumpStatus("transferUserInfo sent")
    }

    func sendContext() {
        guard ensureActivated() else { return }
        let payload = makePayload(kind: "hello-context", channel: "appContext")
        do {
            try WCSession.default.updateApplicationContext(payload)
            persistLastPayload(payload)
            bumpStatus("applicationContext sent")
        } catch {
            DispatchQueue.main.async {
                self.lastError = "context error: \(error.localizedDescription)"
                self.lastSendStatus = "context error"
                self.lastSendAt = Date()
            }
        }
    }

    /// Build & fire a real workout payload to the iPhone. Shape matches
    /// `WatchPayload` in `frontend/services/watchBridge.ts`:
    ///   { zenRun, _seq, type, distance_km, duration_seconds,
    ///     started_at, ended_at, elevation_gain_m, pointsJSON, source }
    /// `pointsJSON` is `[[lat, lng, timestamp_ms], ...]` so the iPhone can
    /// re-encode the polyline with its existing helpers (we don't need a
    /// polyline encoder on the watch).
    ///
    /// Uses `transferUserInfo` (queued, durable) AND `updateApplicationContext`
    /// (last-state, persists across launches) — same belt-and-braces pattern
    /// the legacy app used. The iPhone bridge dedupes via `_seq`.
    func sendWorkout(
        kind: WorkoutKind,
        distanceKm: Double,
        durationSec: TimeInterval,
        elevationGainM: Double,
        startedAt: Date,
        endedAt: Date,
        points: [TrackedPoint]
    ) -> Bool {
        guard ensureActivated() else { return false }
        guard let payload = buildWorkoutPayload(
            kind: kind,
            distanceKm: distanceKm,
            durationSec: durationSec,
            elevationGainM: elevationGainM,
            startedAt: startedAt,
            endedAt: endedAt,
            points: points
        ) else {
            DispatchQueue.main.async {
                self.lastError = "workout: failed to encode points"
                self.lastSendStatus = "encode failed"
                self.lastSendAt = Date()
            }
            return false
        }

        WCSession.default.transferUserInfo(payload)
        // Best-effort applicationContext too. If it throws (rare — only on
        // a malformed dict) we still have the durable transferUserInfo
        // queued so the iPhone will receive it.
        try? WCSession.default.updateApplicationContext(payload)
        persistLastPayload(payload)
        bumpStatus("workout sent")
        return true
    }

    private func buildWorkoutPayload(
        kind: WorkoutKind,
        distanceKm: Double,
        durationSec: TimeInterval,
        elevationGainM: Double,
        startedAt: Date,
        endedAt: Date,
        points: [TrackedPoint]
    ) -> [String: Any]? {
        // pointsJSON shape that watchBridge.ts.parsePoints expects:
        // each row is `[lat, lng, timestamp_ms]`. Anything shorter is
        // skipped on the iPhone side, so be strict here too.
        let rows: [[Double]] = points.map { p in
            [p.lat, p.lng, p.timestamp.timeIntervalSince1970 * 1000.0]
        }
        guard let pointsData = try? JSONSerialization.data(withJSONObject: rows, options: []),
              let pointsString = String(data: pointsData, encoding: .utf8) else {
            return nil
        }

        let iso = ISO8601DateFormatter()
        return [
            "zenRun": true,
            "_seq": nextSeq(),
            "type": kind.payloadType,
            "distance_km": distanceKm,
            "duration_seconds": Int(durationSec.rounded()),
            "elevation_gain_m": elevationGainM,
            "started_at": iso.string(from: startedAt),
            "ended_at": iso.string(from: endedAt),
            "pointsJSON": pointsString,
            "source": "watch",
            "watchAppVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
            "watchBuild": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?",
        ]
    }

    // MARK: - Helpers

    private func ensureActivated() -> Bool {
        guard WCSession.default.activationState == .activated else {
            DispatchQueue.main.async {
                self.lastError = "WCSession not activated yet"
                self.lastSendStatus = "not activated"
                self.lastSendAt = Date()
            }
            return false
        }
        return true
    }

    private func makePayload(kind: String, channel: String) -> [String: Any] {
        let seq = nextSeq()
        return [
            "zenRun": true,
            "_seq": seq,
            "kind": kind,
            "channel": channel,
            "ts": Date().timeIntervalSince1970,
            "source": "watch",
            "watchAppVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
            "watchBuild": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?",
        ]
    }

    private func nextSeq() -> Int {
        let d = UserDefaults.standard
        let next = d.integer(forKey: Self.kSeqKey) + 1
        d.set(next, forKey: Self.kSeqKey)
        return next
    }

    private func bumpStatus(_ msg: String) {
        DispatchQueue.main.async {
            self.lastSendStatus = msg
            self.lastSendAt = Date()
            self.sendCount += 1
            self.lastError = nil
        }
    }

    private func persistLastPayload(_ payload: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: payload, options: []) {
            UserDefaults.standard.set(data, forKey: Self.kLastPayloadKey)
        }
    }

    private func loadLastPayload() -> [String: Any]? {
        guard let data = UserDefaults.standard.data(forKey: Self.kLastPayloadKey) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any]
    }

    /// Dictionary returned to the iPhone's `pingWatch()` / `resendLastWorkout()`
    /// calls. The keys here MUST match what `WatchLiveReply` (in
    /// `services/watchBridge.ts`) reads, otherwise the diagnostic popup shows
    /// stale "never / n/a / no" values even when sends are succeeding.
    private func snapshot() -> [String: Any] {
        var out: [String: Any] = [
            "activationState": activationStateLabel(activationState),
            "isReachable": WCSession.default.isReachable,
            "isCompanionAppInstalled": WCSession.default.isCompanionAppInstalled,
            "sendCount": sendCount,
            "lastSendStatus": lastSendStatus,
            "hasStoredPayload": UserDefaults.standard.data(forKey: Self.kLastPayloadKey) != nil,
            "watchAppVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
            "watchBuild": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?",
        ]
        if let at = lastSendAt {
            out["lastSendAt"] = ISO8601DateFormatter().string(from: at)
            // A non-nil lastError means the most recent send threw; otherwise
            // the iPhone treats `lastSendOk` as the success indicator.
            out["lastSendOk"] = (lastError == nil)
        }
        if let err = lastError {
            out["lastSendError"] = err
        }
        return out
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.activationState = activationState
            self.isReachable = session.isReachable
            self.isCompanionAppInstalled = session.isCompanionAppInstalled
            if let error = error {
                self.lastError = "activation: \(error.localizedDescription)"
            }
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            // No standalone delegate method for companion-app changes on
            // watchOS; refresh the cached value whenever reachability changes
            // since they're correlated in practice.
            self.isCompanionAppInstalled = session.isCompanionAppInstalled
        }
    }

    /// Live two-way diagnostic queries from the iPhone side. The iPhone's
    /// `WatchBridgeModule.pingWatch()` and `resendLastWorkout()` invoke this
    /// path via `WCSession.sendMessage`.
    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        let kind = (message["kind"] as? String) ?? ""
        switch kind {
        case "ping":
            var snap = snapshot()
            snap["ok"] = true
            snap["pong"] = true
            replyHandler(snap)
        case "resend_last":
            if let payload = loadLastPayload() {
                WCSession.default.transferUserInfo(payload)
                var snap = snapshot()
                snap["ok"] = true
                snap["had_payload"] = true
                replyHandler(snap)
            } else {
                var snap = snapshot()
                snap["ok"] = true
                snap["had_payload"] = false
                replyHandler(snap)
            }
        default:
            replyHandler(["ok": false, "error": "unknown kind: \(kind)"])
        }
    }
}

private func activationStateLabel(_ state: WCSessionActivationState) -> String {
    switch state {
    case .notActivated: return "notActivated"
    case .inactive: return "inactive"
    case .activated: return "activated"
    @unknown default: return "unknown"
    }
}

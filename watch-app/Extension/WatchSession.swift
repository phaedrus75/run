import Foundation
import WatchConnectivity

/// Singleton WCSession delegate on the watch side.
///
/// Sends workouts via `transferUserInfo` (queued, FIFO, durable) AND mirrors a
/// heartbeat into `updateApplicationContext` (latest-only, persisted by the OS,
/// always replayed to the iPhone on next activation). The duplicate channel is
/// deliberate: if `transferUserInfo` silently fails for any reason, the
/// applicationContext lets the iPhone detect the watch had something to send.
///
/// Also responds to live diagnostic messages from the iPhone:
///   - `kind: "ping"` → returns watch-side WCSession state so the user can see
///     in-app whether the watch thinks the channel is healthy.
///   - `kind: "resend_last"` → re-fires the most recently sent workout payload.
///     Used when iOS silently drops a `transferUserInfo` and the user wants to
///     force redelivery without doing the workout over.
final class WatchSession: NSObject, WCSessionDelegate {
  static let shared = WatchSession()

  private(set) var lastActivationState: WCSessionActivationState = .notActivated
  private(set) var lastActivationError: String?
  private(set) var lastSendAt: Date?
  private(set) var lastSendOk: Bool?
  private(set) var lastSendError: String?
  private var pendingWorkoutContext: [String: Any]?

  private static let kLastPayloadKey = "ZenRun.lastSentPayload"

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Sends the workout via the queued channel and pushes a copy onto the
  /// applicationContext fallback. If the session isn't activated yet, defers
  /// both calls until `activationDidComplete` fires.
  func sendWorkoutToPhone(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default

    persistLastPayload(payload)

    if session.activationState != .activated {
      pendingWorkoutContext = payload
      return
    }

    deliverPayload(payload, on: session)
  }

  private func deliverPayload(_ payload: [String: Any], on session: WCSession) {
    lastSendAt = Date()
    lastSendError = nil
    do {
      var ctx = payload
      // Stamp every send so the iPhone can dedupe across the two channels and
      // distinguish a fresh send from a stale-cache redelivery.
      ctx["_seq"] = Int(Date().timeIntervalSince1970 * 1000)
      try session.updateApplicationContext(ctx)
    } catch {
      lastSendError = "ctx: \(error.localizedDescription)"
    }
    session.transferUserInfo(payload)
    if lastSendError == nil {
      lastSendOk = true
    } else {
      lastSendOk = false
    }
  }

  // MARK: - Persistence (for resend_last)

  private func persistLastPayload(_ payload: [String: Any]) {
    do {
      // Only encode JSON-safe values — strip anything unexpected.
      let json = try JSONSerialization.data(withJSONObject: payload, options: [])
      UserDefaults.standard.set(json, forKey: Self.kLastPayloadKey)
    } catch {
      // Non-fatal: resend will just say "no payload".
    }
  }

  private func loadLastPayload() -> [String: Any]? {
    guard let data = UserDefaults.standard.data(forKey: Self.kLastPayloadKey) else { return nil }
    return (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any]
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    lastActivationState = activationState
    lastActivationError = error?.localizedDescription
    if let pending = pendingWorkoutContext, activationState == .activated {
      pendingWorkoutContext = nil
      deliverPayload(pending, on: session)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {}

  /// Live two-way query channel for in-app diagnostics.
  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    let kind = (message["kind"] as? String) ?? ""

    switch kind {
    case "ping":
      replyHandler(stateSnapshot())

    case "resend_last":
      if let payload = loadLastPayload() {
        deliverPayload(payload, on: session)
        var snap = stateSnapshot()
        snap["had_payload"] = true
        replyHandler(snap)
      } else {
        var snap = stateSnapshot()
        snap["had_payload"] = false
        replyHandler(snap)
      }

    default:
      replyHandler(["error": "unknown kind: \(kind)"])
    }
  }

  private func stateSnapshot() -> [String: Any] {
    var out: [String: Any] = [
      "activationState": activationStateName(lastActivationState),
      "isReachable": WCSession.isSupported() ? WCSession.default.isReachable : false,
    ]
    if let err = lastActivationError { out["activationError"] = err }
    if let t = lastSendAt {
      out["lastSendAt"] = ISO8601DateFormatter().string(from: t)
    }
    if let ok = lastSendOk { out["lastSendOk"] = ok }
    if let err = lastSendError { out["lastSendError"] = err }
    out["hasStoredPayload"] = UserDefaults.standard.data(forKey: Self.kLastPayloadKey) != nil
    return out
  }
}

private func activationStateName(_ state: WCSessionActivationState) -> String {
  switch state {
  case .notActivated: return "notActivated"
  case .inactive: return "inactive"
  case .activated: return "activated"
  @unknown default: return "unknown"
  }
}
